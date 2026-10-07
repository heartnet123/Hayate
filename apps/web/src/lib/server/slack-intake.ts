import { ensureAiAnswerSchema, matchApprovedSop } from "$lib/server/ai-answers";
import { getDatabase, getSlackSettings } from "$lib/server/auth";
import { parseSlackMessage } from "$lib/server/slack-message";

const AI_MENTION = /(?:^|\s)@(?:ai|helpdesk(?:[-_]?ai)?)\b/iu;
const SOP_FAILURE_CONFIRMATION =
  /^(?:(?:<@[^>\s]+>|@(?:ai|helpdesk(?:[-_]?ai)?))\s+)?(?:sop ไม่ได้ผล|sop ไม่แก้ปัญหา|ทำตาม sop แล้วไม่หาย|sop did not work)[.!]?$/iu;

const FALLBACK_NOTICE_BODY =
  "AI ยังตอบไม่ได้ เพราะไม่มี SOP ที่อนุมัติและเหมาะสมกับคำขอนี้ ส่งต่อเรื่องให้เจ้าหน้าที่ในคิวกลางแล้ว";
const FALLBACK_PENDING_WARNING =
  "Fallback notification not confirmed; staff must check the Slack thread before replying.";

export interface SlackIntakeResult {
  readonly accepted: boolean;
  readonly deliveryRequestId?: number;
  readonly duplicate?: boolean;
  readonly fallbackDeliveryRequestId?: number;
  readonly pendingAiAnswer?: boolean;
  readonly queued?: boolean;
}

const pendingFallback = (requestId: number): number | undefined =>
  getDatabase()
    .prepare(
      `SELECT tickets.request_id FROM slack_fallback_deliveries
       JOIN tickets ON tickets.id = slack_fallback_deliveries.ticket_id
       WHERE tickets.request_id = ? AND slack_fallback_deliveries.status = 'sending'
         AND slack_fallback_deliveries.dispatch_claimed_at IS NULL`
    )
    .get(requestId) === undefined
    ? undefined
    : requestId;

const queuedForRequest = (requestId: number): boolean =>
  getDatabase()
    .prepare("SELECT id FROM tickets WHERE request_id = ?")
    .get(requestId) !== undefined;

const classifySopConfirmation = (
  request: { readonly id: number } | undefined,
  message: NonNullable<ReturnType<typeof parseSlackMessage>>,
  mentioned: boolean
) => {
  if (
    request === undefined ||
    message.messageTs === message.threadTs ||
    !SOP_FAILURE_CONFIRMATION.test(message.body.replaceAll(/\s+/gu, " "))
  ) {
    return { confirmed: false, pending: false, repeated: mentioned };
  }
  const answer = getDatabase()
    .prepare(
      `SELECT ai_answers.status FROM ai_answers
       JOIN slack_requests ON slack_requests.id = ai_answers.request_id
       WHERE ai_answers.request_id = ? AND slack_requests.owner_id = ?
         AND (ai_answers.status = 'sending' OR (ai_answers.status = 'sent'
           AND CAST(ai_answers.slack_ts AS REAL) < CAST(? AS REAL)))`
    )
    .get(request.id, message.userId, message.messageTs);
  const confirmed = answer?.status === "sent";
  return {
    confirmed,
    pending: answer?.status === "sending",
    repeated: confirmed ? queuedForRequest(request.id) : mentioned,
  };
};

