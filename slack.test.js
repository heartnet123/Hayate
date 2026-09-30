import { afterAll, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";

const officialReplyEntryPattern = /<li(?:\s[^>]*)?>(?<entry>[\s\S]*?)<\/li>/gu;
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
const intake = (
  threadTs = "1710000001.000100",
  eventId = "Ev-claim",
  eventOverrides = {},
  { workspace = "T123ABC456", signingSecret = secret } = {}
) => {
  const body = JSON.stringify({
    event: {
      channel: "C123ABC456",
      text: "<@U123> Need help",
      ts: threadTs,
      type: "app_mention",
      user: "U123",
      user_name: "Requester",
      ...eventOverrides,
    },
    event_id: eventId,
    team_id: workspace,
    type: "event_callback",
  });
  const stamp = String(Math.floor(Date.now() / 1000));
  return fetch(`${address}/slack/events`, {
    body,
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": stamp,
      "x-slack-signature": `v0=${createHmac("sha256", signingSecret).update(`v0:${stamp}:${body}`).digest("hex")}`,
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

test("internal notes storage keeps author and timestamp without sending replies", async () => {
  process.env.HELPDESK_DB_PATH = path.join(directory, "notes-storage.db");
  process.env.HELPDESK_ADMIN_EMAIL = "admin@example.com";
  process.env.HELPDESK_ADMIN_PASSWORD = password;
  const { getDatabase } = await import("./apps/web/src/lib/server/auth.ts");
  const { addInternalNote, listSupportTickets } =
    await import("./apps/web/src/lib/server/tickets.ts");
  const db = getDatabase();
  db.prepare(
    "INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name) VALUES (1, 'T123', 'C123', '1.0', 'U123', 'Requester')"
  ).run();
  db.prepare(
    "INSERT INTO tickets (id, request_id, reason) VALUES (1, 1, 'Help')"
  ).run();
  const adminId = db
    .prepare("SELECT id FROM users WHERE role = 'admin'")
    .get().id;

  expect(addInternalNote(1, adminId, "Private context")).toBe(true);
  expect(addInternalNote(999, adminId, "Missing ticket")).toBe(false);
  const tickets = listSupportTickets();
  expect(tickets[0].notes).toMatchObject([
    { author: "admin@example.com", body: "Private context" },
  ]);
  expect(tickets[0].notes[0].createdAt).toMatch(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u
  );
  expect(
    db.prepare("SELECT count(*) AS total FROM official_replies").get().total
  ).toBe(0);
  expect(sent).toHaveLength(0);
  db.close();
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
  expect(
    await status(post("/slack?/note", { body: "no access", ticketId: "1" }))
  ).toBe(401);
  expect(await status(fetch(`${address}/slack/__data.json`))).toBe(401);
  const invalidNote = await post(
    "/slack?/note",
    { body: "   ", ticketId: "1" },
    a
  );
  expect(invalidNote.status).toBe(400);
  expect(await invalidNote.text()).toContain(
    "Enter a note of 1 to 4000 characters."
  );
  const emptyId = await post(
    "/slack?/note",
    { body: "Draft", ticketId: "" },
    a
  );
  expect(emptyId.status).toBe(400);
  expect(await emptyId.text()).toContain("Unsaved internal note: Draft</p>");
  const missingNote = await post(
    "/slack?/note",
    { body: "Draft", ticketId: "999" },
    a
  );
  expect(missingNote.status).toBe(404);
  expect(await missingNote.text()).toContain(
    "Unsaved internal note: Draft</p>"
  );
  const noteDb = new DatabaseSync(dbPath);
  noteDb.exec(`
    CREATE TRIGGER block_internal_notes BEFORE INSERT ON internal_notes
    BEGIN SELECT RAISE(FAIL, 'blocked write'); END;
  `);
  const failedNote = await post(
    "/slack?/note",
    { body: "Keep draft", ticketId: "1" },
    a
  );
  expect(failedNote.status).toBe(500);
  expect(await failedNote.text()).toContain(">Keep draft</textarea>");
  noteDb.exec("DROP TRIGGER block_internal_notes");
  noteDb.close();
  expect(
    await status(
      post("/slack?/note", { body: "Agent-only context", ticketId: "1" }, a)
    )
  ).toBe(200);
  expect(await page(b)).toContain("Agent-only context");
  expect(await page(b)).toContain("Add internal note to ticket #1");
  expect(
    await status(
      post("/slack?/note", { body: "Second agent follow-up", ticketId: "1" }, b)
    )
  ).toBe(200);
  expect(await page(a)).toContain("Second agent follow-up");
  const privateDb = new DatabaseSync(dbPath);
  expect(
    privateDb.prepare("SELECT count(*) AS total FROM official_replies").get()
      .total
  ).toBe(0);
  expect(
    privateDb.prepare("SELECT count(*) AS total FROM internal_notes").get()
      .total
  ).toBe(2);
  privateDb.close();
  expect(sent).toHaveLength(0);
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
  expect(recovered).toContain("Agent-only context");
  expect(recovered).toContain("Second agent follow-up");
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
  const revokedEmail =
    results[0].status === 200 ? "b@example.com" : "a@example.com";
  expect(
    await status(
      post(
        "/settings/roles?/change",
        { email: revokedEmail, role: "revoked" },
        admin
      )
    )
  ).toBe(200);
  expect(
    await status(
      post("/slack?/note", { body: "revoked", ticketId: "1" }, loserCookie)
    )
  ).toBe(401);
  expect(
    await status(
      fetch(`${address}/slack/__data.json`, {
        headers: { cookie: loserCookie },
      })
    )
  ).toBe(401);
}, 30_000);

test("signed Slack assignee replies preserve history, identity, dedupe, and privacy", async () => {
  const admin = await login("admin@example.com", password);
  const db = new DatabaseSync(dbPath);
  try {
    const agentA = db
      .prepare("SELECT id, role FROM users WHERE email = ?")
      .get("a@example.com");
    if (agentA.role === "revoked") {
      expect(
        await status(
          post(
            "/settings/roles?/change",
            { email: "a@example.com", role: "agent" },
            admin
          )
        )
      ).toBe(200);
    }
    expect(
      await status(
        post(
          "/settings/roles?/create",
          { email: "c@example.com", password },
          admin
        )
      )
    ).toBe(200);
    const a = await login("a@example.com", password);
    const c = await login("c@example.com", password);
    const agentC = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get("c@example.com");
    expect(
      await Promise.all(
        [
          [agentA.id, "U111AAA111"],
          [agentC.id, "U222BBB222"],
        ].map(([userId, slackUserId]) =>
          status(
            post(
              "/settings/roles?/identity",
              { slackUserId, userId: String(userId), workspace: "T123ABC456" },
              admin
            )
          )
        )
      )
    ).toEqual([200, 200]);
    const threadTs = (Date.now() / 1000 - 1).toFixed(6);
    expect(await status(intake(threadTs, "Ev-history-root"))).toBe(200);
    const ticketQuery = db.prepare(
      "SELECT tickets.id, request_id FROM tickets JOIN slack_requests ON slack_requests.id = tickets.request_id WHERE thread_ts = ?"
    );
    const ticket = ticketQuery.get(threadTs);
    expect(
      await status(post("/slack?/claim", { ticketId: String(ticket.id) }, a))
    ).toBe(200);
    const assignedAt = db
      .prepare("SELECT assigned_at FROM tickets WHERE id = ?")
      .get(ticket.id).assigned_at;
    expect(assignedAt).toBeGreaterThan(0);
    const privateNote = "Private assignee history context canary";
    expect(
      await status(
        post(
          "/slack?/note",
          { body: privateNote, ticketId: String(ticket.id) },
          a
        )
      )
    ).toBe(200);
    const sentBefore = sent.length;
    let eventClock = Date.now() / 1000;
    const deliver = async (eventId, eventOverrides = {}, options = {}) => {
      eventClock = Math.max(eventClock + 0.000001, Date.now() / 1000);
      const response = await intake(
        threadTs,
        eventId,
        {
          text: "Assigned agent answer",
          thread_ts: threadTs,
          ts: eventClock.toFixed(6),
          type: "message",
          user: "U111AAA111",
          user_name: "Agent A",
          ...eventOverrides,
        },
        options
      );
      expect(response.status).toBe(200);
      const responseBody = await response.text();
      expect(responseBody).not.toContain(privateNote);
      return JSON.parse(responseBody);
    };
    const history = () =>
      db
        .prepare(
          "SELECT official_agent_id AS authorId, users.email AS author, body, message_ts AS timestamp, user_id AS slackUserId, user_name AS slackUserName FROM slack_messages JOIN users ON users.id = slack_messages.official_agent_id WHERE request_id = ? ORDER BY slack_messages.id"
        )
        .all(ticket.request_id);
    const messageCount = () =>
      db.prepare("SELECT count(*) AS total FROM slack_messages").get().total;
    const officialList = (html, replies) => {
      const list = html
        .split(
          `aria-label="Official Slack replies for ticket #${ticket.id}"`
        )[1]
        ?.split("</ol>")[0];
      expect(list).toBeDefined();
      expect(list).not.toContain(privateNote);
      const entries = Array.from(
        list.matchAll(officialReplyEntryPattern),
        (match) => match.groups.entry
      );
      expect(entries).toHaveLength(replies.length);
      for (const [index, reply] of replies
        .toSorted(
          (left, right) => Number(left.timestamp) - Number(right.timestamp)
        )
        .entries()) {
        const entry = entries[index];
        const createdAt = new Date(
          Number(reply.timestamp) * 1000
        ).toISOString();
        expect(entry).toContain(`${reply.author}</strong>`);
        expect(entry).toContain(
          `${reply.slackUserName} (${reply.slackUserId})`
        );
        expect(entry).toContain(`datetime="${createdAt}"`);
        expect(entry).toContain(
          createdAt.replace("T", " ").replace("Z", " UTC")
        );
        expect(entry).toContain(reply.body.replace("<@U123> ", ""));
      }
      return list;
    };
    const firstTs = assignedAt.toFixed(6);
    await deliver("Ev-history-first", { ts: firstTs });
    await deliver("Ev-history-mention", {
      text: "<@U123> Assignee mention answer",
      type: "app_mention",
    });
    await Promise.all(
      ["thread_broadcast", "file_share", "me_message"].map((subtype) =>
        deliver(`Ev-history-${subtype}`, {
          subtype,
          text: `Human ${subtype} answer`,
        })
      )
    );
    const originalHistory = history();
    expect(originalHistory).toHaveLength(5);
    expect(
      originalHistory.every(
        (reply) =>
          reply.authorId === agentA.id && reply.author === "a@example.com"
      )
    ).toBe(true);
    const rendered = await page(a);
    for (const reply of originalHistory) {
      expect(rendered).toContain(reply.body.replace("<@U123> ", ""));
      expect(rendered).toContain(reply.timestamp);
    }
    const beforeDuplicates = messageCount();
    await deliver("Ev-history-first", { ts: firstTs });
    await deliver("Ev-history-same-timestamp", { ts: firstTs });
    await deliver("Ev-history-first", {
      text: "Changed retry payload",
      ts: (Date.now() / 1000 + 1).toFixed(6),
    });
    expect(messageCount()).toBe(beforeDuplicates);
    expect(history()).toEqual(originalHistory);

    await Promise.all(
      [
        ["Ev-history-requester", { text: "Requester follow-up", user: "U123" }],
        [
          "Ev-history-other-staff",
          {
            text: "Other staff follow-up",
            user: "U222BBB222",
          },
        ],
        [
          "Ev-history-unlinked",
          { text: "Unlinked user follow-up", user: "U333CCC333" },
        ],
        [
          "Ev-history-name-spoof",
          {
            text: "Display-name spoof follow-up",
            user: "U444DDD444",
            user_name: "a@example.com",
          },
        ],
        [
          "Ev-history-delayed-preclaim",
          {
            text: "Delayed preclaim message",
            ts: (assignedAt - 0.001).toFixed(6),
          },
        ],
      ].map(async ([eventId, eventOverrides]) => {
        await deliver(eventId, eventOverrides);
        expect({
          attribution: db
            .prepare(
              "SELECT official_agent_id FROM slack_messages WHERE event_id = ?"
            )
            .get(eventId),
          eventId,
        }).toEqual({ attribution: { official_agent_id: null }, eventId });
      })
    );
    const otherStaffTs = db
      .prepare(
        "SELECT message_ts FROM slack_messages WHERE event_id = 'Ev-history-other-staff'"
      )
      .get().message_ts;
    expect(history()).toEqual(originalHistory);
    const sharedHistory = await page(c);
    expect(sharedHistory).toContain('aria-label="Support ticket history"');
    expect(sharedHistory).toContain("Official replies from Slack</h4>");
    expect(sharedHistory).toContain("Internal notes</h4>");
    const initialList = officialList(sharedHistory, originalHistory);
    expect(initialList.split("Assigned agent answer")).toHaveLength(2);
    for (const body of [
      "Requester follow-up",
      "Other staff follow-up",
      "Unlinked user follow-up",
      "Display-name spoof follow-up",
      "Delayed preclaim message",
    ]) {
      expect(initialList).not.toContain(body);
    }
    const internalNotes = sharedHistory
      .split(`id="ticket-${ticket.id}"`)[1]
      ?.split("Internal notes</h4>")[1]
      ?.split("</ul>")[0];
    expect(internalNotes).toContain(privateNote);
    expect(internalNotes).not.toContain("Assigned agent answer");
    const beforeIgnored = messageCount();
    await Promise.all(
      [
        [
          "Ev-history-bot-spoof",
          { bot_id: "B123ABC456", text: "Bot spoof answer" },
        ],
        [
          "Ev-history-edited",
          { subtype: "message_changed", text: "Edited answer" },
        ],
        [
          "Ev-history-deleted",
          { subtype: "message_deleted", text: "Deleted answer" },
        ],
        ["Ev-history-wrong-workspace", {}, { workspace: "T999AAA999" }],
        ["Ev-history-wrong-channel", { channel: "C999AAA999" }],
        ["Ev-history-numeric-timestamp", { ts: Number(firstTs) }],
        ["Ev-history-numeric-thread", { thread_ts: Number(threadTs) }],
        ["Ev-history-numeric-text", { text: 123 }],
        ...[
          "not-a-timestamp",
          "1700000000",
          "1700000000.1234567",
          "999999999999999999999.0",
        ].map((ts, index) => [`Ev-history-invalid-ts-${index}`, { ts }]),
      ].map(async ([eventId, eventOverrides, options]) => {
        expect(await deliver(eventId, eventOverrides, options)).toEqual({
          accepted: false,
        });
      })
    );
    expect(messageCount()).toBe(beforeIgnored);
    const badSignature = await intake(
      threadTs,
      "Ev-history-invalid-signature",
      {
        thread_ts: threadTs,
        ts: (Date.now() / 1000).toFixed(6),
        type: "message",
        user: "U111AAA111",
      },
      { signingSecret: "wrong-signing-secret" }
    );
    expect(badSignature.status).toBe(401);
    expect(await badSignature.text()).not.toContain(privateNote);
    expect(messageCount()).toBe(beforeIgnored);

    expect(
      await status(
        post(
          "/settings/roles?/identity",
          {
            slackUserId: "U555EEE555",
            userId: String(agentA.id),
            workspace: "T123ABC456",
          },
          admin
        )
      )
    ).toBe(200);
    await deliver("Ev-history-old-binding", { text: "Old binding answer" });
    expect(history()).toEqual(originalHistory);
    expect(
      await status(
        post(
          "/settings/roles?/change",
          { email: "a@example.com", role: "revoked" },
          admin
        )
      )
    ).toBe(200);
    await deliver("Ev-history-revoked-agent", {
      text: "Revoked agent answer",
      user: "U555EEE555",
    });
    expect(history()).toEqual(originalHistory);
    const unchangedList = officialList(await page(c), originalHistory);
    expect(unchangedList).not.toContain("U555EEE555");
    await Promise.all(
      ["", a].map(async (cookie) => {
        const response = await fetch(`${address}/slack/__data.json`, {
          headers: { cookie },
        });
        expect(response.status).toBe(401);
        const body = await response.text();
        expect(body).not.toContain("Assigned agent answer");
        expect(body).not.toContain(privateNote);
      })
    );

    db.prepare("UPDATE tickets SET assignee_id = ? WHERE id = ?").run(
      agentC.id,
      ticket.id
    );
    const reassignedAt = db
      .prepare("SELECT assigned_at FROM tickets WHERE id = ?")
      .get(ticket.id).assigned_at;
    expect(reassignedAt).toBeGreaterThan(assignedAt);
    await deliver("Ev-history-other-staff", {
      text: "Other staff follow-up",
      ts: otherStaffTs,
      user: "U222BBB222",
    });
    await deliver("Ev-history-delayed-prehandoff", {
      text: "Delayed prehandoff answer",
      ts: (reassignedAt - 0.001).toFixed(6),
      user: "U222BBB222",
    });
    await deliver("Ev-history-former-assignee", {
      text: "Former assignee answer",
      user: "U555EEE555",
    });
    expect(history()).toEqual(originalHistory);
    await deliver("Ev-history-new-assignee", {
      text: "New assignee answer",
      user: "U222BBB222",
      user_name: "Agent C",
    });
    const durableHistory = history();
    expect(durableHistory).toHaveLength(6);
    expect(durableHistory.slice(0, 5)).toEqual(originalHistory);
    expect(durableHistory[5]).toMatchObject({
      author: "c@example.com",
      authorId: agentC.id,
      body: "New assignee answer",
    });

    const requesterThreadTs = (Date.now() / 1000).toFixed(6);
    expect(
      await status(
        intake(requesterThreadTs, "Ev-history-bound-requester-root", {
          text: "<@U123> Bound requester asks",
          user: "U222BBB222",
          user_name: "Agent C",
        })
      )
    ).toBe(200);
    const requesterTicket = ticketQuery.get(requesterThreadTs);
    expect(
      await status(
        post("/slack?/claim", { ticketId: String(requesterTicket.id) }, c)
      )
    ).toBe(200);
    await deliver("Ev-history-bound-requester-answer", {
      text: "Requester mapped to current assignee",
      thread_ts: requesterThreadTs,
      user: "U222BBB222",
    });
    expect(
      db
        .prepare(
          "SELECT official_agent_id FROM slack_messages WHERE event_id = 'Ev-history-bound-requester-answer'"
        )
        .get()
    ).toEqual({ official_agent_id: null });
    expect(history()).toEqual(durableHistory);
    expect(
      db
        .prepare(
          "SELECT count(*) AS total FROM official_replies WHERE ticket_id = ?"
        )
        .get(ticket.id).total
    ).toBe(0);
    expect(sent).toHaveLength(sentBefore);

    const beforeRestartList = officialList(await page(c), durableHistory);
    expect(beforeRestartList).not.toContain("U555EEE555");
    server.kill();
    await server.exited;
    server = await startServer();
    const recovered = await page(c);
    expect(history()).toEqual(durableHistory);
    expect(officialList(recovered, durableHistory)).toBe(beforeRestartList);
    for (const reply of durableHistory) {
      expect(recovered).toContain(reply.body.replace("<@U123> ", ""));
      expect(recovered).toContain(reply.timestamp);
    }
    expect(recovered).toContain(privateNote);
    expect(
      db
        .prepare("SELECT body FROM internal_notes WHERE ticket_id = ?")
        .get(ticket.id)
    ).toEqual({ body: privateNote });
    expect(sent).toHaveLength(sentBefore);
  } finally {
    db.close();
  }
}, 30_000);
