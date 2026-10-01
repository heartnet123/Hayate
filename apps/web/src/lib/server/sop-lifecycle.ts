import { getDatabase } from "$lib/server/auth";
import { ensureSopSchema } from "$lib/server/sop-schema";

export interface SopLifecycleInput {
  readonly actorId: number;
  readonly revision: number;
  readonly sopId: number;
}

export type SopLifecycleResult =
  | {
      readonly kind: "approved";
      readonly revision: number;
      readonly versionId: number;
    }
  | {
      readonly kind: "withdrawn";
      readonly revision: number;
      readonly versionId: number;
    }
  | { readonly kind: "conflict" }
  | { readonly kind: "forbidden" };

const actorEmail = (actorId: number): string | null => {
  const actor = getDatabase()
    .prepare("SELECT email FROM users WHERE id = ? AND role = 'admin'")
    .get(actorId);
  return actor && typeof actor.email === "string" ? actor.email : null;
};

export const approveSop = (input: SopLifecycleInput): SopLifecycleResult => {
  ensureSopSchema();
  const database = getDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    const email = actorEmail(input.actorId);
    if (email === null) {
      database.exec("ROLLBACK");
      return { kind: "forbidden" };
    }
    const sop = database
      .prepare(
        `SELECT title, body, status, active_version_id AS activeVersionId
         FROM sops WHERE id = ? AND revision = ?`
      )
      .get(input.sopId, input.revision);
    if (!sop || typeof sop.title !== "string" || typeof sop.body !== "string") {
      database.exec("ROLLBACK");
      return { kind: "conflict" };
    }
    if (sop.status === "active" && typeof sop.activeVersionId === "number") {
      const active = database
        .prepare("SELECT title, body FROM sop_versions WHERE id = ?")
        .get(sop.activeVersionId);
      if (active?.title === sop.title && active.body === sop.body) {
        database.exec("ROLLBACK");
        return { kind: "conflict" };
      }
    }
    const version = database
      .prepare(
        "INSERT INTO sop_versions (sop_id, title, body) VALUES (?, ?, ?)"
      )
      .run(input.sopId, sop.title, sop.body);
    const versionId = Number(version.lastInsertRowid);
    if (!Number.isSafeInteger(versionId) || versionId < 1) {
      throw new TypeError("Invalid SOP version identifier");
    }
    const event = database
      .prepare(
        `INSERT INTO sop_events (sop_id, version_id, actor_id, actor_email, action)
         VALUES (?, ?, ?, ?, 'approved')`
      )
      .run(input.sopId, versionId, input.actorId, email);
    if (event.changes !== 1) {
      throw new TypeError("SOP approval event was not recorded");
    }
    const updated = database
      .prepare(
        `UPDATE sops SET status = 'active', active_version_id = ?, revision = revision + 1,
          updated_by = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND revision = ?
           AND EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'admin')`
      )
      .run(
        versionId,
        input.actorId,
        input.sopId,
        input.revision,
        input.actorId
      );
    if (updated.changes !== 1) {
      const authorized = actorEmail(input.actorId) !== null;
      database.exec("ROLLBACK");
      return authorized ? { kind: "conflict" } : { kind: "forbidden" };
    }
    database.exec("COMMIT");
    return { kind: "approved", revision: input.revision + 1, versionId };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
};

export const withdrawSop = (input: SopLifecycleInput): SopLifecycleResult => {
  ensureSopSchema();
  const database = getDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    const email = actorEmail(input.actorId);
    if (email === null) {
      database.exec("ROLLBACK");
      return { kind: "forbidden" };
    }
    const sop = database
      .prepare(
        `SELECT status, active_version_id AS activeVersionId FROM sops
         WHERE id = ? AND revision = ?`
      )
      .get(input.sopId, input.revision);
    if (sop?.status !== "active" || typeof sop.activeVersionId !== "number") {
      database.exec("ROLLBACK");
      return { kind: "conflict" };
    }
    const event = database
      .prepare(
        `INSERT INTO sop_events (sop_id, version_id, actor_id, actor_email, action)
         VALUES (?, ?, ?, ?, 'withdrawn')`
      )
      .run(input.sopId, sop.activeVersionId, input.actorId, email);
    if (event.changes !== 1) {
      throw new TypeError("SOP withdrawal event was not recorded");
    }
    const updated = database
      .prepare(
        `UPDATE sops SET status = 'withdrawn', revision = revision + 1, updated_by = ?,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ? AND revision = ? AND status = 'active'
           AND EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'admin')`
      )
      .run(input.actorId, input.sopId, input.revision, input.actorId);
    if (updated.changes !== 1) {
      const authorized = actorEmail(input.actorId) !== null;
      database.exec("ROLLBACK");
      return authorized ? { kind: "conflict" } : { kind: "forbidden" };
    }
    database.exec("COMMIT");
    return {
      kind: "withdrawn",
      revision: input.revision + 1,
      versionId: sop.activeVersionId,
    };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
};
