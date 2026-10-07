import { expect, test } from "bun:test";

import {
  aiDeliveryModuleUrl,
  createAiSlackHarness,
  slackIntakeModuleUrl,
} from "./ai-slack-test-support.js";

test("delivery failures stay non-success and interrupted or withdrawn reservations never send", async () => {
  const harness = await createAiSlackHarness();
  try {
    const { address, running } = await harness.start();
    const db = harness.database();
    const verifyDelivery = async (mode, eventId, threadTs, expectedStatus) => {
      harness.setMode(mode);
      const response = await harness.intake(address, {
        eventId,
        text: "Reset Password",
        threadTs,
      });
      expect(response.status).toBe(202);
      expect(
        db
          .prepare(
            "SELECT status, slack_ts, sent_at FROM ai_answers JOIN slack_requests ON slack_requests.id = ai_answers.request_id WHERE thread_ts = ?"
          )
          .get(threadTs)
      ).toEqual({
        sent_at: null,
        slack_ts: null,
        status: expectedStatus,
      });
    };
    await verifyDelivery("reject", "Ev-reject", "1713000000.000001", "failed");
    await verifyDelivery(
      "unknown",
      "Ev-unknown",
      "1713000001.000001",
      "uncertain"
    );
    await verifyDelivery(
      "http_error",
      "Ev-http",
      "1713000002.000001",
      "uncertain"
    );
    await verifyDelivery(
      "invalid_ack",
      "Ev-ack",
      "1713000003.000001",
      "uncertain"
    );
    expect(
      db.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(4);

    db.exec(`
      INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name)
        VALUES (90, 'T123ABC456', 'C123ABC456', '1713000090.000001', 'U-CRASH', 'Crash Owner');
      INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body)
        VALUES (90, 'Ev-crash', '1713000090.000001', 'U-CRASH', 'Crash Owner', 'Reset Password');
      INSERT INTO ai_answers (request_id, version_id, body, status)
        VALUES (90, 100, 'Approved reset procedure', 'sending');
    `);
    running.kill();
    await running.exited;
    const restarted = await harness.start();
    const crashReplay = await harness.intake(restarted.address, {
      eventId: "Ev-crash",
      text: "Reset Password",
      threadTs: "1713000090.000001",
      user: "U-CRASH",
      userName: "Crash Owner",
    });
    expect(await crashReplay.json()).toMatchObject({
      duplicate: true,
      queued: false,
    });
    expect(
      db.prepare("SELECT status FROM ai_answers WHERE request_id = 90").get()
    ).toEqual({ status: "sending" });
    expect(
      db.prepare("SELECT id FROM tickets WHERE request_id = 90").get()
    ).toBeUndefined();

    db.exec(`
      INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name)
        VALUES (91, 'T123ABC456', 'C123ABC456', '1713000091.000001', 'U-WITHDRAW', 'Withdraw Owner');
      INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body)
        VALUES (91, 'Ev-withdraw-before-send', '1713000091.000001', 'U-WITHDRAW', 'Withdraw Owner', 'Reset Password');
      INSERT INTO ai_answers (request_id, version_id, body, status)
        VALUES (91, 100, 'Approved reset procedure', 'sending');
      UPDATE sops SET status = 'withdrawn' WHERE id = 100;
    `);
    harness.setMode("success");
    const beforeWithdrawal = harness.calls.length;
    const withdrawn = await harness.runDriver(`
      const { deliverAiAnswer } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      console.log(JSON.stringify(await deliverAiAnswer(91)));
    `);
    expect(withdrawn).toMatchObject({ queued: true, status: "failed" });
    expect(harness.calls).toHaveLength(beforeWithdrawal);
    expect(
      db
        .prepare(
          "SELECT status, error, slack_ts, sent_at FROM ai_answers WHERE request_id = 91"
        )
        .get()
    ).toEqual({
      error: "eligibility_changed",
      sent_at: null,
      slack_ts: null,
      status: "failed",
    });
    expect(
      db
        .prepare("SELECT count(*) AS count FROM tickets WHERE request_id = 91")
        .get().count
    ).toBe(1);
    db.exec(`
      INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name)
        VALUES (92, 'T123ABC456', 'C123ABC456', '1713000092.000001', 'U-ATOMIC', 'Atomic Owner');
      INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body)
        VALUES (92, 'Ev-atomic', '1713000092.000001', 'U-ATOMIC', 'Atomic Owner', 'Reset Password');
      INSERT INTO ai_answers (request_id, version_id, body, status)
        VALUES (92, 100, 'Approved reset procedure', 'sending');
      CREATE TRIGGER reject_escalation BEFORE INSERT ON tickets WHEN NEW.request_id = 92
        BEGIN SELECT RAISE(ABORT, 'Simulated storage failure'); END;
    `);
    const atomicFailure = await harness.runDriver(`
      const { deliverAiAnswer } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      let rejected = false;
      try { await deliverAiAnswer(92); } catch { rejected = true; }
      console.log(JSON.stringify({ rejected }));
    `);
    expect(atomicFailure).toEqual({ rejected: true });
    expect(
      db.prepare("SELECT status FROM ai_answers WHERE request_id = 92").get()
    ).toEqual({ status: "sending" });
    expect(
      db.prepare("SELECT id FROM tickets WHERE request_id = 92").get()
    ).toBeUndefined();
    db.close();
  } finally {
    await harness.stop();
  }
}, 30_000);

test("concurrent deliveries claim one dispatch and never resend after restart", async () => {
  const harness = await createAiSlackHarness();
  const db = harness.database();
  try {
    db.exec(`
      INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name)
        VALUES (90, 'T123ABC456', 'C123ABC456', '1715000090.000001', 'U-RACE', 'Race Owner');
      INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body)
        VALUES (90, 'Ev-delivery-race', '1715000090.000001', 'U-RACE', 'Race Owner', 'Reset Password');
      INSERT INTO ai_answers (request_id, version_id, body, status)
        VALUES (90, 100, 'Approved reset procedure', 'sending');
    `);
    harness.setMode("slow");
    const results = await harness.runDriver(`
      const { deliverAiAnswer } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      console.log(JSON.stringify(await Promise.all([deliverAiAnswer(90), deliverAiAnswer(90)])));
    `);
    expect(harness.calls).toHaveLength(1);
    expect(results).toEqual([
      { queued: false, status: "sent" },
      { queued: false, status: "uncertain" },
    ]);
    expect(
      db
        .prepare(
          "SELECT status, slack_ts, sent_at FROM ai_answers WHERE request_id = 90"
        )
        .get()
    ).toEqual({
      sent_at: expect.any(String),
      slack_ts: "1719999999.000001",
      status: "sent",
    });
    expect(
      db.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(0);
    const replay = await harness.runDriver(`
      const { deliverAiAnswer } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      console.log(JSON.stringify(await deliverAiAnswer(90)));
    `);
    expect(replay).toEqual({ queued: false, status: "uncertain" });
    expect(harness.calls).toHaveLength(1);

    db.exec(`
      INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name)
        VALUES (91, 'T123ABC456', 'C123ABC456', '1715000091.000001', 'U-RACE', 'Race Owner');
      INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body)
        VALUES (91, 'Ev-process-race', '1715000091.000001', 'U-RACE', 'Race Owner', 'Reset Password');
      INSERT INTO ai_answers (request_id, version_id, body, status)
        VALUES (91, 100, 'Approved reset procedure', 'sending');
      CREATE TABLE delivery_race_ready (worker INTEGER PRIMARY KEY);
    `);
    const deliveries = await Promise.all(
      [1, 2].map((worker) =>
        harness.runDriver(`
      const { deliverAiAnswer } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      const { ensureAiAnswerSchema } = await import(${JSON.stringify(new URL("ai-answers.ts", aiDeliveryModuleUrl).href)});
      const { getDatabase } = await import(${JSON.stringify(new URL("auth.ts", aiDeliveryModuleUrl).href)});
      ensureAiAnswerSchema();
      const db = getDatabase();
      db.prepare('INSERT INTO delivery_race_ready (worker) VALUES (?)').run(${worker});
      const deadline = Date.now() + 5000;
      while (db.prepare('SELECT count(*) AS count FROM delivery_race_ready').get().count !== 2) {
        if (Date.now() > deadline) throw new Error('Delivery race barrier timed out');
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      console.log(JSON.stringify(await deliverAiAnswer(91)));
      db.close();
    `)
      )
    );
    expect(harness.calls).toHaveLength(2);
    expect(
      deliveries.filter((delivery) => delivery.status === "sent")
    ).toHaveLength(1);
    expect(
      deliveries.filter((delivery) => delivery.status === "uncertain")
    ).toHaveLength(1);
    expect(
      db.prepare("SELECT status FROM ai_answers WHERE request_id = 91").get()
    ).toEqual({ status: "sent" });
    expect(
      db.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(0);
  } finally {
    db.close();
    await harness.stop();
  }
}, 30_000);

test("dispatch claim survives process exit after Slack accepts without false success or resend", async () => {
  const harness = await createAiSlackHarness();
  const db = harness.database();
  try {
    db.exec(`
      INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name)
        VALUES (90, 'T123ABC456', 'C123ABC456', '1716000090.000001', 'U-CRASH', 'Crash Owner');
      INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body)
        VALUES (90, 'Ev-dispatch-crash', '1716000090.000001', 'U-CRASH', 'Crash Owner', 'Reset Password');
      INSERT INTO ai_answers (request_id, version_id, body, status)
        VALUES (90, 100, 'Approved reset procedure', 'sending');
    `);
    const interrupted = await harness.runDriver(`
      const { deliverAiAnswer } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (...args) => {
        const response = await originalFetch(...args);
        console.log(JSON.stringify({ accepted: response.ok }));
        process.exit(0);
      };
      await deliverAiAnswer(90);
    `);
    expect(interrupted).toEqual({ accepted: true });
    expect(harness.calls).toHaveLength(1);
    expect(
      db
        .prepare(
          "SELECT status, dispatch_claimed_at, slack_ts, sent_at FROM ai_answers WHERE request_id = 90"
        )
        .get()
    ).toEqual({
      dispatch_claimed_at: expect.any(String),
      sent_at: null,
      slack_ts: null,
      status: "sending",
    });
    const replay = await harness.runDriver(`
      const { deliverAiAnswer } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      console.log(JSON.stringify(await deliverAiAnswer(90)));
    `);
    expect(replay).toEqual({ queued: false, status: "uncertain" });
    expect(harness.calls).toHaveLength(1);
    expect(
      db
        .prepare("SELECT status, sent_at FROM ai_answers WHERE request_id = 90")
        .get()
    ).toEqual({ sent_at: null, status: "sending" });
  } finally {
    db.close();
    await harness.stop();
  }
}, 30_000);

test("legacy sending reservations stay blocked when dispatch claims are migrated", async () => {
  const harness = await createAiSlackHarness();
  const db = harness.database();
  try {
    db.exec(`
      ALTER TABLE ai_answers DROP COLUMN dispatch_claimed_at;
      INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name) VALUES
        (90, 'T123ABC456', 'C123ABC456', '1717000090.000001', 'U-LEGACY', 'Legacy Owner'),
        (91, 'T123ABC456', 'C123ABC456', '1717000091.000001', 'U-LEGACY', 'Legacy Owner');
      INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body)
        VALUES (90, 'Ev-legacy-send', '1717000090.000001', 'U-LEGACY', 'Legacy Owner', 'Reset Password');
      INSERT INTO ai_answers (request_id, version_id, body, status)
        VALUES (90, 100, 'Approved reset procedure', 'sending');
      INSERT INTO ai_answers (request_id, version_id, body, status, slack_ts, sent_at)
        VALUES (91, 100, 'Approved reset procedure', 'sent', '1719999999.000001', '2026-10-03T00:00:00.000Z');
    `);
    const migrated = await harness.runDriver(`
      const { deliverAiAnswer } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      console.log(JSON.stringify(await deliverAiAnswer(90)));
    `);
    expect(migrated).toEqual({ queued: false, status: "uncertain" });
    expect(harness.calls).toHaveLength(0);
    expect(
      db
        .prepare(
          "SELECT status, dispatch_claimed_at, created_at, slack_ts, sent_at FROM ai_answers WHERE request_id = 90"
        )
        .get()
    ).toMatchObject({
      created_at: expect.any(String),
      dispatch_claimed_at: expect.any(String),
      sent_at: null,
      slack_ts: null,
      status: "sending",
    });
    expect(
      db
        .prepare(
          "SELECT dispatch_claimed_at = created_at AS blocked FROM ai_answers WHERE request_id = 90"
        )
        .get()
    ).toEqual({ blocked: 1 });
    expect(
      db
        .prepare(
          "SELECT status, slack_ts, sent_at FROM ai_answers WHERE request_id = 91"
        )
        .get()
    ).toEqual({
      sent_at: "2026-10-03T00:00:00.000Z",
      slack_ts: "1719999999.000001",
      status: "sent",
    });
    const restarted = await harness.runDriver(`
      const { deliverAiAnswer } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      console.log(JSON.stringify(await deliverAiAnswer(90)));
    `);
    expect(restarted).toEqual({ queued: false, status: "uncertain" });
    expect(harness.calls).toHaveLength(0);
    db.exec(`
      INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name)
        VALUES (92, 'T123ABC456', 'C123ABC456', '1717000092.000001', 'U-NEW', 'New Owner');
      INSERT INTO slack_messages (request_id, event_id, message_ts, user_id, user_name, body)
        VALUES (92, 'Ev-after-migration', '1717000092.000001', 'U-NEW', 'New Owner', 'Reset Password');
      INSERT INTO ai_answers (request_id, version_id, body, status)
        VALUES (92, 100, 'Approved reset procedure', 'sending');
    `);
    const fresh = await harness.runDriver(`
      const { deliverAiAnswer } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      console.log(JSON.stringify(await deliverAiAnswer(92)));
    `);
    expect(fresh).toEqual({ queued: false, status: "sent" });
    expect(harness.calls).toHaveLength(1);
  } finally {
    db.close();
    await harness.stop();
  }
}, 30_000);

test("missing Slack bot token fails once and queues staff review", async () => {
  const harness = await createAiSlackHarness({ botToken: "" });
  try {
    const { address } = await harness.start();
    const response = await harness.intake(address, {
      eventId: "Ev-missing-token",
      text: "Reset Password",
      threadTs: "1714000000.000001",
    });
    expect(response.status).toBe(202);
    expect(harness.calls).toHaveLength(0);
    const db = harness.database();
    expect(db.prepare("SELECT status, error FROM ai_answers").get()).toEqual({
      error: "Slack bot token not configured.",
      status: "failed",
    });
    expect(
      db.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(1);
    const fallback = await harness.intake(address, {
      eventId: "Ev-fallback-missing-token",
      text: "Unknown request",
      threadTs: "1714000001.000001",
    });
    expect(fallback.status).toBe(202);
    expect(
      db
        .prepare(
          "SELECT status, error, slack_ts, sent_at FROM slack_fallback_deliveries"
        )
        .get()
    ).toEqual({
      error: "Slack bot token not configured.",
      sent_at: null,
      slack_ts: null,
      status: "failed",
    });
    expect(
      db.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(2);
    expect(harness.calls).toHaveLength(0);
    db.close();
  } finally {
    await harness.stop();
  }
}, 30_000);

test("fallback rejection and uncertain acknowledgements retain tickets without automatic retries", async () => {
  const harness = await createAiSlackHarness();
  const db = harness.database();
  try {
    const { address } = await harness.start();
    let sequence = 0;
    const verify = async (mode, status) => {
      sequence += 1;
      harness.setMode(mode);
      const input = {
        eventId: `Ev-fallback-${mode}`,
        text: "Private unmatched body",
        threadTs: `172000000${sequence}.000001`,
      };
      const response = await harness.intake(address, input);
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({
        accepted: true,
        duplicate: false,
        queued: true,
      });
      const row = db
        .prepare(`SELECT d.status, d.error, d.slack_ts, d.sent_at, d.dispatch_claimed_at,
        tickets.slack_error FROM slack_fallback_deliveries d
        JOIN tickets ON tickets.id = d.ticket_id
        JOIN slack_requests r ON r.id = tickets.request_id WHERE r.thread_ts = ?`)
        .get(input.threadTs);
      expect(row).toMatchObject({
        dispatch_claimed_at: expect.any(String),
        sent_at: null,
        slack_ts: null,
        status,
      });
      expect(row.error).toBe(row.slack_error);
      expect(row.error).not.toContain("Private unmatched body");
      expect(row.error).not.toContain("new_unknown_code");
      expect(row.error).not.toContain("xoxb-test");
      const calls = harness.calls.length;
      harness.setMode("success");
      const replay = await harness.intake(address, input);
      expect(replay.status).toBe(200);
      expect(harness.calls).toHaveLength(calls);
    };
    await verify("reject", "failed");
    await verify("rate", "failed");
    await verify("unknown", "uncertain");
    await verify("http_error", "uncertain");
    await verify("malformed", "uncertain");
    await verify("wrong_channel", "uncertain");
    await verify("bad_timestamp", "uncertain");
    await verify("timeout", "uncertain");
    expect(
      db.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(8);
    expect(
      db.prepare("SELECT count(*) AS count FROM ai_answers").get().count
    ).toBe(0);
    expect(
      db.prepare("SELECT count(*) AS count FROM official_replies").get().count
    ).toBe(0);
  } finally {
    db.close();
    await harness.stop();
  }
}, 40_000);

test("fallback one-shot claims survive interruption and persistence failure while unclaimed replay recovers", async () => {
  const harness = await createAiSlackHarness();
  const db = harness.database();
  try {
    const { address } = await harness.start();
    const reserve = async (eventId, threadTs) =>
      await harness.runDriver(`
      const { ingestSlackEvent } = await import(${JSON.stringify(slackIntakeModuleUrl)});
      console.log(JSON.stringify(ingestSlackEvent({type:'event_callback', team_id:'T123ABC456', event_id:${JSON.stringify(eventId)},
        event:{channel:'C123ABC456', type:'app_mention', user:'U-REQUESTER', text:'Unmatched request', ts:${JSON.stringify(threadTs)}}})));
    `);
    const unclaimed = await reserve("Ev-before-claim", "1721000000.000001");
    expect(unclaimed.queued).toBe(true);
    expect(harness.calls).toHaveLength(0);
    const recovered = await harness.intake(address, {
      eventId: "Ev-before-claim",
      text: "Changed replay body",
      threadTs: "1721999999.000001",
    });
    expect(recovered.status).toBe(200);
    expect(await recovered.json()).toEqual({
      accepted: true,
      duplicate: true,
      queued: true,
    });
    expect(harness.calls[0].body.thread_ts).toBe("1721000000.000001");
    expect(
      db.prepare("SELECT count(*) AS count FROM slack_requests").get().count
    ).toBe(1);

    const claimed = await reserve("Ev-after-claim", "1721000001.000001");
    await harness.runDriver(`
      const { deliverFallbackNotice } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      globalThis.fetch = async () => process.exit(0);
      await deliverFallbackNotice(${claimed.fallbackDeliveryRequestId});
    `);
    const blocked = await harness.intake(address, {
      eventId: "Ev-after-claim",
      text: "Unmatched request",
      threadTs: "1721000001.000001",
    });
    expect(blocked.status).toBe(200);
    expect(harness.calls).toHaveLength(1);
    expect(
      db
        .prepare(
          "SELECT status, dispatch_claimed_at, slack_ts, sent_at FROM slack_fallback_deliveries WHERE ticket_id = 2"
        )
        .get()
    ).toEqual({
      dispatch_claimed_at: expect.any(String),
      sent_at: null,
      slack_ts: null,
      status: "sending",
    });

    const accepted = await reserve("Ev-after-acceptance", "1721000002.000001");
    await harness.runDriver(`
      const { deliverFallbackNotice } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      const send = globalThis.fetch;
      globalThis.fetch = async (...args) => { await send(...args); process.exit(0); };
      await deliverFallbackNotice(${accepted.fallbackDeliveryRequestId});
    `);
    expect(harness.calls).toHaveLength(2);
    await harness.intake(address, {
      eventId: "Ev-after-acceptance",
      text: "Unmatched request",
      threadTs: "1721000002.000001",
    });
    expect(harness.calls).toHaveLength(2);
    expect(
      db
        .prepare(
          "SELECT status, slack_ts, sent_at FROM slack_fallback_deliveries WHERE ticket_id = 3"
        )
        .get()
    ).toEqual({ sent_at: null, slack_ts: null, status: "sending" });

    db.exec(`CREATE TRIGGER reject_fallback_result BEFORE UPDATE OF status ON slack_fallback_deliveries
      WHEN NEW.ticket_id = 4 BEGIN SELECT RAISE(ABORT, 'Private provider detail'); END;`);
    const failedSave = await harness.intake(address, {
      eventId: "Ev-fallback-save",
      text: "Unmatched request",
      threadTs: "1721000003.000001",
    });
    expect(failedSave.status).toBe(500);
    expect(await failedSave.text()).not.toContain("Private provider detail");
    expect(harness.calls).toHaveLength(3);
    expect(
      db
        .prepare(
          "SELECT status, slack_ts, sent_at, dispatch_claimed_at FROM slack_fallback_deliveries WHERE ticket_id = 4"
        )
        .get()
    ).toEqual({
      dispatch_claimed_at: expect.any(String),
      sent_at: null,
      slack_ts: null,
      status: "sending",
    });
    db.exec("DROP TRIGGER reject_fallback_result");
    await harness.intake(address, {
      eventId: "Ev-fallback-save",
      text: "Unmatched request",
      threadTs: "1721000003.000001",
    });
    expect(harness.calls).toHaveLength(3);

    const transport = await reserve(
      "Ev-fallback-transport",
      "1721000004.000001"
    );
    const transportResult = await harness.runDriver(`
      const { deliverFallbackNotice } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      globalThis.fetch = async () => { throw new Error('Secret transport detail'); };
      console.log(JSON.stringify(await deliverFallbackNotice(${transport.fallbackDeliveryRequestId})));
    `);
    expect(transportResult).toEqual({ queued: true, status: "uncertain" });
    expect(
      db
        .prepare(
          "SELECT error FROM slack_fallback_deliveries WHERE ticket_id = 5"
        )
        .get().error
    ).not.toContain("Secret transport detail");
    const persisted = await reserve(
      "Ev-persisted-destination",
      "1721000005.000001"
    );
    db.prepare(
      "UPDATE slack_settings SET channel = 'C-NEW' WHERE id = 1"
    ).run();
    db.prepare(
      "UPDATE tickets SET slack_error = 'Unrelated integration warning.' WHERE id = 6"
    ).run();
    const sent = await harness.runDriver(`
      const { deliverFallbackNotice } = await import(${JSON.stringify(aiDeliveryModuleUrl)});
      console.log(JSON.stringify(await deliverFallbackNotice(${persisted.fallbackDeliveryRequestId})));
    `);
    expect(sent).toEqual({ queued: true, status: "sent" });
    expect(harness.calls[3].body.channel).toBe("C123ABC456");
    expect(harness.calls[3].body.thread_ts).toBe("1721000005.000001");
    expect(
      db.prepare("SELECT slack_error FROM tickets WHERE id = 6").get()
        .slack_error
    ).toBe("Unrelated integration warning.");
    expect(
      db.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(6);
  } finally {
    db.close();
    await harness.stop();
  }
}, 40_000);
