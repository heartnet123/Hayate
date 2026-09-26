import { afterEach, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
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
const signingSecret = "slack-signing-secret-canary";
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
        SLACK_BOT_TOKEN: "xoxb-secret-token-canary",
        SLACK_BOT_USER_ID: "U123",
        SLACK_SIGNING_SECRET: signingSecret,
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
const slackEvent = (
  payload,
  {
    secret = signingSecret,
    signature,
    timestamp = String(Math.floor(Date.now() / 1000)),
  } = {}
) => {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const computed =
    signature ??
    `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
  return fetch(`${address}/slack/events`, {
    body,
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": computed,
    },
    method: "POST",
  });
};
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

test("HTTP login, permission changes, Slack settings, server enforcement, persistence, and failed saves", async () => {
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE slack_messages (
      id INTEGER PRIMARY KEY,
      request_id INTEGER NOT NULL,
      event_id TEXT NOT NULL UNIQUE,
      message_ts TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      body TEXT NOT NULL,
      UNIQUE(request_id, message_ts),
      UNIQUE(request_id, user_id, body)
    );
  `);
  legacy.close();
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
  expect(
    await status(
      post("/settings/slack", {
        channel: "#it-support",
        workspace: "acme-support",
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
  const initialSlackSettings = await text(get("/settings/slack", admin.cookie));
  expect(initialSlackSettings).toContain("No Slack workspace connected.");
  expect(initialSlackSettings).not.toContain("xoxb-secret-token-canary");
  expect(initialSlackSettings).not.toContain("slack-signing-secret-canary");

  const savedSlack = await post(
    "/settings/slack",
    { channel: "#it-help", workspace: "acme-support" },
    admin.cookie
  );
  expect(savedSlack.status).toBe(200);
  const savedSlackBody = await savedSlack.text();
  expect(savedSlackBody).toContain("Slack settings saved.");
  expect(savedSlackBody).toContain("acme-support");
  expect(savedSlackBody).toContain("#it-help");
  expect(savedSlackBody).not.toContain("xoxb-secret-token-canary");
  expect(savedSlackBody).not.toContain("slack-signing-secret-canary");

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
  const agentSlack = await text(get("/slack", agent.cookie));
  expect(agentSlack).toContain(
    "Active workspace: acme-support · Support channel: #it-help."
  );
  expect(agentSlack).not.toContain("/settings/slack");
  expect(agentSlack).not.toContain("xoxb-secret-token-canary");
  expect(agentSlack).not.toContain("slack-signing-secret-canary");
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
        "/settings/slack",
        { channel: "#rogue", workspace: "rogue-workspace" },
        agent.cookie
      )
    )
  ).toBe(403);
  expect(
    await status(
      post(
        "/settings/roles?/change",
        { email: "agent@example.com", role: "revoked" },
        agent.cookie
      )
    )
  ).toBe(403);

  await Promise.all(
    [
      { channel: "#draft-channel", workspace: "invalid workspace!" },
      { channel: "missing-hash", workspace: "draft-workspace" },
    ].map(async (fields) => {
      const invalid = await post("/settings/slack", fields, admin.cookie);
      expect(invalid.status).toBe(400);
      const invalidBody = await invalid.text();
      expect(invalidBody).toContain(
        "Enter a valid Slack workspace and support channel"
      );
      expect(invalidBody).toContain(fields.workspace);
      expect(invalidBody).toContain(fields.channel);
      expect(invalidBody).not.toContain("Slack settings saved.");
    })
  );

  const updatedSlack = await post(
    "/settings/slack",
    { channel: "#helpdesk-triage", workspace: "acme-ops.slack.com" },
    admin.cookie
  );
  expect(updatedSlack.status).toBe(200);
  expect(await text(get("/slack", agent.cookie))).toContain(
    "Active workspace: acme-ops.slack.com · Support channel: #helpdesk-triage."
  );

  expect(
    await status(
      slackEvent(
        {
          event: {
            channel: "#helpdesk-triage",
            text: "@ai unauthorized signature",
            ts: "1710000000.000100",
            type: "message",
            user: "U000",
          },
          event_id: "Ev-bad-sig",
          type: "event_callback",
        },
        { signature: "v0=deadbeef" }
      )
    )
  ).toBe(401);
  expect(
    await status(
      slackEvent(
        {
          event: {
            channel: "#helpdesk-triage",
            text: "@ai expired timestamp",
            ts: "1710000000.000200",
            type: "message",
            user: "U000",
          },
          event_id: "Ev-stale",
          type: "event_callback",
        },
        { timestamp: String(Math.floor(Date.now() / 1000) - 600) }
      )
    )
  ).toBe(401);

  const challengeRes = await slackEvent({
    challenge: "challenge-token-123",
    type: "url_verification",
  });
  expect(challengeRes.status).toBe(200);
  expect(await challengeRes.json()).toEqual({
    challenge: "challenge-token-123",
  });

  await Promise.all(
    [
      {
        event: {
          channel: "#general",
          text: "@ai wrong channel request",
          ts: "1710000000.000300",
          type: "message",
          user: "U100",
        },
        event_id: "Ev-wrong-channel",
        type: "event_callback",
        workspace: "acme-ops.slack.com",
      },
      {
        event: {
          channel: "#helpdesk-triage",
          text: "general chatter without tagging assistant",
          ts: "1710000000.000400",
          type: "message",
          user: "U100",
        },
        event_id: "Ev-no-mention",
        type: "event_callback",
        workspace: "acme-ops.slack.com",
      },
      {
        event: {
          channel: "#helpdesk-triage",
          text: "@ai missing workspace must not be routed",
          ts: "1710000000.000500",
          type: "message",
          user: "U100",
        },
        event_id: "Ev-missing-workspace",
        type: "event_callback",
      },
      {
        event: {
          channel: "#helpdesk-triage",
          text: "<@U999> please look into this",
          ts: "1710000000.000600",
          type: "message",
          user: "U100",
        },
        event_id: "Ev-other-user",
        type: "event_callback",
        workspace: "acme-ops.slack.com",
      },
      {
        event: {
          channel: "#helpdesk-triage",
          text: "@ai event needs an identity",
          ts: "1710000000.000700",
          type: "message",
          user: "U100",
        },
        type: "event_callback",
        workspace: "acme-ops.slack.com",
      },
    ].map(async (ignoredPayload) => {
      const res = await slackEvent(ignoredPayload);
      expect(res.status).toBe(200);
      const resBody = await res.json();
      expect(resBody.accepted).toBe(false);
    })
  );
  expect(await text(get("/slack", agent.cookie))).toContain(
    "Central Queue (0 unassigned)"
  );

  const firstIntake = await slackEvent({
    event: {
      channel: "#helpdesk-triage",
      text: "<@U123> VPN keeps disconnecting after update",
      ts: "1710000001.000100",
      type: "message",
      user: "U101",
      user_name: "Priya Desai",
    },
    event_id: "Ev-vpn-1",
    type: "event_callback",
    workspace: "acme-ops.slack.com",
  });
  expect(firstIntake.status).toBe(200);
  expect(await firstIntake.json()).toEqual({
    accepted: true,
    duplicate: false,
    queued: true,
  });

  const duplicateDelivery = await slackEvent({
    event: {
      channel: "#helpdesk-triage",
      text: "<@U123> VPN keeps disconnecting after update",
      ts: "1710000001.000100",
      type: "message",
      user: "U101",
      user_name: "Priya Desai",
    },
    event_id: "Ev-vpn-1",
    type: "event_callback",
    workspace: "acme-ops.slack.com",
  });
  expect(duplicateDelivery.status).toBe(200);
  expect(await duplicateDelivery.json()).toEqual({
    accepted: true,
    duplicate: true,
    queued: true,
  });

  const sameTextRetag = await slackEvent({
    event: {
      channel: "#helpdesk-triage",
      text: "<@U123> VPN keeps disconnecting after update",
      thread_ts: "1710000001.000100",
      ts: "1710000001.000200",
      type: "message",
      user: "U101",
      user_name: "Priya Desai",
    },
    event_id: "Ev-vpn-retag-same",
    type: "event_callback",
    workspace: "acme-ops.slack.com",
  });
  expect(sameTextRetag.status).toBe(200);
  const retagBody = await sameTextRetag.json();
  expect(retagBody.duplicate).toBe(true);

  const changedRetag = await slackEvent({
    event: {
      channel: "#helpdesk-triage",
      text: "@ai another request in the same thread",
      thread_ts: "1710000001.000100",
      ts: "1710000001.000300",
      type: "message",
      user: "U101",
    },
    event_id: "Ev-vpn-retag-changed",
    type: "event_callback",
    workspace: "acme-ops.slack.com",
  });
  expect(await changedRetag.json()).toEqual({
    accepted: true,
    duplicate: true,
    queued: true,
  });

  const threadFollowUp = await slackEvent({
    event: {
      channel: "#helpdesk-triage",
      text: "I am seeing the same error in this thread",
      thread_ts: "1710000001.000100",
      ts: "1710000002.000100",
      type: "message",
      user: "U202",
      user_name: "Alex Rivera",
    },
    event_id: "Ev-vpn-followup",
    type: "event_callback",
    workspace: "acme-ops.slack.com",
  });
  expect(threadFollowUp.status).toBe(200);

  const repeatedFollowUp = await slackEvent({
    event: {
      channel: "#helpdesk-triage",
      text: "following up",
      thread_ts: "1710000001.000100",
      ts: "1710000002.000200",
      type: "message",
      user: "U202",
    },
    event_id: "Ev-vpn-followup-repeat-1",
    type: "event_callback",
    workspace: "acme-ops.slack.com",
  });
  expect(await repeatedFollowUp.json()).toMatchObject({ duplicate: false });
  const sameBodyFollowUp = await slackEvent({
    event: {
      channel: "#helpdesk-triage",
      text: "following up",
      thread_ts: "1710000001.000100",
      ts: "1710000002.000300",
      type: "message",
      user: "U202",
    },
    event_id: "Ev-vpn-followup-repeat-2",
    type: "event_callback",
    workspace: "acme-ops.slack.com",
  });
  expect(await sameBodyFollowUp.json()).toMatchObject({ duplicate: false });

  await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      slackEvent({
        event: {
          channel: "#helpdesk-triage",
          text: "@ai Okta MFA reset needed urgently",
          thread_ts: "1710000010.000100",
          ts: "1710000010.000100",
          type: "message",
          user: "U303",
          user_name: "Daniel Kim",
        },
        event_id: `Ev-concurrent-${index}`,
        type: "event_callback",
        workspace: "acme-ops.slack.com",
      })
    )
  );

  const failedDelivery = await slackEvent({
    event: {
      channel: "#helpdesk-triage",
      text: "@ai Confidential payroll outage body",
      ts: "1710000020.000100",
      type: "message",
      user: "U404",
      user_name: "Emily Carter",
    },
    event_id: "Ev-slack-fail",
    simulate_slack_error: true,
    type: "event_callback",
    workspace: "acme-ops.slack.com",
  });
  expect(failedDelivery.status).toBe(202);
  const failedDeliveryText = await failedDelivery.text();
  expect(failedDeliveryText).toContain(
    "Slack delivery failed; request queued in central queue."
  );
  expect(failedDeliveryText).not.toContain("xoxb-secret-token-canary");
  expect(failedDeliveryText).not.toContain(signingSecret);
  expect(failedDeliveryText).not.toContain("Confidential payroll outage body");

  const queueHtml = await text(get("/slack", agent.cookie));
  expect(queueHtml).toContain("Central Queue (3 unassigned)");
  expect(queueHtml).toContain(
    "Ticket #1</strong> · Unassigned · Owner: Priya Desai (U101) · Source thread: acme-ops.slack.com #helpdesk-triage 1710000001.000100"
  );
  expect(queueHtml).toContain(
    "Escalation reason: No approved SOP matched this request."
  );
  expect(queueHtml).toContain(
    "Priya Desai</strong> (1710000001.000100):"
  );
  expect(queueHtml).toContain(
    "Alex Rivera</strong> (1710000002.000100): I am seeing the same error in this thread"
  );
  expect(
    queueHtml.split(
      "Priya Desai</strong> (1710000001.000100):"
    ).length - 1
  ).toBe(1);
  expect(queueHtml).toContain("Owner: Daniel Kim (U303)");
  expect(queueHtml).toContain("1710000002.000200");
  expect(queueHtml).toContain("1710000002.000300");
  expect(queueHtml).not.toContain("another request in the same thread");
  expect(queueHtml).toContain("Owner: Emily Carter (U404)");
  expect(queueHtml).toContain(
    "Slack delivery failed; request queued in central queue."
  );

  const adminSlackSettings = await text(get("/settings/slack", admin.cookie));
  expect(adminSlackSettings).toContain(
    "Slack delivery failed; request queued in central queue."
  );
  expect(adminSlackSettings).not.toContain("xoxb-secret-token-canary");
  expect(adminSlackSettings).not.toContain(signingSecret);
  expect(adminSlackSettings).not.toContain("Confidential payroll outage body");

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
  const persistedSlack = await text(get("/settings/slack", nextAdmin.cookie));
  expect(persistedSlack).toContain("acme-ops.slack.com");
  expect(persistedSlack).toContain("#helpdesk-triage");
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
  const persistedQueue = await text(get("/slack", again.cookie));
  expect(persistedQueue).toContain("Central Queue (3 unassigned)");
  expect(persistedQueue).toContain("Owner: Priya Desai (U101)");
  expect(persistedQueue).toContain("1710000002.000200");
  expect(persistedQueue).toContain("1710000002.000300");
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
  expect(
    db.prepare(`
      SELECT COUNT(*) AS count FROM slack_messages
      JOIN slack_requests ON slack_requests.id = slack_messages.request_id
      WHERE slack_requests.thread_ts = ?
    `).get("1710000001.000100").count
  ).toBe(4);
  db.exec(`
    CREATE TRIGGER deny_grant BEFORE UPDATE OF role ON users BEGIN SELECT RAISE(ABORT, 'write denied'); END;
    CREATE TRIGGER deny_slack_save BEFORE UPDATE ON slack_settings BEGIN SELECT RAISE(ABORT, 'slack write denied'); END;
  `);
  db.close();
  const failedSlack = await post(
    "/settings/slack",
    { channel: "#unsaved-channel", workspace: "unsaved-workspace" },
    nextAdmin.cookie
  );
  expect(failedSlack.status).toBe(500);
  const failedSlackBody = await failedSlack.text();
  expect(failedSlackBody).toContain("Unable to save Slack settings");
  expect(failedSlackBody).toContain("unsaved-workspace");
  expect(failedSlackBody).toContain("#unsaved-channel");
  expect(failedSlackBody).not.toContain("slack write denied");
  expect(failedSlackBody).not.toContain("Slack settings saved.");
  const unchangedSlack = await text(get("/settings/slack", nextAdmin.cookie));
  expect(unchangedSlack).toContain("acme-ops.slack.com");
  expect(unchangedSlack).toContain("#helpdesk-triage");

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
