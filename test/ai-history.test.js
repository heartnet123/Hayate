import { expect, test } from "bun:test";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createAiSlackHarness } from "./ai-slack-test-support.js";

const password = "secure-agent-password-2026";

const post = (address, route, fields, cookie = "") =>
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

const login = async (address, email, accountPassword) => {
  const response = await post(address, "/login", {
    email,
    password: accountPassword,
  });
  expect(response.status).toBe(303);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
};

const staffPage = (address, cookie) =>
  fetch(`${address}/slack`, { headers: { cookie } }).then((response) =>
    response.text()
  );

const section = (html, start, end) => {
  const startIndex = html.indexOf(start);
  const endIndex = html.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return html.slice(startIndex, endIndex);
};

const occurrences = (value, search) => value.split(search).length - 1;

test("staff AI history separates confirmed answers from delivery attention and survives restart", async () => {
  const harness = await createAiSlackHarness();
  let database;
  try {
    const first = await harness.start();
    database = harness.database();
    const intakeStatus = async (input) => {
      const response = await harness.intake(first.address, input);
      return response.status;
    };
    database.exec(`
      INSERT INTO sops (id, title, body, status, created_by, updated_by)
        VALUES (400, 'Escape HTML', 'Private editable body', 'active', 1, 1);
      INSERT INTO sop_versions (id, sop_id, title, body)
        VALUES (400, 400, 'Escape HTML', 'Approved HTML procedure\n<script>unsafe</script>');
      UPDATE sops SET active_version_id = 400 WHERE id = 400;
    `);

    harness.setMode("success");
    expect(
      await intakeStatus({
        eventId: "Ev-history-sent",
        text: "Reset Password",
        threadTs: "1715000000.000001",
      })
    ).toBe(200);
    expect(
      await intakeStatus({
        eventId: "Ev-history-escaped",
        text: "Escape HTML",
        threadTs: "1715000000.000002",
      })
    ).toBe(200);
    harness.setMode("reject");
    expect(
      await intakeStatus({
        eventId: "Ev-history-failed",
        text: "Reset Password",
        threadTs: "1715000001.000001",
      })
    ).toBe(202);
    harness.setMode("unknown");
    expect(
      await intakeStatus({
        eventId: "Ev-history-uncertain",
        text: "Reset Password",
        threadTs: "1715000002.000001",
      })
    ).toBe(202);
    harness.setMode("success");
    expect(
      await Promise.all(
        [
          ["Ev-history-draft", "Draft Only", "1715000003.000001"],
          ["Ev-history-withdrawn", "Withdrawn Only", "1715000004.000001"],
          ["Ev-history-missing", "Missing SOP", "1715000005.000001"],
        ].map(([eventId, text, threadTs]) =>
          intakeStatus({ eventId, text, threadTs })
        )
      )
    ).toEqual([200, 200, 200]);

    database.exec(`
      INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name)
        VALUES (90, 'T123ABC456', 'C123ABC456', '1715000090.000001', 'U-CRASH', 'Crash Owner');
      INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body)
        VALUES (90, 'Ev-history-crash', '1715000090.000001', 'U-CRASH', 'Crash Owner', 'Reset Password');
      INSERT INTO ai_answers (request_id, version_id, body, status)
        VALUES (90, 100, 'Approved reset procedure', 'sending');
    `);
    const fallbackTicket = database
      .prepare("SELECT id FROM tickets ORDER BY id LIMIT 1")
      .get();
    const legacyModuleUrl = pathToFileURL(
      path.join(import.meta.dir, "../apps/web/src/lib/server/sop-answers.ts")
    ).href;
    expect(
      await harness.runDriver(`
        const { recordSopAnswer } = await import(${JSON.stringify(legacyModuleUrl)});
        console.log(JSON.stringify(recordSopAnswer(${fallbackTicket.id}, 100, 'Legacy answer unchanged')));
      `)
    ).toBe("recorded");
    expect(
      database
        .prepare("SELECT body, version_id AS versionId FROM sop_answers")
        .get()
    ).toEqual({ body: "Legacy answer unchanged", versionId: 100 });
    database
      .prepare("UPDATE sops SET title = ?, body = ? WHERE id = 100")
      .run("Edited private title", "Edited private procedure");

    const sent = database
      .prepare("SELECT sent_at AS sentAt FROM ai_answers WHERE status = 'sent'")
      .get();
    const attentionRows = database
      .prepare(
        "SELECT created_at AS createdAt, error, status FROM ai_answers WHERE status != 'sent' ORDER BY request_id"
      )
      .all();
    expect(sent.sentAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u
    );
    expect(attentionRows.map((row) => row.status)).toEqual([
      "failed",
      "uncertain",
      "sending",
    ]);

    const adminCookie = await login(
      first.address,
      "admin@example.com",
      "secure-admin-password-2026"
    );
    const created = await post(
      first.address,
      "/settings/roles?/create",
      { email: "agent@example.com", password },
      adminCookie
    );
    expect(created.status).toBe(200);
    const agentCookie = await login(
      first.address,
      "agent@example.com",
      password
    );

    const verifyStaffView = (html) => {
      const history = section(
        html,
        "AI answer history (2)",
        "AI delivery attention (3)"
      );
      const attention = section(
        html,
        "AI delivery attention (3)",
        'id="central-queue"'
      );
      expect(history).toContain("Reset Password · version #100");
      expect(history).toContain("Escape HTML · version #400");
      expect(history).toContain("Requester (U-REQUESTER)");
      expect(history).toContain("T123ABC456 · C123ABC456 · 1715000000.000001");
      expect(history).toContain(`datetime="${sent.sentAt}"`);
      expect(history).toContain(
        sent.sentAt.replace("T", " ").replace("Z", " UTC")
      );
      expect(occurrences(history, "&lt;script>unsafe&lt;/script>")).toBe(2);
      expect(history).not.toContain("<script>unsafe</script>");
      expect(history).not.toContain("Claim ticket");
      expect(attention).toContain("Failed");
      expect(attention).toContain("Uncertain");
      expect(attention).toContain("Sending");
      expect(occurrences(attention, "Delivery not confirmed.")).toBe(3);
      expect(occurrences(attention, 'href="#central-queue"')).toBe(2);
      expect(attention).not.toContain("ui-badge-success");
      expect(attention).not.toContain("Answer sent");
      for (const row of attentionRows) {
        expect(attention).toContain(`datetime="${row.createdAt}"`);
        if (row.error) {
          expect(attention).toContain(row.error);
        }
      }
      expect(html).toContain("Central Queue (5 unassigned)");
      expect(html).toContain("No approved SOP matched this request.");
      return { attention, history };
    };

    const adminView = verifyStaffView(
      await staffPage(first.address, adminCookie)
    );
    const agentView = verifyStaffView(
      await staffPage(first.address, agentCookie)
    );
    expect(agentView).toEqual(adminView);
    expect(
      verifyStaffView(await staffPage(first.address, agentCookie))
    ).toEqual(agentView);

    const unauthorizedHtml = await fetch(`${first.address}/slack`, {
      headers: { accept: "text/html" },
      redirect: "manual",
    });
    expect(unauthorizedHtml.status).toBe(303);
    expect(unauthorizedHtml.headers.get("location")).toBe("/login");
    const unauthorizedData = await fetch(`${first.address}/slack/__data.json`);
    expect(unauthorizedData.status).toBe(401);
    expect(await unauthorizedData.text()).not.toContain(
      "Approved reset procedure"
    );

    first.running.kill();
    await first.running.exited;
    const restarted = await harness.start();
    expect(
      verifyStaffView(await staffPage(restarted.address, agentCookie))
    ).toEqual(agentView);
  } finally {
    database?.close();
    await harness.stop();
  }
}, 30_000);