export const ingestSlackEvent = (payload: unknown): SlackIntakeResult => {
  ensureAiAnswerSchema();
  const settings = getSlackSettings();
  const message = parseSlackMessage(payload, settings);
  if (message === null) {
    return { accepted: false };
  }
  const database = getDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    const priorEvent = database
      .prepare(
        `SELECT request_id AS requestId FROM slack_intake_events WHERE event_id = ?
         UNION ALL SELECT request_id AS requestId FROM slack_messages WHERE event_id = ? LIMIT 1`
      )
      .get(message.eventId, message.eventId) as
      | { requestId: number }
      | undefined;
    if (priorEvent) {
      database.exec("COMMIT");
      return {
        accepted: true,
        duplicate: true,
        fallbackDeliveryRequestId: pendingFallback(priorEvent.requestId),
        queued: queuedForRequest(priorEvent.requestId),
      };
    }
    const existing = database
      .prepare(
        "SELECT id, owner_id AS ownerId FROM slack_requests WHERE workspace = ? AND channel = ? AND thread_ts = ?"
      )
      .get(settings.workspace, settings.channel, message.threadTs) as
      | { id: number; ownerId: string }
      | undefined;
    const officialAssignee =
      existing && existing.ownerId !== message.userId
        ? (database
            .prepare(`
              SELECT tickets.assignee_id AS agentId FROM tickets
              JOIN users ON users.id = tickets.assignee_id
              JOIN slack_identities ON slack_identities.user_id = users.id
              WHERE tickets.request_id = ? AND users.role IN ('admin', 'agent')
                AND slack_identities.workspace = ? AND slack_identities.slack_user_id = ?
                AND CAST(? AS REAL) >= tickets.assigned_at
            `)
            .get(
              existing.id,
              settings.workspace,
              message.userId,
              message.messageTs
            ) as { agentId: number } | undefined)
        : undefined;
    const mentioned =
      message.type === "app_mention" || AI_MENTION.test(message.body);
    if (!existing && !mentioned) {
      database.exec("COMMIT");
      return { accepted: false };
    }
    const confirmation = classifySopConfirmation(existing, message, mentioned);
    if (confirmation.pending) {
      database.exec("COMMIT");
      return { accepted: false, pendingAiAnswer: true };
    }
    if (existing && !officialAssignee && confirmation.repeated) {
      database
        .prepare(
          "INSERT INTO slack_intake_events (event_id, request_id) VALUES (?, ?)"
        )
        .run(message.eventId, existing.id);
      database.exec("COMMIT");
      return {
        accepted: true,
        duplicate: true,
        fallbackDeliveryRequestId: pendingFallback(existing.id),
        queued: queuedForRequest(existing.id),
      };
    }
    const request =
      existing ??
      (database
        .prepare(
          "INSERT INTO slack_requests (workspace, channel, thread_ts, owner_id, owner_name) VALUES (?, ?, ?, ?, ?) RETURNING id"
        )
        .get(
          settings.workspace,
          settings.channel,
          message.threadTs,
          message.userId,
          message.userName
        ) as { id: number });
    database
      .prepare(
        "INSERT INTO slack_intake_events (event_id, request_id) VALUES (?, ?)"
      )
      .run(message.eventId, request.id);
    const duplicate =
      database
        .prepare(
          "INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body, official_agent_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING"
        )
        .run(
          request.id,
          message.eventId,
          message.messageTs,
          message.userId,
          message.userName,
          message.body,
          officialAssignee?.agentId ?? null
        ).changes === 0;
    if (existing) {
      database
        .prepare(
          `INSERT INTO tickets (request_id, assignee_id, reason)
           SELECT ?, NULL, ? WHERE ? = 1 AND ? = 0
           ON CONFLICT(request_id) DO NOTHING`
        )
        .run(
          request.id,
          "Request owner confirmed the SOP did not resolve the issue.",
          Number(confirmation.confirmed),
          Number(duplicate)
        );
      database.exec("COMMIT");
      return {
        accepted: true,
        duplicate,
        fallbackDeliveryRequestId: pendingFallback(request.id),
        queued: queuedForRequest(request.id),
      };
    }
    const match = matchApprovedSop(message.body);
    if (match) {
      database
        .prepare(
          "INSERT INTO ai_answers (request_id, version_id, body, status) VALUES (?, ?, ?, 'sending')"
        )
        .run(request.id, match.versionId, match.body);
      database.exec("COMMIT");
      return {
        accepted: true,
        deliveryRequestId: request.id,
        duplicate: false,
        queued: false,
      };
    }
    const ticket = database
      .prepare(
        "INSERT INTO tickets (request_id, assignee_id, reason, slack_error) VALUES (?, NULL, ?, ?) RETURNING id"
      )
      .get(
        request.id,
        "No approved SOP matched this request.",
        FALLBACK_PENDING_WARNING
      ) as { id: number };
    database
      .prepare(
        "INSERT INTO slack_fallback_deliveries (ticket_id, body, status, error) VALUES (?, ?, 'sending', ?)"
      )
      .run(ticket.id, FALLBACK_NOTICE_BODY, FALLBACK_PENDING_WARNING);
    database.exec("COMMIT");
    return {
      accepted: true,
      duplicate: false,
      fallbackDeliveryRequestId: request.id,
      queued: true,
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
};
