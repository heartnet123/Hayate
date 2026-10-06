import { expect, test } from "bun:test";

import { createAiSlackHarness } from "./ai-slack-test-support.js";

const post = (url, fields, cookie = "") =>
  fetch(url, {
    body: new URLSearchParams(fields),
    headers: {
      accept: "text/html",
      "content-type": "application/x-www-form-urlencoded",
      cookie,
      origin: new URL(url).origin,
    },
    method: "POST",
    redirect: "manual",
  });

const region = (html, label) =>
  html.split(`aria-label="${label}"`)[1]?.split("</section>")[0] ?? "";

test("staff see immutable prior AI guidance inside the correct ticket before claim and after restart, never as official replies", async () => {
  const harness = await createAiSlackHarness();
  let database;
  try {
    // Given two answered requests, with only the second promoted into ticket #1.
    const first = await harness.start();
    database = harness.database();
    database.exec(`
      INSERT INTO sops (id, title, body, status, created_by, updated_by)
        VALUES (400, 'Private edited title', 'Private edited procedure', 'active', 1, 1);
      INSERT INTO sop_versions (id, sop_id, title, body)
        VALUES (400, 400, 'Escalated Procedure', 'Approved guidance\n<script>unsafe</script>');
      UPDATE sops SET active_version_id = 400 WHERE id = 400;
    `);
    await harness.intake(first.address, {
      eventId: "Ev-unrelated",
      text: "Reset Password",
      threadTs: "1718000000.000001",
    });
    await harness.intake(first.address, {
      eventId: "Ev-escalated",
      text: "Escalated Procedure",
      threadTs: "1718000001.000001",
    });
    await harness.intake(first.address, {
      eventId: "Ev-confirm",
      messageTs: "1720000001.000001",
      parentThreadTs: "1718000001.000001",
      text: "SOP ไม่แก้ปัญหา",
      type: "message",
    });
    database.exec("UPDATE sops SET status = 'withdrawn' WHERE id = 400");
    const answer = database
      .prepare("SELECT sent_at AS sentAt FROM ai_answers WHERE request_id = 2")
      .get();
    const adminLogin = await post(`${first.address}/login`, {
      email: "admin@example.com",
      password: "secure-admin-password-2026",
    });
    expect(adminLogin.status).toBe(303);
    const adminCookie =
      adminLogin.headers.get("set-cookie")?.split(";")[0] ?? "";
    const created = await post(
      `${first.address}/settings/roles?/create`,
      { email: "agent@example.com", password: "secure-agent-password-2026" },
      adminCookie
    );
    expect(created.status).toBe(200);
    const agentLogin = await post(`${first.address}/login`, {
      email: "agent@example.com",
      password: "secure-agent-password-2026",
    });
    expect(agentLogin.status).toBe(303);
    const agentCookie =
      agentLogin.headers.get("set-cookie")?.split(";")[0] ?? "";

    // When active staff open the queue before accepting work.
    const pageResponse = await fetch(`${first.address}/slack`, {
      headers: { cookie: agentCookie },
    });
    expect(pageResponse.status).toBe(200);
    const html = await pageResponse.text();
    const queue = region(html, "Central queue");
    const verifyContext = (content) => {
      expect(content).toContain("Prior AI guidance (not an official reply)");
      expect(content).toContain("Escalated Procedure · version #400");
      expect(content).toContain(`datetime="${answer.sentAt}"`);
      expect(content).toContain("Approved guidance");
      expect(content).toContain("&lt;script>unsafe&lt;/script>");
      expect(content).not.toContain("<script>unsafe</script>");
      expect(content).not.toContain("Private edited procedure");
      expect(content).not.toContain("Reset Password");
    };

    // Then ticket context binds to request #2, with no official AI attribution.
    verifyContext(queue);
    expect(queue).toContain("SOP did not resolve the issue");
    expect(queue).toContain("Claim ticket #1");
    const history = region(html, "Support ticket history");
    verifyContext(history);
    expect(history).toContain("No official replies from Slack yet.");
    const adminResponse = await fetch(`${first.address}/slack`, {
      headers: { cookie: adminCookie },
    });
    verifyContext(region(await adminResponse.text(), "Central queue"));

    const claim = await post(
      `${first.address}/slack?/claim`,
      { ticketId: "1" },
      agentCookie
    );
    expect(claim.status).toBe(200);
    const claimedResponse = await fetch(`${first.address}/slack`, {
      headers: { cookie: agentCookie },
    });
    const claimed = await claimedResponse.text();
    expect(region(claimed, "Central queue")).not.toContain("Claim ticket #1");
    verifyContext(region(claimed, "My assigned tickets"));
    verifyContext(region(claimed, "Support ticket history"));

    first.running.kill();
    await first.running.exited;
    const restarted = await harness.start();
    const persistedResponse = await fetch(`${restarted.address}/slack`, {
      headers: { cookie: agentCookie },
    });
    const persisted = await persistedResponse.text();
    verifyContext(region(persisted, "My assigned tickets"));
    expect(region(persisted, "Support ticket history")).toContain(
      "No official replies from Slack yet."
    );

    const unauthorized = await fetch(`${restarted.address}/slack/__data.json`);
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.text()).not.toContain("Approved guidance");
    const revoked = await post(
      `${restarted.address}/settings/roles?/change`,
      { email: "agent@example.com", role: "revoked" },
      adminCookie
    );
    expect(revoked.status).toBe(200);
    const revokedData = await fetch(`${restarted.address}/slack/__data.json`, {
      headers: { cookie: agentCookie },
    });
    expect(revokedData.status).toBe(401);
    expect(await revokedData.text()).not.toContain("Approved guidance");
    expect(harness.calls).toHaveLength(2);
  } finally {
    database?.close();
    await harness.stop();
  }
}, 30_000);
