import { ensureAiAnswerSchema, matchApprovedSop } from "$lib/server/ai-answers";
import { getDatabase, getSlackSettings } from "$lib/server/auth";

const AI_MENTION = /(?:^|\s)@(?:ai|helpdesk(?:[-_]?ai)?)\b/iu;
const HUMAN_MESSAGE_SUBTYPES = new Set([
  "thread_broadcast",
  "file_share",
  "me_message",
]);
const SLACK_TIMESTAMP = /^\d+\.\d{1,6}$/u;

interface SlackEvent {
  readonly bot_id?: unknown;
  readonly channel?: unknown;
  readonly subtype?: unknown;
  readonly text?: unknown;
  readonly thread_ts?: unknown;
  readonly ts?: unknown;
  readonly type?: unknown;
  readonly user?: unknown;
  readonly user_name?: unknown;
}

interface SlackMessage {
  readonly body: string;
  readonly eventId: string;
  readonly messageTs: string;
  readonly threadTs: string;
  readonly type: "app_mention" | "message";
  readonly userId: string;
  readonly userName: string;
}

export interface SlackIntakeResult {
  readonly accepted: boolean;
  readonly deliveryRequestId?: number;
  readonly duplicate?: boolean;
  readonly queued?: boolean;
  readonly slackError?: string;
}

const field = (value: object, key: string): unknown =>
  key in value ? Reflect.get(value, key) : undefined;

const parseEvent = (value: unknown): SlackEvent | null =>
  typeof value === "object" && value !== null ? value : null;

const validTimestamp = (value: string): boolean =>
  SLACK_TIMESTAMP.test(value) &&
  Number(value) > 0 &&
  !Number.isNaN(new Date(Number(value) * 1000).getTime());

const simulatedSlackError = (payload: unknown): boolean =>
  typeof payload === "object" &&
  payload !== null &&
  field(payload, "simulate_slack_error") === true;

const parseSlackMessage = (
  payload: unknown,
  settings: { readonly channel: string; readonly workspace: string }
): SlackMessage | null => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const event = parseEvent(field(payload, "event"));
  if (event === null) {
    return null;
  }
  const eventIdValue = field(payload, "event_id");
  const teamValue = field(payload, "team_id") ?? field(payload, "workspace");
  const eventId = typeof eventIdValue === "string" ? eventIdValue.trim() : "";
  const messageTs = typeof event.ts === "string" ? event.ts.trim() : "";
  const userId = typeof event.user === "string" ? event.user.trim() : "";
  const body = typeof event.text === "string" ? event.text.trim() : "";
  const threadTs =
    typeof event.thread_ts === "string" ? event.thread_ts.trim() : messageTs;
  const type =
    event.type === "message" || event.type === "app_mention"
      ? event.type
      : null;
  const subtypeAllowed =
    event.subtype === undefined ||
    (typeof event.subtype === "string" &&
      HUMAN_MESSAGE_SUBTYPES.has(event.subtype));
  const validEnvelope = [
    Boolean(settings.workspace),
    teamValue === settings.workspace,
    event.channel === settings.channel,
    Boolean(eventId),
    Boolean(type),
    event.bot_id === undefined,
    subtypeAllowed,
    Boolean(userId),
    Boolean(body),
    event.thread_ts === undefined || typeof event.thread_ts === "string",
    validTimestamp(messageTs),
    validTimestamp(threadTs),
  ].every(Boolean);
  if (!(validEnvelope && type)) {
    return null;
  }
  return {
    body,
    eventId,
    messageTs,
    threadTs,
    type,
    userId,
    userName:
      typeof event.user_name === "string" && event.user_name.trim()
        ? event.user_name.trim()
        : userId,
  };
};

const queuedForRequest = (requestId: number): boolean =>
  getDatabase()
    .prepare("SELECT id FROM tickets WHERE request_id = ?")
    .get(requestId) !== undefined;

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
    if (existing && mentioned && !officialAssignee) {
      database
        .prepare(
          "INSERT INTO slack_intake_events (event_id, request_id) VALUES (?, ?)"
        )
        .run(message.eventId, existing.id);
      database.exec("COMMIT");
      return {
        accepted: true,
        duplicate: true,
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
      database.exec("COMMIT");
      return {
        accepted: true,
        duplicate,
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
    const slackError = simulatedSlackError(payload)
      ? "Slack delivery failed; request queued in central queue."
      : "";
    database
      .prepare(
        "INSERT INTO tickets (request_id, assignee_id, reason, slack_error) VALUES (?, NULL, ?, ?)"
      )
      .run(request.id, "No approved SOP matched this request.", slackError);
    database.exec("COMMIT");
    return {
      accepted: true,
      duplicate: false,
      queued: true,
      ...(slackError ? { slackError } : {}),
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
};
