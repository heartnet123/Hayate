import { afterAll, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const directory = mkdtempSync(path.join(tmpdir(), "helpdesk-replies-"));
const dbPath = path.join(directory, "tickets.db");
const secret = "slack-signing-secret-canary";
const password = "secure-admin-password-2026";
const port = 20_000 + Math.floor(Math.random() * 20_000);
const address = `http://127.0.0.1:${port}`;
let server;

const post = (route, fields, cookie = "") => fetch(`${address}${route}`, {
  body: new URLSearchParams(fields), headers: { accept: "text/html", "content-type": "application/x-www-form-urlencoded", cookie, origin: address }, method: "POST", redirect: "manual",
});
const page = (cookie) => fetch(`${address}/slack`, { headers: { cookie } }).then((res) => res.text());
const login = async (email, pass) => {
  const response = await post("/login", { email, password: pass });
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
};
const intake = () => {
  const body = JSON.stringify({ event: {
    channel: "C123ABC456", text: "<@U123> Need help", ts: "1710000001.000100", type: "app_mention", user: "U123", user_name: "Requester",
  }, event_id: "Ev-claim", team_id: "T123ABC456", type: "event_callback" });
  const stamp = String(Math.floor(Date.now() / 1000));
  return fetch(`${address}/slack/events`, { body, headers: {
    "content-type": "application/json",
    "x-slack-request-timestamp": stamp,
    "x-slack-signature": `v0=${createHmac("sha256", secret).update(`v0:${stamp}:${body}`).digest("hex")}`,
  }, method: "POST" });
};

afterAll(async () => {
  if (server) { server.kill(); await server.exited; }
  rmSync(directory, { force: true, recursive: true });
});

test("two agents race to claim one queued thread", async () => {
  server = Bun.spawn(["node", "node_modules/vite/bin/vite.js", "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
    cwd: path.join(import.meta.dir, "apps/web"), env: { ...process.env, HELPDESK_ADMIN_EMAIL: "admin@example.com", HELPDESK_ADMIN_PASSWORD: password, HELPDESK_DB_PATH: dbPath, NODE_ENV: "test", SLACK_SIGNING_SECRET: secret }, stderr: "inherit", stdout: "ignore",
  });
  const wait = async (attempt = 0) => {
    if (attempt === 80 || server.exitCode !== null) { throw new Error("Vite failed to start"); }
    try {
      const response = await fetch(`${address}/login`);
      if (response.ok) { return; }
    } catch {
      // Vite is still starting.
    }
    await delay(200);
    await wait(attempt + 1);
  };
  await wait();
  const admin = await login("admin@example.com", password);
  const settings = await post("/settings/slack", { channel: "C123ABC456", workspace: "T123ABC456" }, admin);
  expect(settings.status).toBe(200);
  const created = await Promise.all(["a", "b"].map((name) => post("/settings/roles?/create", { email: `${name}@example.com`, password }, admin)));
  expect(created.map((response) => response.status)).toEqual([200, 200]);
  const a = await login("a@example.com", password);
  const b = await login("b@example.com", password);
  const intakeResponse = await intake();
  expect(`${intakeResponse.status}: ${await intakeResponse.text()}`).toStartWith("200:");
  expect(await page(a)).toContain("Central Queue (1 unassigned)");
  const results = await Promise.all([a, b].map((cookie) => post("/slack?/claim", { ticketId: "1" }, cookie)));
  expect(results.map((response) => response.status).toSorted()).toEqual([200, 409]);
  const loser = results.find((response) => response.status === 409);
  expect(await loser?.text()).toContain("already claimed by agent");
  expect(await page(a)).toContain("Central Queue (0 unassigned)");
}, 30_000);
