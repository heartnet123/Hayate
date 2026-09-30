import { getDatabase } from "$lib/server/auth";

export const SOP_TITLE_MAX_LENGTH = 200;
export const SOP_BODY_MAX_LENGTH = 20_000;

export interface SopDraft {
  readonly body: string;
  readonly id: number;
  readonly revision: number;
  readonly status: "draft";
  readonly title: string;
}

export interface SaveSopDraftInput {
  readonly actorId: number;
  readonly body: string;
  readonly id: number | null;
  readonly revision: number | null;
  readonly title: string;
}

export type SaveSopDraftResult =
  | { readonly kind: "saved"; readonly id: number }
  | { readonly kind: "conflict" }
  | { readonly kind: "forbidden" };

let schemaReady = false;

const ensureSchema = (): void => {
  if (schemaReady) {
    return;
  }
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS sops (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'withdrawn')),
      revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
      created_by INTEGER NOT NULL REFERENCES users(id),
      updated_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  schemaReady = true;
};

const isSopDraft = (value: unknown): value is SopDraft =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "number" &&
  Number.isSafeInteger(value.id) &&
  "revision" in value &&
  typeof value.revision === "number" &&
  Number.isSafeInteger(value.revision) &&
  "title" in value &&
  typeof value.title === "string" &&
  "body" in value &&
  typeof value.body === "string" &&
  "status" in value &&
  value.status === "draft";

const parseSopDraft = (value: unknown): SopDraft => {
  if (!isSopDraft(value)) {
    throw new TypeError("Invalid SOP draft row");
  }
  return value;
};

export const listSopDrafts = (): readonly SopDraft[] => {
  ensureSchema();
  return getDatabase()
    .prepare(
      `SELECT id, title, body, status, revision
       FROM sops
       WHERE status = 'draft'
       ORDER BY updated_at DESC, id DESC`
    )
    .all()
    .map(parseSopDraft);
};

export const getSopDraft = (id: number): SopDraft | null => {
  ensureSchema();
  const row = getDatabase()
    .prepare(
      `SELECT id, title, body, status, revision
       FROM sops
       WHERE id = ? AND status = 'draft'`
    )
    .get(id);
  return row === undefined ? null : parseSopDraft(row);
};

export const saveSopDraft = (input: SaveSopDraftInput): SaveSopDraftResult => {
  ensureSchema();
  const database = getDatabase();
  if (input.id === null || input.revision === null) {
    const result = database
      .prepare(
        `INSERT INTO sops (title, body, created_by, updated_by)
         SELECT ?, ?, id, id FROM users
         WHERE id = ? AND role IN ('admin', 'agent')`
      )
      .run(input.title, input.body, input.actorId);
    if (result.changes !== 1) {
      return { kind: "forbidden" };
    }
    const id = Number(result.lastInsertRowid);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new TypeError("Invalid SOP identifier");
    }
    return { id, kind: "saved" };
  }
  const result = database
    .prepare(
      `UPDATE sops
       SET title = ?, body = ?, revision = revision + 1, updated_by = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND revision = ? AND status = 'draft'
          AND EXISTS (SELECT 1 FROM users WHERE id = ? AND role IN ('admin', 'agent'))`
    )
    .run(
      input.title,
      input.body,
      input.actorId,
      input.id,
      input.revision,
      input.actorId
    );
  if (result.changes === 1) {
    return { id: input.id, kind: "saved" };
  }
  if (
    !database
      .prepare(
        "SELECT id FROM users WHERE id = ? AND role IN ('admin', 'agent')"
      )
      .get(input.actorId)
  ) {
    return { kind: "forbidden" };
  }
  return { kind: "conflict" };
};
