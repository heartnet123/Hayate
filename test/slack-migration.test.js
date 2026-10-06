import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test.each([
  "UNIQUE(request_id, user_id, body)",
  "UNIQUE(request_id, message_ts)",
])(
  "concurrent cold starts preserve Slack history with %s",
  async (uniqueConstraint) => {
    const directory = mkdtempSync(
      path.join(tmpdir(), "helpdesk-slack-migration-")
    );
    const dbPath = path.join(directory, "legacy.db");
    const authUrl = pathToFileURL(
      path.join(import.meta.dir, "../apps/web/src/lib/server/auth.ts")
    ).href;
    const processes = [];
    let db = new Database(dbPath);
    const originalRows = () => ({
      messages: db
        .prepare(
          "SELECT id, request_id, event_id, message_ts, user_id, user_name, body FROM slack_messages WHERE id IN (17, 18) ORDER BY id"
        )
        .all(),
      notes: db.prepare("SELECT * FROM internal_notes ORDER BY id").all(),
      outbound: db
        .prepare("SELECT * FROM official_replies ORDER BY ticket_id")
        .all(),
      requests: db.prepare("SELECT * FROM slack_requests ORDER BY id").all(),
      tickets: db
        .prepare(
          "SELECT id, request_id, assignee_id, reason, slack_error FROM tickets ORDER BY id"
        )
        .all(),
      users: db.prepare("SELECT * FROM users ORDER BY id").all(),
    });
    const coldStart = async () => {
      const running = Bun.spawn(
        [
          "node",
          "--input-type=module",
          "--eval",
          `import { getDatabase } from ${JSON.stringify(authUrl)}; getDatabase().close();`,
        ],
        {
          env: {
            ...process.env,
            HELPDESK_DB_PATH: dbPath,
            NODE_ENV: "test",
          },
          stderr: "pipe",
          stdout: "ignore",
        }
      );
      processes.push(running);
      const [exitCode, stderr] = await Promise.all([
        running.exited,
        new Response(running.stderr).text(),
      ]);
      expect({ exitCode, stderr: exitCode === 0 ? "" : stderr }).toEqual({
        exitCode: 0,
        stderr: "",
      });
    };

    try {
      db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL, salt TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'revoked'))
      );
      CREATE TABLE slack_requests (
        id INTEGER PRIMARY KEY, workspace TEXT NOT NULL, channel TEXT NOT NULL,
        thread_ts TEXT NOT NULL, owner_id TEXT NOT NULL, owner_name TEXT NOT NULL,
        UNIQUE(workspace, channel, thread_ts)
      );
      CREATE TABLE slack_messages (
        id INTEGER PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES slack_requests(id),
        event_id TEXT NOT NULL UNIQUE, message_ts TEXT NOT NULL,
        user_id TEXT NOT NULL, user_name TEXT NOT NULL, body TEXT NOT NULL,
        ${uniqueConstraint}
      );
      CREATE TABLE tickets (
        id INTEGER PRIMARY KEY,
        request_id INTEGER NOT NULL UNIQUE REFERENCES slack_requests(id),
        assignee_id INTEGER REFERENCES users(id), reason TEXT NOT NULL,
        slack_error TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE official_replies (
        ticket_id INTEGER PRIMARY KEY REFERENCES tickets(id),
        agent_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('sending', 'failed', 'uncertain', 'sent')),
        slack_ts TEXT, error TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE internal_notes (
        id INTEGER PRIMARY KEY, ticket_id INTEGER NOT NULL REFERENCES tickets(id),
        author_id INTEGER NOT NULL REFERENCES users(id), body TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      INSERT INTO users VALUES
        (1, 'admin@example.com', 'admin-hash', 'admin-salt', 'admin'),
        (2, 'assignee@example.com', 'agent-hash', 'agent-salt', 'agent'),
        (3, 'next-agent@example.com', 'next-hash', 'next-salt', 'agent');
      INSERT INTO slack_requests VALUES
        (11, 'T_LEGACY', 'C_LEGACY', '1700000000.000001', 'U_REQUESTER', 'Legacy requester');
      INSERT INTO slack_messages VALUES
        (17, 11, 'legacy-request', '1700000000.000001', 'U_REQUESTER', 'Legacy requester', 'Original request'),
        (18, 11, 'legacy-answer', '1700000001.000001', 'U_ASSIGNEE', 'Legacy assignee', 'Existing reply text');
      INSERT INTO tickets VALUES (22, 11, 2, 'Legacy escalation', 'Legacy transport detail');
      INSERT INTO official_replies VALUES (22, 2, 'Legacy sent reply', 'sent', '1700000002.000001', '');
      INSERT INTO internal_notes VALUES (33, 22, 3, 'Private legacy note', '2024-01-02T03:04:05.678Z');
    `);
      const original = originalRows();
      db.close(true);

      await Promise.all([coldStart(), coldStart()]);
      db = new Database(dbPath);
      expect(originalRows()).toEqual(original);
      expect(
        db
          .prepare("SELECT official_agent_id FROM slack_messages ORDER BY id")
          .all()
      ).toEqual([{ official_agent_id: null }, { official_agent_id: null }]);
      expect(
        db
          .prepare(
            "SELECT type FROM pragma_table_info('tickets') WHERE name = 'assigned_at'"
          )
          .get().type
      ).toBe("REAL");
      const assignedAt = db
        .prepare("SELECT assigned_at FROM tickets WHERE id = 22")
        .get().assigned_at;
      expect(assignedAt).toBeGreaterThan(1_000_000_000);
      expect(assignedAt).toBeLessThanOrEqual(Date.now() / 1000 + 1);
      const uniqueColumns = db
        .prepare("PRAGMA index_list(slack_messages)")
        .all()
        .filter((index) => index.unique)
        .map((index) =>
          db
            .prepare("SELECT name FROM pragma_index_info(?) ORDER BY seqno")
            .all(index.name)
            .map((column) => column.name)
            .join(",")
        )
        .toSorted();
      expect(uniqueColumns).toEqual(["event_id", "request_id,message_ts"]);

      const insertMessage = db.prepare(`
      INSERT INTO slack_messages
        (request_id, event_id, message_ts, user_id, user_name, body, official_agent_id)
      VALUES (11, ?, ?, 'U_ASSIGNEE', 'Legacy assignee', 'Existing reply text', 3)
    `);
      insertMessage.run("new-answer", "1700000003.000001");
      expect(() =>
        insertMessage.run("new-answer", "1700000004.000001")
      ).toThrow();
      expect(() =>
        insertMessage.run("duplicate-time", "1700000003.000001")
      ).toThrow();
      expect(
        db.prepare("SELECT count(*) AS total FROM slack_messages").get().total
      ).toBe(3);
      expect(
        db.prepare("SELECT count(*) AS total FROM slack_identities").get().total
      ).toBe(0);
      db.prepare(
        "INSERT INTO slack_identities (user_id, workspace, slack_user_id) VALUES (2, 'T_LEGACY', 'U_ASSIGNEE')"
      ).run();

      db.prepare("UPDATE tickets SET assigned_at = 1 WHERE id = 22").run();
      const reassignmentStartedAt = Date.now() / 1000;
      db.prepare("UPDATE tickets SET assignee_id = 3 WHERE id = 22").run();
      const reassignedAt = db
        .prepare("SELECT assigned_at FROM tickets WHERE id = 22")
        .get().assigned_at;
      expect(reassignedAt).toBeGreaterThanOrEqual(reassignmentStartedAt - 1);
      expect(reassignedAt).toBeLessThanOrEqual(Date.now() / 1000 + 1);
      original.tickets[0].assignee_id = 3;
      db.close(true);

      await coldStart();
      db = new Database(dbPath);
      expect(originalRows()).toEqual(original);
      expect(
        db.prepare("SELECT assigned_at FROM tickets WHERE id = 22").get()
          .assigned_at
      ).toBe(reassignedAt);
      expect(
        db
          .prepare(
            "SELECT event_id, body, official_agent_id FROM slack_messages WHERE event_id = 'new-answer'"
          )
          .get()
      ).toEqual({
        body: "Existing reply text",
        event_id: "new-answer",
        official_agent_id: 3,
      });
      expect(db.prepare("SELECT * FROM slack_identities").all()).toEqual([
        { slack_user_id: "U_ASSIGNEE", user_id: 2, workspace: "T_LEGACY" },
      ]);
    } finally {
      db?.close(true);
      for (const running of processes) {
        if (running.exitCode === null) {
          running.kill();
        }
      }
      await Promise.all(processes.map((running) => running.exited));
      rmSync(directory, { force: true, recursive: true });
    }
  }
);
