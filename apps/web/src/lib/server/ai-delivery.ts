import { matchApprovedSop } from "$lib/server/ai-answers";
import { getDatabase } from "$lib/server/auth";

const KNOWN_REJECTIONS = new Set([
  "channel_not_found",
  "invalid_auth",
  "missing_scope",
  "not_in_channel",
  "no_text",
  "rate_limited",
  "ratelimited",
]);
const SLACK_TIMESTAMP = /^\d+\.\d+$/u;

interface DeliveryResult {
  readonly queued: boolean;
  readonly status: "failed" | "sent" | "uncertain";
}

interface ReservedAnswer {
  readonly body: string;
  readonly channel: string;
  readonly initialBody: string;
  readonly status: string;
  readonly threadTs: string;
  readonly versionId: number;
}

const queueFailure = (
  requestId: number,
  status: "failed" | "uncertain",
  deliveryError: string
): DeliveryResult => {
  const database = getDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    const updated = database
      .prepare(
        "UPDATE ai_answers SET status = ?, error = ?, slack_ts = NULL, sent_at = NULL WHERE request_id = ? AND status = 'sending'"
      )
      .run(status, deliveryError, requestId);
    if (updated.changes === 1) {
      database
        .prepare(
          `INSERT INTO tickets (request_id, assignee_id, reason, slack_error)
           VALUES (?, NULL, 'AI answer delivery requires staff review.', ?)
           ON CONFLICT(request_id) DO UPDATE SET slack_error = excluded.slack_error`
        )
        .run(requestId, deliveryError);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { queued: true, status };
};

const reservedAnswer = (requestId: number): ReservedAnswer | null => {
  const row = getDatabase()
    .prepare(`
      SELECT ai_answers.version_id AS versionId, ai_answers.body,
        ai_answers.status, slack_requests.channel,
        slack_requests.thread_ts AS threadTs,
        initial_message.body AS initialBody
      FROM ai_answers
      JOIN slack_requests ON slack_requests.id = ai_answers.request_id
      JOIN slack_messages AS initial_message ON initial_message.id = (
        SELECT id FROM slack_messages WHERE request_id = ai_answers.request_id
        ORDER BY id ASC LIMIT 1
      )
      WHERE ai_answers.request_id = ?
    `)
    .get(requestId);
  if (!row) {
    return null;
  }
  return {
    body: String(row.body),
    channel: String(row.channel),
    initialBody: String(row.initialBody),
    status: String(row.status),
    threadTs: String(row.threadTs),
    versionId: Number(row.versionId),
  };
};

const readAcknowledgement = async (
  response: Response,
  channel: string
): Promise<{ readonly error: string; readonly ts: string } | null> => {
  if (response.status === 429) {
    return { error: "rate_limited", ts: "" };
  }
  if (!response.ok) {
    return null;
  }
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("ok" in result)) {
    return null;
  }
  if (result.ok !== true) {
    const code =
      "error" in result && typeof result.error === "string"
        ? result.error
        : "unknown_error";
    return KNOWN_REJECTIONS.has(code) ? { error: code, ts: "" } : null;
  }
  if (
    !("channel" in result) ||
    result.channel !== channel ||
    !("ts" in result) ||
    typeof result.ts !== "string" ||
    !SLACK_TIMESTAMP.test(result.ts) ||
    Number(result.ts) <= 0 ||
    Number.isNaN(new Date(Number(result.ts) * 1000).getTime())
  ) {
    return null;
  }
  return { error: "", ts: result.ts };
};

export const deliverAiAnswer = async (
  requestId: number
): Promise<DeliveryResult> => {
  const answer = reservedAnswer(requestId);
  if (answer === null || answer.status !== "sending") {
    return { queued: false, status: "uncertain" };
  }
  const eligible = matchApprovedSop(answer.initialBody);
  if (eligible === null || eligible.versionId !== answer.versionId) {
    return queueFailure(requestId, "failed", "eligibility_changed");
  }
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return queueFailure(requestId, "failed", "Slack bot token not configured.");
  }
  try {
    const response = await fetch(
      process.env.SLACK_API_URL ?? "https://slack.com/api/chat.postMessage",
      {
        body: JSON.stringify({
          channel: answer.channel,
          mrkdwn: false,
          parse: "none",
          text: answer.body,
          thread_ts: answer.threadTs,
          unfurl_links: false,
          unfurl_media: false,
        }),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      }
    );
    const acknowledgement = await readAcknowledgement(response, answer.channel);
    if (acknowledgement === null) {
      return queueFailure(
        requestId,
        "uncertain",
        "Delivery not confirmed; do not retry automatically."
      );
    }
    if (acknowledgement.error) {
      return queueFailure(
        requestId,
        "failed",
        `Slack rejected answer: ${acknowledgement.error}`
      );
    }
    getDatabase()
      .prepare(
        "UPDATE ai_answers SET status = 'sent', error = '', slack_ts = ?, sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE request_id = ? AND status = 'sending'"
      )
      .run(acknowledgement.ts, requestId);
    return { queued: false, status: "sent" };
  } catch {
    return queueFailure(
      requestId,
      "uncertain",
      "Delivery not confirmed; do not retry automatically."
    );
  }
};
