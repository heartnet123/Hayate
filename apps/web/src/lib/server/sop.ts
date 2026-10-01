import { getDatabase } from "$lib/server/auth";
import { ensureSopSchema } from "$lib/server/sop-schema";

export const SOP_TITLE_MAX_LENGTH = 200;
export const SOP_BODY_MAX_LENGTH = 20_000;

export type SopStatus = "draft" | "active" | "withdrawn";

export interface Sop {
  readonly activeVersionId: number | null;
  readonly body: string;
  readonly id: number;
  readonly revision: number;
  readonly status: SopStatus;
  readonly title: string;
}

export interface SopVersion {
  readonly body: string;
  readonly createdAt: string;
  readonly id: number;
  readonly sopId: number;
  readonly title: string;
}

export interface SopLifecycleEvent {
  readonly action: "approved" | "withdrawn";
  readonly actorEmail: string;
  readonly createdAt: string;
  readonly id: number;
  readonly versionId: number | null;
}

export interface SopDetail extends Sop {
  readonly activeVersion: SopVersion | null;
  readonly events: readonly SopLifecycleEvent[];
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

const isStatus = (value: unknown): value is SopStatus =>
  value === "draft" || value === "active" || value === "withdrawn";

const parseSop = (value: unknown): Sop => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "number" ||
    !("revision" in value) ||
    typeof value.revision !== "number" ||
    !("title" in value) ||
    typeof value.title !== "string" ||
    !("body" in value) ||
    typeof value.body !== "string" ||
    !("status" in value) ||
    !isStatus(value.status) ||
    !("activeVersionId" in value) ||
    (value.activeVersionId !== null &&
      typeof value.activeVersionId !== "number")
  ) {
    throw new TypeError("Invalid SOP row");
  }
  return {
    activeVersionId: value.activeVersionId,
    body: value.body,
    id: value.id,
    revision: value.revision,
    status: value.status,
    title: value.title,
  };
};

const sopSelect = `SELECT id, title, body, status, revision,
  active_version_id AS activeVersionId FROM sops`;

export const listSops = (): readonly Sop[] => {
  ensureSopSchema();
  return getDatabase()
    .prepare(`${sopSelect} ORDER BY updated_at DESC, id DESC`)
    .all()
    .map(parseSop);
};

export const getSop = (id: number): SopDetail | null => {
  ensureSopSchema();
  const database = getDatabase();
  const row = database.prepare(`${sopSelect} WHERE id = ?`).get(id);
  if (row === undefined) {
    return null;
  }
  const sop = parseSop(row);
  const activeVersionRow =
    sop.activeVersionId === null
      ? undefined
      : database
          .prepare(
            `SELECT id, sop_id AS sopId, title, body, created_at AS createdAt
             FROM sop_versions WHERE id = ?`
          )
          .get(sop.activeVersionId);
  const activeVersion =
    activeVersionRow === undefined
      ? null
      : {
          body: String(activeVersionRow.body),
          createdAt: String(activeVersionRow.createdAt),
          id: Number(activeVersionRow.id),
          sopId: Number(activeVersionRow.sopId),
          title: String(activeVersionRow.title),
        };
  const events = database
    .prepare(
      `SELECT id, version_id AS versionId, actor_email AS actorEmail, action,
        created_at AS createdAt FROM sop_events WHERE sop_id = ? ORDER BY id DESC`
    )
    .all(id)
    .map((event): SopLifecycleEvent => {
      if (event.action !== "approved" && event.action !== "withdrawn") {
        throw new TypeError("Invalid SOP lifecycle event");
      }
      return {
        action: event.action,
        actorEmail: String(event.actorEmail),
        createdAt: String(event.createdAt),
        id: Number(event.id),
        versionId: event.versionId === null ? null : Number(event.versionId),
      };
    });
  return { ...sop, activeVersion, events };
};

export const saveSopDraft = (input: SaveSopDraftInput): SaveSopDraftResult => {
  ensureSopSchema();
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
       WHERE id = ? AND revision = ?
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
  const activeStaff = database
    .prepare("SELECT id FROM users WHERE id = ? AND role IN ('admin', 'agent')")
    .get(input.actorId);
  return activeStaff ? { kind: "conflict" } : { kind: "forbidden" };
};
