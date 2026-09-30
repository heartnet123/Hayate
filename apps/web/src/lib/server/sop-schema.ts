import { getDatabase } from "$lib/server/auth";

let schemaReady = false;

export const ensureSopSchema = (): void => {
  if (schemaReady) {
    return;
  }
  const database = getDatabase();
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS sops (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'withdrawn')),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
        created_by INTEGER NOT NULL REFERENCES users(id),
        updated_by INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE TABLE IF NOT EXISTS sop_versions (
        id INTEGER PRIMARY KEY,
        sop_id INTEGER NOT NULL REFERENCES sops(id),
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
    if (
      !database
        .prepare("PRAGMA table_info(sops)")
        .all()
        .some((column) => column.name === "active_version_id")
    ) {
      database.exec(
        "ALTER TABLE sops ADD COLUMN active_version_id INTEGER REFERENCES sop_versions(id)"
      );
    }
    database.exec(`
      CREATE TABLE IF NOT EXISTS sop_events (
        id INTEGER PRIMARY KEY,
        sop_id INTEGER NOT NULL REFERENCES sops(id),
        version_id INTEGER REFERENCES sop_versions(id),
        actor_id INTEGER NOT NULL REFERENCES users(id),
        actor_email TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('approved', 'withdrawn')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE TABLE IF NOT EXISTS sop_answers (
        id INTEGER PRIMARY KEY,
        ticket_id INTEGER NOT NULL REFERENCES tickets(id),
        version_id INTEGER NOT NULL REFERENCES sop_versions(id),
        body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE TRIGGER IF NOT EXISTS immutable_sop_version_update
        BEFORE UPDATE ON sop_versions BEGIN SELECT RAISE(ABORT, 'SOP versions are immutable'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_sop_version_delete
        BEFORE DELETE ON sop_versions BEGIN SELECT RAISE(ABORT, 'SOP versions are immutable'); END;
      COMMIT;
    `);
    schemaReady = true;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
};
