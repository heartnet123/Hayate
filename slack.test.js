import { afterAll, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";

const directory = mkdtempSync(path.join(tmpdir(), "helpdesk-replies-"));
const dbPath = path.join(directory, "tickets.db");
const secret = "slack-signing-secret-canary";
const password = "secure-admin-password-2026";
const port = 20_000 + Math.floor(Math.random() * 20_000);
const address = `http://127.0.0.1:${port}`;
let server;
let server2;
let mock;
let mockMode = "reject";
const sent = [];
const startServer = async (atPort = port) => {
  const running = Bun.spawn(
    [
      "node",
      "node_modules/vite/bin/vite.js",
      "dev",
      "--host",
      "127.0.0.1",
      "--port",
      String(atPort),
      "--strictPort",
    ],
    {
      cwd: path.join(import.meta.dir, "apps/web"),
      env: {
        ...process.env,
        HELPDESK_ADMIN_EMAIL: "admin@example.com",
        HELPDESK_ADMIN_PASSWORD: password,
        HELPDESK_DB_PATH: dbPath,
        NODE_ENV: "test",
        SLACK_API_URL: `http://127.0.0.1:${mock.port}/chat.postMessage`,
        SLACK_BOT_TOKEN: "xoxb-test",
        SLACK_SIGNING_SECRET: secret,
      },
      stderr: "inherit",
      stdout: "ignore",
    }
  );
  const wait = async (attempt = 0) => {
    if (attempt === 80 || running.exitCode !== null) {
      throw new Error("Vite failed to start");
    }
    try {
      const response = await fetch(`http://127.0.0.1:${atPort}/login`);
      if (response.ok) {
        return;
      }
    } catch {
      // Vite is still starting.
    }
    await delay(200);
    await wait(attempt + 1);
  };
  await wait();
  return running;
};

const post = (route, fields, cookie = "", base = address) =>
  fetch(`${base}${route}`, {
    body: new URLSearchParams(fields),
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie,
      origin: base,
    },
    method: "POST",
    redirect: "manual",
  });
const status = async (responsePromise) => {
  const response = await responsePromise;
  return response.status;
};
const page = (cookie) =>
  fetch(`${address}/slack`, { headers: { cookie } }).then((res) => res.text());
const login = async (email, pass) => {
  const response = await post("/login", { email, password: pass });
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
};
const intake = (threadTs = "1710000001.000100", eventId = "Ev-claim") => {
  const body = JSON.stringify({
    event: {
      channel: "C123ABC456",
      text: "<@U123> Need help",
      ts: threadTs,
      type: "app_mention",
      user: "U123",
      user_name: "Requester",
    },
    event_id: eventId,
    team_id: "T123ABC456",
    type: "event_callback",
  });
  const stamp = String(Math.floor(Date.now() / 1000));
  return fetch(`${address}/slack/events`, {
    body,
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": stamp,
      "x-slack-signature": `v0=${createHmac("sha256", secret).update(`v0:${stamp}:${body}`).digest("hex")}`,
    },
    method: "POST",
  });
};

afterAll(async () => {
  if (server) {
    server.kill();
    await server.exited;
  }
  if (server2) {
    server2.kill();
    await server2.exited;
  }
  mock?.stop(true);
  Bun.gc(true);
  await delay(100);
  rmSync(directory, { force: true, recursive: true });
});

