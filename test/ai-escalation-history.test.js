import { expect, test } from "bun:test";

import {
  aiDeliveryModuleUrl,
  createAiSlackHarness,
  slackIntakeModuleUrl,
} from "./ai-slack-test-support.js";

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

const alertTexts = (html) =>
  [...html.matchAll(/<p\b[^>]*role="alert"[^>]*>(?<text>[^<]*)<\/p>/gu)].map(
    (match) => match.groups.text
  );

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

test("fallback warnings stay visible to staff after claim and restart without answer attribution", async () => {
  const harness = await createAiSlackHarness();
  const database = harness.database();
  try {
    const first = await harness.start();
    const login = await post(`${first.address}/login`, {
      email: "admin@example.com",
      password: "secure-admin-password-2026",
    });
    expect(login.status).toBe(303);
    const adminCookie = login.headers.get("set-cookie")?.split(";")[0] ?? "";
    const created = await post(
      `${first.address}/settings/roles?/create`,
      {
        email: "agent@example.com",
        password: "secure-agent-password-2026",
      },
      adminCookie
    );
    expect(created.status).toBe(200);
    const agentLogin = await post(`${first.address}/login`, {
      email: "agent@example.com",
      password: "secure-agent-password-2026",
    });
    const agentCookie =
      agentLogin.headers.get("set-cookie")?.split(";")[0] ?? "";

    harness.setMode("reject");
    const failed = await harness.intake(first.address, {
      eventId: "Ev-staff-fallback-failed",
      text: "Unmatched request",
      threadTs: "1730000000.000001",
    });
    expect(failed.status).toBe(202);
    harness.setMode("unknown");
    const uncertain = await harness.intake(first.address, {
      eventId: "Ev-staff-fallback-uncertain",
      text: "Unmatched request",
      threadTs: "1730000001.000001",
    });
    expect(uncertain.status).toBe(202);
    await harness.runDriver(`
      const { ingestSlackEvent } = await import(${JSON.stringify(slackIntakeModuleUrl)});
      const { deliverFallbackNotice } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      const result = ingestSlackEvent({type:'event_callback', team_id:'T123ABC456', event_id:'Ev-staff-fallback-interrupted',
        event:{channel:'C123ABC456', type:'app_mention', user:'U-REQUESTER', text:'Unmatched request', ts:'1730000002.000001'}});
      globalThis.fetch = async () => process.exit(0);
      await deliverFallbackNotice(result.fallbackDeliveryRequestId);
    `);
    harness.setMode("success");
    const confirmed = await harness.intake(first.address, {
      eventId: "Ev-staff-fallback-sent",
      text: "Unmatched request",
      threadTs: "1730000003.000001",
    });
    expect(confirmed.status).toBe(200);
    expect(
      database.prepare("SELECT slack_error FROM tickets WHERE id = 4").get()
        .slack_error
    ).toBe("");
    const warnings = [
      "Slack rejected fallback notification: channel_not_found",
      "Fallback notification not confirmed; do not retry automatically.",
      "Fallback notification not confirmed; staff must check the Slack thread before replying.",
    ];
    const before = await fetch(`${first.address}/slack`, {
      headers: { cookie: agentCookie },
    });
    const beforeHtml = await before.text();
    expect(alertTexts(region(beforeHtml, "Central queue"))).toEqual(warnings);
    const claims = await Promise.all(
      ["1", "2", "3", "4"].map((ticketId) =>
        post(`${first.address}/slack?/claim`, { ticketId }, agentCookie)
      )
    );
    expect(claims.map((response) => response.status)).toEqual([
      200, 200, 200, 200,
    ]);
    const verifyWarnings = (html) => {
      for (const label of ["My assigned tickets", "Support ticket history"]) {
        const content = region(html, label);
        expect(alertTexts(content)).toEqual(expect.arrayContaining(warnings));
        expect(content).not.toContain("Delivered to Slack");
        expect(content).not.toContain(
          "Prior AI guidance (not an official reply)"
        );
        expect(content).not.toContain("xoxb-test");
        expect(content).not.toContain("ai-slack-signing-secret");
      }
      expect(region(html, "Central queue")).toContain("No unassigned tickets");
      expect(region(html, "Support ticket history")).toContain(
        "No official replies from Slack yet."
      );
    };
    const claimed = await fetch(`${first.address}/slack`, {
      headers: { cookie: agentCookie },
    });
    verifyWarnings(await claimed.text());
    first.running.kill();
    await first.running.exited;
    const restarted = await harness.start();
    const persisted = await fetch(`${restarted.address}/slack`, {
      headers: { cookie: agentCookie },
    });
    expect(persisted.status).toBe(200);
    verifyWarnings(await persisted.text());
    const unauthorized = await fetch(`${restarted.address}/slack/__data.json`);
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.text()).not.toContain(warnings[0]);
    const revoked = await post(
      `${restarted.address}/settings/roles?/change`,
      {
        email: "agent@example.com",
        role: "revoked",
      },
      adminCookie
    );
    expect(revoked.status).toBe(200);
    const revokedData = await fetch(`${restarted.address}/slack/__data.json`, {
      headers: { cookie: agentCookie },
    });
    expect(revokedData.status).toBe(401);
    expect(await revokedData.text()).not.toContain(warnings[0]);
    expect(
      database.prepare("SELECT count(*) AS count FROM ai_answers").get().count
    ).toBe(0);
    expect(
      database.prepare("SELECT count(*) AS count FROM official_replies").get()
        .count
    ).toBe(0);
    expect(harness.calls).toHaveLength(3);
  } finally {
    database.close();
    await harness.stop();
  }
}, 50_000);
