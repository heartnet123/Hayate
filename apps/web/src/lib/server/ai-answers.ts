import { getDatabase } from "$lib/server/auth";
import { SOP_TITLE_MAX_LENGTH } from "$lib/server/sop";
import { listEligibleSops } from "$lib/server/sop-answers";
import type { EligibleSop } from "$lib/server/sop-answers";
import { ensureSopSchema } from "$lib/server/sop-schema";

const MAX_ANSWER_BODY_LENGTH = 4000;
const LEADING_BOT_MENTION = /^(?:<@[^>\s]+>|(?:@helpdesk-ai|@ai)(?=\s|$))/iu;

export type AiAnswerStatus = "failed" | "sending" | "sent" | "uncertain";

export interface AiDelivery {
  readonly answerBody: string;
  readonly channel: string;
  readonly createdAt: string;
  readonly error: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly requestId: number;
  readonly sentAt: string | null;
  readonly sopBody: string;
  readonly sopTitle: string;
  readonly status: AiAnswerStatus;
  readonly threadTs: string;
  readonly versionId: number;
  readonly workspace: string;
}

let schemaReady = false;

export const ensureAiAnswerSchema = (): void => {
  if (schemaReady) {
    return;
  }
  ensureSopSchema();
  const database = getDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS ai_answers (
        request_id INTEGER PRIMARY KEY REFERENCES slack_requests(id),
        version_id INTEGER NOT NULL REFERENCES sop_versions(id),
        body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND ${MAX_ANSWER_BODY_LENGTH}),
        status TEXT NOT NULL CHECK (status IN ('sending', 'failed', 'uncertain', 'sent')),
        error TEXT NOT NULL DEFAULT '',
        dispatch_claimed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        slack_ts TEXT,
        sent_at TEXT,
        CHECK (
          (status = 'sent' AND slack_ts IS NOT NULL AND sent_at IS NOT NULL
            AND length(slack_ts) > 0 AND length(sent_at) > 0)
          OR
          (status != 'sent' AND slack_ts IS NULL AND sent_at IS NULL)
        )
      );
      CREATE TABLE IF NOT EXISTS slack_intake_events (
        event_id TEXT PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES slack_requests(id)
      );
    `);
    if (
      !database
        .prepare("PRAGMA table_info(ai_answers)")
        .all()
        .some((column) => column.name === "dispatch_claimed_at")
    ) {
      // Legacy sending rows may already have reached Slack; never make them retryable.
      database.exec(`
        ALTER TABLE ai_answers ADD COLUMN dispatch_claimed_at TEXT;
        UPDATE ai_answers SET dispatch_claimed_at = created_at WHERE status = 'sending';
      `);
    }
    database.exec("COMMIT");
    schemaReady = true;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
};

const normalizeTitle = (value: string): string =>
  value.trim().replaceAll(/\s+/gu, " ").toLowerCase();

export const matchApprovedSop = (input: string): EligibleSop | null => {
  const title = normalizeTitle(input.trim().replace(LEADING_BOT_MENTION, ""));
  if (title.length < 1 || title.length > SOP_TITLE_MAX_LENGTH) {
    return null;
  }
  const matches = listEligibleSops().filter(
    (sop) => normalizeTitle(sop.title) === title
  );
  const match = matches.length === 1 ? matches[0] : undefined;
  return match &&
    match.body.length > 0 &&
    match.body.length <= MAX_ANSWER_BODY_LENGTH
    ? match
    : null;
};

const parseStatus = (value: unknown): AiAnswerStatus => {
  if (
    value === "failed" ||
    value === "sending" ||
    value === "sent" ||
    value === "uncertain"
  ) {
    return value;
  }
  throw new TypeError("Stored AI answer has an invalid status");
};

export const listAiDeliveries = (): readonly AiDelivery[] => {
  ensureAiAnswerSchema();
  return getDatabase()
    .prepare(
      `SELECT ai_answers.request_id AS requestId,
        ai_answers.version_id AS versionId, ai_answers.body AS answerBody,
        ai_answers.status, ai_answers.error, ai_answers.created_at AS createdAt,
         ai_answers.sent_at AS sentAt,
        slack_requests.workspace, slack_requests.channel,
        slack_requests.thread_ts AS threadTs, slack_requests.owner_id AS ownerId,
        slack_requests.owner_name AS ownerName, sop_versions.title AS sopTitle,
        sop_versions.body AS sopBody
       FROM ai_answers
       JOIN slack_requests ON slack_requests.id = ai_answers.request_id
       JOIN sop_versions ON sop_versions.id = ai_answers.version_id
       ORDER BY ai_answers.created_at DESC, ai_answers.request_id DESC`
    )
    .all()
    .map((row) => ({
      answerBody: String(row.answerBody),
      channel: String(row.channel),
      createdAt: String(row.createdAt),
      error: String(row.error),
      ownerId: String(row.ownerId),
      ownerName: String(row.ownerName),
      requestId: Number(row.requestId),
      sentAt: typeof row.sentAt === "string" ? row.sentAt : null,
      sopBody: String(row.sopBody),
      sopTitle: String(row.sopTitle),
      status: parseStatus(row.status),
      threadTs: String(row.threadTs),
      versionId: Number(row.versionId),
      workspace: String(row.workspace),
    }));
};