test("two agents race to claim one queued thread", async () => {
  mock = Bun.serve({
    async fetch(request) {
      sent.push({
        authorization: request.headers.get("authorization"),
        body: await request.json(),
      });
      if (mockMode === "reject") {
        return Response.json({ error: "channel_not_found", ok: false });
      }
      if (mockMode === "uncertain") {
        return new Response("upstream error", { status: 500 });
      }
      if (mockMode === "rate") {
        return new Response("rate limited", {
          headers: { "retry-after": "1" },
          status: 429,
        });
      }
      await delay(150);
      return Response.json({
        channel: "C123ABC456",
        ok: true,
        ts: "1710000099.000100",
      });
    },
    port: 0,
  });
  server = await startServer();
  const admin = await login("admin@example.com", password);
  const settings = await post(
    "/settings/slack",
    { channel: "C123ABC456", workspace: "T123ABC456" },
    admin
  );
  expect(settings.status).toBe(200);
  const created = await Promise.all(
    ["a", "b"].map((name) =>
      post(
        "/settings/roles?/create",
        { email: `${name}@example.com`, password },
        admin
      )
    )
  );
  expect(created.map((response) => response.status)).toEqual([200, 200]);
  const a = await login("a@example.com", password);
  const b = await login("b@example.com", password);
  const intakeResponse = await intake();
  expect(
    `${intakeResponse.status}: ${await intakeResponse.text()}`
  ).toStartWith("200:");
  expect(await page(a)).toContain("Central Queue (1 unassigned)");
  const results = await Promise.all(
    [a, b].map((cookie) => post("/slack?/claim", { ticketId: "1" }, cookie))
  );
  expect(results.map((response) => response.status).toSorted()).toEqual([
    200, 409,
  ]);
  const loser = results.find((response) => response.status === 409);
  expect(await loser?.text()).toContain("already claimed by agent");
  expect(await page(a)).toContain("Central Queue (0 unassigned)");
  const winnerCookie = results[0].status === 200 ? a : b;
  const loserCookie = results[0].status === 200 ? b : a;
  expect(await page(winnerCookie)).toContain("My tickets (1)");
  expect(await page(loserCookie)).toContain("My tickets (0)");
  expect(
    await status(
      post("/slack?/reply", { body: "Owner only", ticketId: "1" }, loserCookie)
    )
  ).toBe(403);
  expect(sent).toHaveLength(0);

  const failed = await post(
    "/slack?/reply",
    { body: "Official answer", ticketId: "1" },
    winnerCookie
  );
  expect(failed.status).toBe(502);
  expect(await page(winnerCookie)).toContain("Official answer</textarea>");
  const db = new DatabaseSync(dbPath);
  expect(
    db
      .prepare(
        "SELECT status, body, slack_ts FROM official_replies WHERE ticket_id = 1"
      )
      .get()
  ).toEqual({ body: "Official answer", slack_ts: null, status: "failed" });
  expect(sent[0].body).toMatchObject({
    channel: "C123ABC456",
    text: "Official answer",
    thread_ts: "1710000001.000100",
  });
  expect(sent[0].authorization).toBe("Bearer xoxb-test");
  mockMode = "success";
  server2 = await startServer(port + 1);
  const competingSends = await Promise.all([
    post(
      "/slack?/reply",
      { body: "Official answer", ticketId: "1" },
      winnerCookie
    ),
    post(
      "/slack?/reply",
      { body: "Official answer", ticketId: "1" },
      winnerCookie,
      `http://127.0.0.1:${port + 1}`
    ),
  ]);
  expect(competingSends.map((response) => response.status).toSorted()).toEqual([
    200, 409,
  ]);
  expect(
    db
      .prepare(
        "SELECT status, slack_ts FROM official_replies WHERE ticket_id = 1"
      )
      .get()
  ).toEqual({ slack_ts: "1710000099.000100", status: "sent" });
  expect(
    await status(
      post(
        "/slack?/reply",
        { body: "Official answer", ticketId: "1" },
        winnerCookie
      )
    )
  ).toBe(409);
  expect(sent).toHaveLength(2);
  expect(await page(winnerCookie)).toContain(
    "Delivered to Slack · 1710000099.000100"
  );
  expect(await page(winnerCookie)).toContain(
    "Official reply:</strong> Official answer"
  );

  expect(await status(intake("1710000002.000100", "Ev-uncertain"))).toBe(200);
  expect(
    await status(post("/slack?/claim", { ticketId: "2" }, winnerCookie))
  ).toBe(200);
  mockMode = "uncertain";
  expect(
    await status(
      post(
        "/slack?/reply",
        { body: "Uncertain answer", ticketId: "2" },
        winnerCookie
      )
    )
  ).toBe(503);
  expect(
    db
      .prepare(
        "SELECT status, body, slack_ts FROM official_replies WHERE ticket_id = 2"
      )
      .get()
  ).toEqual({ body: "Uncertain answer", slack_ts: null, status: "uncertain" });
  expect(
    await status(
      post(
        "/slack?/reply",
        { body: "Uncertain answer", ticketId: "2" },
        winnerCookie
      )
    )
  ).toBe(409);
  expect(sent).toHaveLength(3);
  expect(await status(intake("1710000003.000100", "Ev-rate"))).toBe(200);
  expect(
    await status(post("/slack?/claim", { ticketId: "3" }, winnerCookie))
  ).toBe(200);
  mockMode = "rate";
  expect(
    await status(
      post(
        "/slack?/reply",
        { body: "Rate limited", ticketId: "3" },
        winnerCookie
      )
    )
  ).toBe(502);
  expect(
    db.prepare("SELECT status FROM official_replies WHERE ticket_id = 3").get()
  ).toEqual({ status: "failed" });
  mockMode = "success";
  expect(
    await status(
      post(
        "/slack?/reply",
        { body: "Rate limited", ticketId: "3" },
        winnerCookie
      )
    )
  ).toBe(200);
  expect(sent).toHaveLength(5);
  expect(await status(intake("1710000004.000100", "Ev-locked"))).toBe(200);
  const owner = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(results[0].status === 200 ? "a@example.com" : "b@example.com");
  db.exec("BEGIN IMMEDIATE");
  db.prepare("UPDATE tickets SET assignee_id = ? WHERE id = 4").run(owner.id);
  const lockedClaim = post(
    "/slack?/claim",
    { ticketId: "4" },
    loserCookie,
    `http://127.0.0.1:${port + 1}`
  );
  await delay(200);
  db.exec("COMMIT");
  expect(await status(lockedClaim)).toBe(409);
  db.close();
  server.kill();
  await server.exited;
  server2.kill();
  await server2.exited;
  server2 = undefined;
  server = await startServer();
  const recovered = await page(winnerCookie);
  expect(recovered).toContain("Delivered to Slack · 1710000099.000100");
  expect(recovered).toContain("Delivery not confirmed. Check the Slack thread");
  expect(recovered).toContain("Saved draft:</strong> Uncertain answer");
  expect(
    await status(
      post(
        "/slack?/reply",
        { body: "Uncertain answer", ticketId: "2" },
        winnerCookie
      )
    )
  ).toBe(409);
  expect(sent).toHaveLength(5);
}, 30_000);
