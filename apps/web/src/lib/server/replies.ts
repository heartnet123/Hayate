import { getDatabase } from "./auth";

interface SendResult {
  status: "sent" | "failed" | "uncertain" | "forbidden" | "conflict";
  message: string;
}

const readSlackResult = async (response: Response, channel: unknown) => {
  if (!response.ok) {
    throw new Error(
      "Slack returned an HTTP error without delivery confirmation."
    );
  }
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("ok" in result)) {
    throw new Error("Slack returned an invalid response.");
  }
  if (result.ok !== true) {
    const code =
      "error" in result && typeof result.error === "string"
        ? result.error
        : "unknown_error";
    if (code === "internal_error" || code === "fatal_error") {
      throw new Error("Slack may have accepted the message.");
    }
    return { error: code, ts: "" };
  }
  if (
    !(
      "ts" in result &&
      typeof result.ts === "string" &&
      /^\d+\.\d+$/u.test(result.ts) &&
      "channel" in result &&
      result.channel === channel
    )
  ) {
    throw new Error("Slack acknowledgement did not match the source thread.");
  }
  return { error: "", ts: result.ts };
};

export const sendOfficialReply = async (
  ticketId: number,
  agentId: number,
  body: string
): Promise<SendResult> => {
  const db = getDatabase();
  const ticket = db
    .prepare(`
    SELECT tickets.assignee_id AS assigneeId, slack_requests.channel, slack_requests.thread_ts AS threadTs
    FROM tickets JOIN slack_requests ON slack_requests.id = tickets.request_id
    WHERE tickets.id = ?
  `)
    .get(ticketId);
  if (ticket?.assigneeId !== agentId) {
    return {
      message: "Only the current assignee can send this reply.",
      status: "forbidden",
    };
  }
  const existing = db
    .prepare("SELECT status FROM official_replies WHERE ticket_id = ?")
    .get(ticketId);
  if (existing && existing.status !== "failed") {
    return {
      message:
        "Reply already sent or delivery is uncertain. Do not resend until reconciled.",
      status: "conflict",
    };
  }
  db.prepare(`
    INSERT INTO official_replies (ticket_id, agent_id, body, status, slack_ts, error)
    VALUES (?, ?, ?, 'sending', NULL, '')
    ON CONFLICT(ticket_id) DO UPDATE SET agent_id = excluded.agent_id, body = excluded.body,
      status = 'sending', slack_ts = NULL, error = '' WHERE official_replies.status = 'failed'
  `).run(ticketId, agentId, body);

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    db.prepare(
      "UPDATE official_replies SET status = 'failed', error = 'Slack bot token not configured.' WHERE ticket_id = ?"
    ).run(ticketId);
    return {
      message:
        "Slack bot token not configured. Draft saved; retry after configuration.",
      status: "failed",
    };
  }

  try {
    const response = await fetch(
      process.env.SLACK_API_URL ?? "https://slack.com/api/chat.postMessage",
      {
        body: JSON.stringify({
          channel: ticket.channel,
          text: body,
          thread_ts: ticket.threadTs,
          unfurl_links: false,
        }),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      }
    );
    const result = await readSlackResult(response, ticket.channel);
    if (result.error) {
      db.prepare(
        "UPDATE official_replies SET status = 'failed', error = ? WHERE ticket_id = ?"
      ).run(`Slack rejected reply: ${result.error}`, ticketId);
      return {
        message: "Slack rejected the reply. Draft saved; retry when ready.",
        status: "failed",
      };
    }
    db.prepare(
      "UPDATE official_replies SET status = 'sent', slack_ts = ? WHERE ticket_id = ?"
    ).run(result.ts, ticketId);
    return { message: "Official reply delivered to Slack.", status: "sent" };
  } catch {
    db.prepare(
      "UPDATE official_replies SET status = 'uncertain', error = 'Delivery not confirmed; do not retry automatically.' WHERE ticket_id = ? AND status = 'sending'"
    ).run(ticketId);
    return {
      message:
        "Delivery not confirmed. Draft saved; check Slack before trying again.",
      status: "uncertain",
    };
  }
};
