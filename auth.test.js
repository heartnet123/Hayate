import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";

const directory = mkdtempSync(path.join(tmpdir(), "helpdesk-auth-"));
const databasePath = path.join(directory, "local.db");
const exposedDatabasePath = path.join(import.meta.dir, "apps/web/exposed.db");
const exposedEnvPath = path.join(import.meta.dir, "apps/web/.env.auth-test");
const adminPassword = "secure-admin-password-2026";
let server;
let address;

const startServer = async () => {
  const port = 10_000 + Math.floor(Math.random() * 10_000);
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

const get = (route, cookie = "") =>
  fetch(`${address}${route}`, { headers: { cookie } });
const status = async (responsePromise) => {
  const response = await responsePromise;
  return response.status;
};
const text = async (responsePromise) => {
  const response = await responsePromise;
  return response.text();
};
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
  return {
    cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "",
    response,
  };
};
const loginStatus = async (email, password) => {
  const { response } = await login(email, password);
  return response.status;
};

afterEach(async () => {
  if (server) {
    server.kill();
    await server.exited;
  }
  rmSync(exposedDatabasePath, { force: true });
  rmSync(exposedEnvPath, { force: true });
  rmSync(directory, { force: true, recursive: true });
});

test("HTTP login, permission changes, server enforcement, persistence, and failed saves", async () => {
  await startServer();
  expect(await status(get("/settings/roles"))).toBe(401);
  writeFileSync(exposedDatabasePath, "database-secret-canary");
  expect(await text(get("/exposed.db"))).not.toContain(
    "database-secret-canary"
  );
  writeFileSync(exposedEnvPath, "environment-secret-canary");
  expect(await text(get("/.env.auth-test"))).not.toContain(
    "environment-secret-canary"
  );
  await Promise.all(
    ["/slack", "/sop", "/settings/general", "/settings/slack"].map(
      async (route) => {
        expect(await status(get(route))).toBe(401);
      }
    )
  );
  expect(
    await status(
      post("/settings/roles?/create", {
        email: "x@example.com",
        password: "a long enough password",
      })
    )
  ).toBe(401);
  const redirected = await fetch(address, {
    headers: { accept: "text/html" },
    redirect: "manual",
  });
  expect(redirected.headers.get("location")).toBe("/login");

  expect(await loginStatus("admin@example.com", "invalid-password")).toBe(400);
  const admin = await login("admin@example.com", adminPassword);
  expect(admin.response.status).toBe(303);
  expect(admin.cookie).toContain("helpdesk_session=");
  expect(admin.response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(admin.response.headers.get("set-cookie")).toContain("SameSite=Lax");
  const created = await post(
    "/settings/roles?/create",
    { email: "agent@example.com", password: "temporary-password-2026" },
    admin.cookie
  );
  expect(created.status).toBe(200);
  expect(await created.text()).toContain("Access updated.");
  let roles = await text(get("/settings/roles", admin.cookie));
  expect(roles).not.toContain("Access updated.");
  expect(
    await text(get("/settings/roles?updated=1", admin.cookie))
  ).not.toContain("Access updated.");
  expect(roles).toContain("agent@example.com");
  expect(roles).not.toContain("temporary-password-2026");
  expect(roles).not.toContain(adminPassword);
  expect(roles).not.toContain("password_hash");
  expect(roles).not.toContain("helpdesk_session=");

  const agent = await login("agent@example.com", "temporary-password-2026");
  expect(agent.response.status).toBe(303);
  expect(await status(get("/slack", agent.cookie))).toBe(200);
  expect(await status(get("/sop", agent.cookie))).toBe(200);
  expect(await status(get("/%73ettings/general", agent.cookie))).toBe(403);
  await Promise.all(
    ["/settings/roles", "/settings/general", "/settings/slack"].map(
      async (route) => {
        expect(await status(get(route, agent.cookie))).toBe(403);
      }
    )
  );
  expect(
    await status(
      post(
        "/settings/roles?/change",
        { email: "agent@example.com", role: "revoked" },
        agent.cookie
      )
    )
  ).toBe(403);
  expect(
    await status(
      post(
        "/settings/roles?/change",
        { email: "agent@example.com", role: "admin" },
        admin.cookie
      )
    )
  ).toBe(400);
  const agentHome = await text(get("/", agent.cookie));
  expect(agentHome).not.toContain("/settings/roles");
  expect(agentHome).not.toContain('aria-label="Settings"');
  expect(agentHome).toContain("agent@example.com");

  expect(
    await status(
      post(
        "/settings/roles?/change",
        { email: "agent@example.com", role: "revoked" },
        admin.cookie
      )
    )
  ).toBe(200);
  expect(await status(get("/slack", agent.cookie))).toBe(401);
  expect(
    await loginStatus("agent@example.com", "temporary-password-2026")
  ).toBe(400);
  roles = await text(get("/settings/roles", admin.cookie));
  expect(roles).toContain("Revoked");

  server.kill();
  await server.exited;
  server = undefined;
  await startServer();
  const nextAdmin = await login("admin@example.com", adminPassword);
  expect(nextAdmin.response.status).toBe(303);
  expect(await status(get("/settings/roles", nextAdmin.cookie))).toBe(200);
  expect(
    await loginStatus("agent@example.com", "temporary-password-2026")
  ).toBe(400);
  expect(
    await status(
      post(
        "/settings/roles?/change",
        { email: "agent@example.com", role: "agent" },
        nextAdmin.cookie
      )
    )
  ).toBe(200);
  const again = await login("agent@example.com", "temporary-password-2026");
  expect(again.response.status).toBe(303);
  expect(await status(get("/slack", again.cookie))).toBe(200);
  expect(
    await status(
      post(
        "/settings/roles?/create",
        { email: "agent@example.com", password: "another-long-password" },
        nextAdmin.cookie
      )
    )
  ).toBe(400);
  expect(
    await loginStatus("agent@example.com", "temporary-password-2026")
  ).toBe(303);
  expect(
    await status(
      post(
        "/settings/roles?/change",
        { email: "agent@example.com", role: "revoked" },
        nextAdmin.cookie
      )
    )
  ).toBe(200);

  const db = new DatabaseSync(databasePath);
  db.exec(
    "CREATE TRIGGER deny_grant BEFORE UPDATE OF role ON users BEGIN SELECT RAISE(ABORT, 'write denied'); END"
  );
  db.close();
  const failed = await post(
    "/settings/roles?/change",
    { email: "agent@example.com", role: "agent" },
    nextAdmin.cookie
  );
  expect(failed.status).toBe(500);
  const body = await failed.text();
  expect(body).toContain("Unable to save permissions");
  expect(body).not.toContain("write denied");
  expect(body).not.toContain("Access updated");
  expect(
    await loginStatus("agent@example.com", "temporary-password-2026")
  ).toBe(400);
  expect(await status(post("/logout", {}, nextAdmin.cookie))).toBe(303);
  expect(await status(get("/settings/roles", nextAdmin.cookie))).toBe(401);
}, 30_000);
