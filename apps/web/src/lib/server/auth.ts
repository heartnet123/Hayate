import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createHmac,
} from "node:crypto";
import { DatabaseSync } from "node:sqlite";

type Role = "admin" | "agent" | "revoked";
export interface User {
  id: number;
  email: string;
  role: Role;
}

type StoredUser = User & { password_hash: string; salt: string };

const sessionDuration = 60 * 60 * 24 * 7;
const hashPassword = (password: string, salt: string) =>
  scryptSync(password, salt, 64).toString("hex");
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const newSalt = () => randomBytes(16).toString("hex");
export const validEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) && email.length <= 254;
export const validPassword = (password: string) =>
  password.length >= 12 && password.length <= 128;
export const validSlackWorkspace = (workspace: string) =>
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}(?:\.slack\.com)?$/u.test(workspace);
export const validSlackChannel = (channel: string) =>
  /^(?:#[a-z0-9][a-z0-9_-]{1,79}|[CG][A-Z0-9]{8,})$/u.test(channel);
const aiMentionPattern =
  /(?:^|\s)@(?:ai|helpdesk(?:[-_]?ai)?)\b/iu;

export interface SlackEventPayload {
  challenge?: string;
  team_id?: string;
  event?: {
    bot_id?: string;
    channel?: string;
    subtype?: string;
    text?: string;
    thread_ts?: string;
    ts?: string;
    type?: string;
    user?: string;
    user_name?: string;
  };
  event_id?: string;
  simulate_slack_error?: boolean;
  type?: string;
  workspace?: string;
}

const parseSlackMessage = (
  payload: SlackEventPayload,
  settings: { workspace: string; channel: string }
) => {
  const { event } = payload;
  const messageTs = event?.ts?.trim();
  const userId = event?.user?.trim();
  const body = event?.text?.trim();
  if (!event || !messageTs || !userId || !body) {
    return null;
  }
  const validEnvelope = [
    Boolean(settings.workspace),
    (payload.team_id ?? payload.workspace) === settings.workspace,
    Boolean(payload.event_id?.trim()),
    event.type === "message" || event.type === "app_mention",
    !event.bot_id,
    !event.subtype,
    event.channel === settings.channel,
  ].every(Boolean);
  return validEnvelope ? { body, event, messageTs, userId } : null;
};

let database: DatabaseSync | undefined;
export const getDatabase = (): DatabaseSync => {
  if (database) {
    return database;
  }
  if (process.env.NODE_ENV === "production" && !process.env.HELPDESK_DB_PATH) {
    throw new Error(
      "Set HELPDESK_DB_PATH to a persistent directory for production."
    );
  }
  const db = new DatabaseSync(process.env.HELPDESK_DB_PATH ?? "local.db");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'revoked'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS slack_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      workspace TEXT NOT NULL,
      channel TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS slack_requests (
      id INTEGER PRIMARY KEY,
      workspace TEXT NOT NULL,
      channel TEXT NOT NULL,
      thread_ts TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      UNIQUE(workspace, channel, thread_ts)
    );
    CREATE TABLE IF NOT EXISTS slack_messages (
      id INTEGER PRIMARY KEY,
      request_id INTEGER NOT NULL REFERENCES slack_requests(id),
      event_id TEXT NOT NULL UNIQUE,
      message_ts TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      body TEXT NOT NULL,
      UNIQUE(request_id, message_ts)
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY,
      request_id INTEGER NOT NULL UNIQUE REFERENCES slack_requests(id),
      assignee_id INTEGER REFERENCES users(id),
      reason TEXT NOT NULL,
      slack_error TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS official_replies (
      ticket_id INTEGER PRIMARY KEY REFERENCES tickets(id),
      agent_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('sending', 'failed', 'uncertain', 'sent')),
      slack_ts TEXT,
      error TEXT NOT NULL DEFAULT ''
    );
  `);
  const messageSchema = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'slack_messages'")
    .get() as { sql: string };
  if (messageSchema.sql.includes("UNIQUE(request_id, user_id, body)")) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`
        CREATE TABLE slack_messages_new (
          id INTEGER PRIMARY KEY,
          request_id INTEGER NOT NULL REFERENCES slack_requests(id),
          event_id TEXT NOT NULL UNIQUE,
          message_ts TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          body TEXT NOT NULL,
          UNIQUE(request_id, message_ts)
        );
        INSERT INTO slack_messages_new SELECT * FROM slack_messages;
        DROP TABLE slack_messages;
        ALTER TABLE slack_messages_new RENAME TO slack_messages;
        COMMIT;
      `);
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  if (!db.prepare("SELECT id FROM users WHERE role = ? LIMIT 1").get("admin")) {
    const email = process.env.HELPDESK_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.HELPDESK_ADMIN_PASSWORD;
    if (!(email && validEmail(email) && password && validPassword(password))) {
      throw new Error(
        "Set HELPDESK_ADMIN_EMAIL and HELPDESK_ADMIN_PASSWORD (12-128 characters) to create the first admin."
      );
    }
    const salt = newSalt();
    db.prepare(
      "INSERT INTO users (email, password_hash, salt, role) VALUES (?, ?, ?, ?)"
    ).run(email, hashPassword(password, salt), salt, "admin");
  }
  database = db;
  return db;
};

export const authenticate = (email: string, password: string): User | null => {
  if (!validEmail(email) || !validPassword(password)) {
    return null;
  }
  const user = getDatabase()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as StoredUser | undefined;
  if (!user) {
    return null;
  }
  const hash = Buffer.from(hashPassword(password, user.salt), "hex");
  if (
    !timingSafeEqual(hash, Buffer.from(user.password_hash, "hex")) ||
    user.role === "revoked"
  ) {
    return null;
  }
  return { email: user.email, id: user.id, role: user.role };
};

export const getUser = (token: string | undefined): User | null => {
  if (!token || !/^[a-f0-9]{64}$/u.test(token)) {
    return null;
  }
  const user = getDatabase()
    .prepare(`
    SELECT users.id, users.email, users.role FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE token_hash = ? AND expires_at > ? AND users.role != 'revoked'
  `)
    .get(hashToken(token), Math.floor(Date.now() / 1000)) as User | undefined;
  return user ?? null;
};

export const startSession = (user: User): string => {
  getDatabase()
    .prepare("DELETE FROM sessions WHERE expires_at <= ?")
    .run(Math.floor(Date.now() / 1000));
  const token = randomBytes(32).toString("hex");
  getDatabase()
    .prepare(
      "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)"
    )
    .run(
      hashToken(token),
      user.id,
      Math.floor(Date.now() / 1000) + sessionDuration
    );
  return token;
};

export const endSession = (token: string | undefined) => {
  if (token && /^[a-f0-9]{64}$/u.test(token)) {
    getDatabase()
      .prepare("DELETE FROM sessions WHERE token_hash = ?")
      .run(hashToken(token));
  }
};

export const cookie = {
  name: "helpdesk_session",
  options: {
    httpOnly: true,
    maxAge: sessionDuration,
    path: "/",
    sameSite: "lax",
  },
} as const;

export const listUsers = (): User[] =>
  getDatabase()
    .prepare("SELECT id, email, role FROM users ORDER BY email")
    .all() as unknown as User[];

export const createAgent = (email: string, password: string): boolean => {
  if (!validEmail(email) || !validPassword(password)) {
    return false;
  }
  const salt = newSalt();
  const result = getDatabase()
    .prepare(`
    INSERT INTO users (email, password_hash, salt, role) VALUES (?, ?, ?, 'agent')
    ON CONFLICT(email) DO NOTHING
  `)
    .run(email, hashPassword(password, salt), salt);
  return result.changes === 1;
};

export const changeAgentRole = (
  email: string,
  role: "agent" | "revoked"
): boolean => {
  getDatabase().exec("BEGIN IMMEDIATE");
  try {
    const result = getDatabase()
      .prepare(
        "UPDATE users SET role = ? WHERE email = ? AND role IN ('agent', 'revoked') AND role != ?"
      )
      .run(role, email, role);
    if (result.changes && role === "revoked") {
      getDatabase()
        .prepare(
          "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE email = ?)"
        )
        .run(email);
    }
    getDatabase().exec("COMMIT");
    return result.changes === 1;
  } catch (error) {
    getDatabase().exec("ROLLBACK");
    throw error;
  }
};

export const getSlackSettings = () => {
  const db = getDatabase();
  const row = db
    .prepare("SELECT workspace, channel FROM slack_settings WHERE id = 1")
    .get() as { channel: string; workspace: string } | undefined;
  const errorRow = db
    .prepare(
      "SELECT slack_error FROM tickets WHERE slack_error != '' ORDER BY id DESC LIMIT 1"
    )
    .get() as { slack_error: string } | undefined;
  return {
    channel: row?.channel ?? "#it-support",
    lastError: errorRow?.slack_error ?? "",
    workspace: row?.workspace ?? "",
  };
};

export const saveSlackSettings = (workspace: string, channel: string) =>
  getDatabase()
    .prepare(
      "INSERT INTO slack_settings (id, workspace, channel) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET workspace = excluded.workspace, channel = excluded.channel"
    )
    .run(workspace, channel);

export const verifySlackSignature = (
  rawBody: string,
  timestamp: string | null,
  signature: string | null
): boolean => {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (
    !(secret && timestamp && signature && /^\d+$/u.test(timestamp)) ||
    Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300
  ) {
    return false;
  }
  const expected = Buffer.from(
    `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`
  );
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

export const ingestSlackEvent = (payload: SlackEventPayload) => {
  const settings = getSlackSettings();
  const message = parseSlackMessage(payload, settings);
  if (!message) {
    return { accepted: false };
  }
  const { event, messageTs, userId, body } = message;
  const threadTs = (event.thread_ts ?? messageTs).trim();
  const userName = (event.user_name ?? userId).trim();
  const eventId = payload.event_id?.trim() ?? "";
  const slackError = payload.simulate_slack_error
    ? "Slack delivery failed; request queued in central queue."
    : "";

  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db
      .prepare(
        "SELECT id FROM slack_requests WHERE workspace = ? AND channel = ? AND thread_ts = ?"
      )
      .get(settings.workspace, settings.channel, threadTs) as
      | { id: number }
      | undefined;
    const mentioned = event.type === "app_mention" || aiMentionPattern.test(body);
    if (!existing && !mentioned) {
      db.exec("COMMIT");
      return { accepted: false };
    }
    if (existing && mentioned) {
      db.exec("COMMIT");
      return { accepted: true, duplicate: true, queued: true };
    }
    const requestRow =
      existing ??
      (db
        .prepare(
          "INSERT INTO slack_requests (workspace, channel, thread_ts, owner_id, owner_name) VALUES (?, ?, ?, ?, ?) RETURNING id"
        )
        .get(
          settings.workspace,
          settings.channel,
          threadTs,
          userId,
          userName
        ) as { id: number });
    const duplicate =
      db
        .prepare(
          "INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING"
        )
        .run(requestRow.id, eventId, messageTs, userId, userName, body)
        .changes === 0;
    db.prepare(
      "INSERT INTO tickets (request_id, assignee_id, reason, slack_error) VALUES (?, NULL, ?, ?) ON CONFLICT(request_id) DO UPDATE SET slack_error = CASE WHEN excluded.slack_error != '' THEN excluded.slack_error ELSE tickets.slack_error END"
    ).run(requestRow.id, "No approved SOP matched this request.", slackError);
    db.exec("COMMIT");
    return {
      accepted: true,
      duplicate,
      queued: true,
      ...(slackError ? { slackError } : {}),
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

export const listCentralQueue = () => {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        tickets.id,
        tickets.request_id AS requestId,
        tickets.reason,
        tickets.slack_error AS slackError,
        slack_requests.workspace,
        slack_requests.channel,
        slack_requests.thread_ts AS threadTs,
        slack_requests.owner_id AS ownerId,
        slack_requests.owner_name AS ownerName
      FROM tickets
      JOIN slack_requests ON slack_requests.id = tickets.request_id
      WHERE tickets.assignee_id IS NULL
      ORDER BY tickets.id ASC
    `)
    .all() as (Record<
    | "channel"
    | "ownerId"
    | "ownerName"
    | "reason"
    | "slackError"
    | "threadTs"
    | "workspace",
    string
  > & { id: number; requestId: number })[];
  const messageStmt = db.prepare(`
    SELECT id, message_ts AS messageTs, user_id AS userId, user_name AS userName, body
    FROM slack_messages
    WHERE request_id = ?
    ORDER BY message_ts ASC, id ASC
  `);
  return rows.map((row) => ({
    ...row,
    messages: messageStmt.all(row.requestId) as (Record<
      "body" | "messageTs" | "userId" | "userName",
      string
    > & { id: number })[],
  }));
};
