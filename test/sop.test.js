import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";

const directory = mkdtempSync(path.join(tmpdir(), "helpdesk-sop-"));
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
      cwd: path.join(import.meta.dir, "../apps/web"),
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

afterEach(async () => {
  await stopServer();
  Bun.gc(true);
  rmSync(directory, { force: true, recursive: true });
});

test("HTTP staff drafts survive edits and restart while rejected saves preserve input", async () => {
  await startServer();
  const adminCookie = await login("admin@example.com", adminPassword);
  expect(adminCookie).toContain("helpdesk_session=");

  const createAgent = await post(
    "/settings/roles?/create",
    { email: "agent@example.com", password: "temporary-password-2026" },
    adminCookie
  );
  expect(createAgent.status).toBe(200);
  const agentCookie = await login(
    "agent@example.com",
    "temporary-password-2026"
  );

  const guestSave = await post("/sop?/save", {
    body: "Guest content",
    id: "",
    revision: "",
    title: "Guest draft",
  });
  expect(guestSave.status).toBe(401);

  const created = await post(
    "/sop?/save",
    {
      body: "Disconnect power and hold the power button.",
      id: "",
      revision: "",
      title: "Laptop power reset",
    },
    adminCookie
  );
  expect(created.status).toBe(303);
  expect(created.headers.get("location")).toMatch(/^\/sop\?id=\d+$/u);

  const db = new DatabaseSync(databasePath);
  const draft = db
    .prepare("SELECT id, revision, status, title, body FROM sops")
    .get();
  expect(draft).toMatchObject({
    body: "Disconnect power and hold the power button.",
    revision: 1,
    status: "draft",
    title: "Laptop power reset",
  });
  const id = String(draft.id);

  const selected = await get(`/sop?id=${id}`, agentCookie);
  expect(selected.status).toBe(200);
  const selectedHtml = await selected.text();
  expect(selectedHtml).toContain("Laptop power reset");
  expect(selectedHtml).toContain("Disconnect power and hold the power button.");

  const updated = await post(
    "/sop?/save",
    {
      body: "Updated procedure from support staff.",
      id,
      revision: "1",
      title: "Laptop hard reset",
    },
    agentCookie
  );
  expect(updated.status).toBe(303);
  expect(
    db.prepare("SELECT title, body, revision FROM sops WHERE id = ?").get(id)
  ).toEqual({
    body: "Updated procedure from support staff.",
    revision: 2,
    title: "Laptop hard reset",
  });

  const stale = await post(
    "/sop?/save",
    {
      body: "Attempted stale body",
      id,
      revision: "999",
      title: "Attempted stale title",
    },
    adminCookie
  );
  expect(stale.status).toBe(409);
  const staleHtml = await stale.text();
  expect(staleHtml).toContain("Attempted stale title");
  expect(staleHtml).toContain("Attempted stale body");
  expect(staleHtml).toContain("999");
  expect(db.prepare("SELECT revision FROM sops WHERE id = ?").get(id)).toEqual({
    revision: 2,
  });

  const invalid = await post(
    "/sop?/save",
    {
      body: "Attempted invalid body",
      id: "invalid-id",
      revision: "invalid-revision",
      title: "Attempted invalid title",
    },
    agentCookie
  );
  expect(invalid.status).toBe(400);
  const invalidHtml = await invalid.text();
  expect(invalidHtml).toContain("Attempted invalid title");
  expect(invalidHtml).toContain("Attempted invalid body");
  expect(invalidHtml).toContain("invalid-id");
  expect(invalidHtml).toContain("invalid-revision");

  db.exec(`
    CREATE TRIGGER fail_sop_update BEFORE UPDATE ON sops
    BEGIN SELECT RAISE(ABORT, 'private database detail'); END;
  `);
  const failed = await post(
    "/sop?/save",
    {
      body: "Attempted database failure body",
      id,
      revision: "2",
      title: "Attempted database failure title",
    },
    adminCookie
  );
  expect(failed.status).toBe(500);
  const failedHtml = await failed.text();
  expect(failedHtml).toContain("Attempted database failure title");
  expect(failedHtml).toContain("Attempted database failure body");
  expect(failedHtml).not.toContain("private database detail");
  db.exec("DROP TRIGGER fail_sop_update");
  db.close();

  await post(
    "/settings/roles?/change",
    { email: "agent@example.com", role: "revoked" },
    adminCookie
  );
  const revokedSave = await post(
    "/sop?/save",
    { body: "Revoked", id, revision: "2", title: "Revoked" },
    agentCookie
  );
  expect(revokedSave.status).toBe(401);

  await stopServer();
  await startServer();
  const restartedAdmin = await login("admin@example.com", adminPassword);
  const persisted = await get(`/sop?id=${id}`, restartedAdmin);
  expect(persisted.status).toBe(200);
  const persistedHtml = await persisted.text();
  expect(persistedHtml).toContain("Laptop hard reset");
  expect(persistedHtml).toContain("Updated procedure from support staff.");
}, 60_000);
