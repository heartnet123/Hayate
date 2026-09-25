import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
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
  /^#[a-z0-9][a-z0-9_-]{1,79}$/u.test(channel);

let database: DatabaseSync | undefined;
const getDatabase = (): DatabaseSync => {
  if (database) {
    return database;
  }
  if (process.env.NODE_ENV === "production" && !process.env.HELPDESK_DB_PATH) {
    throw new Error(
      "Set HELPDESK_DB_PATH to a persistent directory for production."
    );
  }
  const db = new DatabaseSync(process.env.HELPDESK_DB_PATH ?? "local.db");
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
  `);
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

export const getSlackSettings = () =>
  (getDatabase()
    .prepare("SELECT workspace, channel FROM slack_settings WHERE id = 1")
    .get() as { channel: string; workspace: string } | undefined) ?? {
    channel: "#it-support",
    workspace: "",
  };

export const saveSlackSettings = (workspace: string, channel: string) =>
  getDatabase()
    .prepare(
      "INSERT INTO slack_settings (id, workspace, channel) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET workspace = excluded.workspace, channel = excluded.channel"
    )
    .run(workspace, channel);
