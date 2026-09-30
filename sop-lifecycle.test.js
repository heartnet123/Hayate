import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";

const directory = mkdtempSync(path.join(tmpdir(), "helpdesk-sop-http-"));
const databasePath = path.join(directory, "local.db");
const adminPassword = "secure-admin-password-2026";
let server;
let address;

const startServer = async () => {
  const port = 20_000 + Math.floor(Math.random() * 10_000);
  address = `http://127.0.0.1:${port}`;
  server = Bun.spawn(
    [
      "node",
      "node_modules/vite/bin/vite.js",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: path.join(import.meta.dir, "apps/web"),
      env: {
        ...process.env,
        HELPDESK_ADMIN_EMAIL: "admin@example.com",
        HELPDESK_ADMIN_PASSWORD: adminPassword,
        HELPDESK_DB_PATH: databasePath,
        NODE_ENV: "test",
      },
      stderr: "inherit",
      stdout: "ignore",
      windowsHide: true,
    }
  );
  const wait = async (attempt = 0) => {
    if (server.exitCode !== null || attempt === 80) {
      throw new Error("Web server did not start");
    }
    try {
      await fetch(`${address}/login`);
    } catch {
      await delay(200);
      await wait(attempt + 1);
    }
  };
  await wait();
};

const stopServer = async () => {
  if (server) {
    server.kill();
    await server.exited;
    server = undefined;
  }
};
const get = (route, cookie = "") =>
  fetch(`${address}${route}`, { headers: { cookie } });
const post = (route, fields, cookie = "") =>
  fetch(`${address}${route}`, {
    body: new URLSearchParams(fields),
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie,
      origin: address,
    },
    method: "POST",
    redirect: "manual",
  });
const login = async (email, password) => {
  const response = await post("/login", { email, password });
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
};
const moderationFields = (id, revision, title, body) => ({
  actorEmail: "spoof@example.com",
  body,
  id,
  revision,
  title,
});

afterEach(async () => {
  await stopServer();
  Bun.gc(true);
  rmSync(directory, { force: true, recursive: true });
});

test("HTTP SOP lifecycle enforces admin moderation and retains immutable history", async () => {
  await startServer();
  const adminCookie = await login("admin@example.com", adminPassword);
  await post(
    "/settings/roles?/create",
    { email: "agent@example.com", password: "temporary-password-2026" },
    adminCookie
  );
  const agentCookie = await login(
    "agent@example.com",
    "temporary-password-2026"
  );

  const created = await post(
    "/sop?/save",
    {
      body: "Approved snapshot body one",
      id: "",
      revision: "",
      title: "Power reset v1",
    },
    agentCookie
  );
  expect(created.status).toBe(303);
  const db = new DatabaseSync(databasePath);
  const initial = db.prepare("SELECT id FROM sops").get();
  const id = String(initial.id);
  const fields = moderationFields(
    id,
    "1",
    "Unsaved editor title",
    "Unsaved editor body"
  );

  const denied = await Promise.all([
    post("/sop?/approve", fields),
    post("/sop?/withdraw", fields),
    post("/sop?/approve", fields, agentCookie),
    post("/sop?/withdraw", fields, agentCookie),
  ]);
  expect(denied.map((response) => response.status)).toEqual([
    401, 401, 403, 403,
  ]);
  const missing = await post(
    "/sop?/approve",
    moderationFields("999999", "1", "Missing title", "Missing body"),
    adminCookie
  );
  expect(missing.status).toBe(409);
  expect(await missing.text()).toContain("Missing body");

  const approved = await post("/sop?/approve", fields, adminCookie);
  expect(approved.status).toBe(303);
  const approvedSop = db
    .prepare(
      "SELECT revision, status, active_version_id AS versionId FROM sops WHERE id = ?"
    )
    .get(id);
  expect(approvedSop).toMatchObject({ revision: 2, status: "active" });
  const firstVersionId = approvedSop.versionId;
  const approvalEvent = db
    .prepare(
      "SELECT action, actor_email AS actorEmail, created_at AS createdAt FROM sop_events"
    )
    .get();
  expect(approvalEvent).toMatchObject({
    action: "approved",
    actorEmail: "admin@example.com",
  });
  expect(approvalEvent.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/u);

  const duplicate = await post(
    "/sop?/approve",
    moderationFields(id, "2", "Duplicate title", "Duplicate body"),
    adminCookie
  );
  expect(duplicate.status).toBe(409);

  const edited = await post(
    "/sop?/save",
    {
      body: "Saved draft body two",
      id,
      revision: "2",
      title: "Power reset v2",
    },
    agentCookie
  );
  expect(edited.status).toBe(303);

  const loaded = await get(`/sop?id=${id}`, agentCookie);
  const loadedHtml = await loaded.text();
  expect(loadedHtml).toContain("Saved draft body two");
  expect(loadedHtml).toContain("Approved snapshot body one");
  expect(loadedHtml).toContain(approvalEvent.createdAt);

  db.exec(`
    CREATE TRIGGER fail_sop_audit BEFORE INSERT ON sop_events
    BEGIN SELECT RAISE(ABORT, 'private lifecycle detail'); END;
  `);
  const failed = await post(
    "/sop?/approve",
    moderationFields(
      id,
      "3",
      "Preserved editor title",
      "Preserved editor body"
    ),
    adminCookie
  );
  expect(failed.status).toBe(500);
  const failedHtml = await failed.text();
  expect(failedHtml).toContain("Preserved editor title");
  expect(failedHtml).toContain("Preserved editor body");
  expect(failedHtml).not.toContain("private lifecycle detail");
  db.exec("DROP TRIGGER fail_sop_audit");

  const secondApproval = await post(
    "/sop?/approve",
    moderationFields(id, "3", "Editor", "Editor"),
    adminCookie
  );
  expect(secondApproval.status).toBe(303);
  const active = db
    .prepare(
      "SELECT revision, active_version_id AS versionId FROM sops WHERE id = ?"
    )
    .get(id);
  expect(active.revision).toBe(4);
  expect(active.versionId).not.toBe(firstVersionId);
  const staleWithdrawal = await post(
    "/sop?/withdraw",
    moderationFields(id, "3", "Stale", "Stale"),
    adminCookie
  );
  expect(staleWithdrawal.status).toBe(409);
  const withdrawal = await post(
    "/sop?/withdraw",
    moderationFields(id, "4", "Editor", "Editor"),
    adminCookie
  );
  expect(withdrawal.status).toBe(303);
  expect(db.prepare("SELECT status FROM sops").get()).toEqual({
    status: "withdrawn",
  });
  db.close();

  await stopServer();
  await startServer();
  const restartedAdmin = await login("admin@example.com", adminPassword);
  const persisted = await get(`/sop?id=${id}`, restartedAdmin);
  const persistedHtml = await persisted.text();
  expect(persistedHtml).toContain("Saved draft body two");
  expect(persistedHtml).toContain("withdrawn");
  expect(persistedHtml).toContain("admin@example.com");
}, 60_000);
