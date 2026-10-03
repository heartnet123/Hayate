import { expect, test } from "bun:test";

import {
  aiDeliveryModuleUrl,
  createAiSlackHarness,
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
    db.close();
  } finally {
    await harness.stop();
  }
}, 30_000);
