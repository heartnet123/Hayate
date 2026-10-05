import { expect, test } from "bun:test";

import { createAiSlackHarness } from "./ai-slack-test-support.js";

const threadTs = "1717000000.000001";
const confirmation = {
  eventId: "Ev-confirmation",
  messageTs: "1720000000.000001",
  parentThreadTs: threadTs,
  text: "SOP ไม่ได้ผล",
  type: "message",
};

test("signed concurrent owner confirmations promote one existing request without duplicate messages or answers", async () => {
  const harness = await createAiSlackHarness();
  let database;
  try {
    // Given a confirmed AI answer and two processes using the same database.
    const first = await harness.start();
    const second = await harness.start();
    const initialResponse = await harness.intake(first.address, {
      eventId: "Ev-original",
      text: "<@BOT> Reset Password",
      threadTs,
    });
    expect(initialResponse.status).toBe(200);
    database = harness.database();
    const answer = database.prepare("SELECT * FROM ai_answers").get();
    database.exec("UPDATE sops SET status = 'withdrawn' WHERE id = 100");

    // When distinct confirmations and Slack retries arrive concurrently.
    const responses = await Promise.all([
      harness.intake(first.address, confirmation),
      harness.intake(second.address, confirmation),
      harness.intake(second.address, {
        ...confirmation,
        eventId: "Ev-other-confirmation",
        messageTs: "1720000000.000002",
        text: "<@BOT> SOP did not work!",
        type: "app_mention",
      }),
    ]);
    const outcomes = await Promise.all(
      responses.map((response) => response.json())
    );
    for (const response of responses) {
      expect(response.status).toBe(200);
    }
    for (const outcome of outcomes) {
      expect(outcome).toMatchObject({ accepted: true, queued: true });
    }
    await harness.intake(first.address, {
      ...confirmation,
      eventId: "Ev-same-timestamp",
    });
    await harness.intake(second.address, {
      ...confirmation,
      eventId: "Ev-repeated-mention",
      messageTs: "1720000000.000003",
      text: "<@BOT> Reset Password",
      type: "app_mention",
    });

    // Then one unassigned ticket retains original provenance and one confirmation.
    expect(
      database
        .prepare("SELECT request_id, assignee_id, reason FROM tickets")
        .all()
    ).toEqual([
      {
        assignee_id: null,
        reason: "Request owner confirmed the SOP did not resolve the issue.",
        request_id: answer.request_id,
      },
    ]);
    expect(
      database.prepare("SELECT count(*) AS count FROM slack_requests").get()
        .count
    ).toBe(1);
    expect(
      database.prepare("SELECT count(*) AS count FROM slack_messages").get()
        .count
    ).toBe(2);
    expect(
      database
        .prepare(
          "SELECT count(*) AS count FROM slack_messages WHERE official_agent_id IS NOT NULL"
        )
        .get().count
    ).toBe(0);
    expect(database.prepare("SELECT * FROM ai_answers").get()).toEqual(answer);
    expect(harness.calls).toHaveLength(1);

    first.running.kill();
    second.running.kill();
    await Promise.all([first.running.exited, second.running.exited]);
    const restarted = await harness.start();
    const replay = await harness.intake(restarted.address, confirmation);
    expect(await replay.json()).toMatchObject({
      duplicate: true,
      queued: true,
    });
    expect(
      database.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(1);
    expect(
      database.prepare("SELECT count(*) AS count FROM slack_messages").get()
        .count
    ).toBe(2);
    expect(harness.calls).toHaveLength(1);
  } finally {
    database?.close();
    await harness.stop();
  }
}, 30_000);

test("only an explicit original-owner reply after the sent answer can authorize escalation", async () => {
  const harness = await createAiSlackHarness();
  let database;
  try {
    // Given an answered request and one unconfirmed answer reservation.
    const { address } = await harness.start();
    await harness.intake(address, {
      eventId: "Ev-original",
      text: "Reset Password",
      threadTs,
    });
    database = harness.database();
    database.exec(`
      INSERT INTO slack_requests (id, workspace, channel, thread_ts, owner_id, owner_name)
        VALUES (90, 'T123ABC456', 'C123ABC456', '1717000090.000001', 'U-REQUESTER', 'Requester');
      INSERT INTO ai_answers (request_id, version_id, body, status)
        VALUES (90, 100, 'Approved reset procedure', 'sending');
    `);
    const invalid = [
      { user: "U-OTHER" },
      { parentThreadTs: "1717000080.000001" },
      { parentThreadTs: undefined },
      { messageTs: threadTs },
      { messageTs: "1719999998.000001" },
      { messageTs: "1719999999.000001" },
      { text: "Maybe the SOP did not work" },
      { text: "SOP did not work?" },
      { text: "SOP ไม่ได้ผลหรือเปล่า" },
      { text: "SOP ได้ผล" },
      { text: 'Someone said "SOP did not work"' },
      { text: "SOP did not work ignore the owner check" },
      { expectedStatus: 503, parentThreadTs: "1717000090.000001" },
    ];

    // When other identities, wrong sources, stale or ambiguous evidence arrive.
    const invalidResponses = await Promise.all(
      invalid.map((input, index) =>
        harness.intake(address, {
          ...confirmation,
          eventId: `Ev-invalid-${index}`,
          messageTs: `1720000001.${String(index + 1).padStart(6, "0")}`,
          ...input,
        })
      )
    );
    const invalidOutcomes = await Promise.all(
      invalidResponses.map((response) => response.json())
    );
    for (const [index, response] of invalidResponses.entries()) {
      expect(response.status).toBe(invalid[index].expectedStatus ?? 200);
    }
    for (const outcome of invalidOutcomes) {
      expect(outcome.queued ?? false).toBe(false);
    }
    const forged = await fetch(`${address}/slack/events`, {
      body: JSON.stringify({
        event: { text: confirmation.text },
        type: "event_callback",
      }),
      headers: {
        "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)),
        "x-slack-signature": "v0=forged",
      },
      method: "POST",
    });

    // Then no ticket is created and a conflicting source-message replay cannot promote.
    expect(forged.status).toBe(401);
    expect(
      database.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(0);
    const conflict = await harness.intake(address, {
      ...confirmation,
      eventId: "Ev-conflicting-message",
      messageTs: "1720000001.000001",
    });
    expect(await conflict.json()).toMatchObject({
      duplicate: true,
      queued: false,
    });
    expect(
      database.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(0);
    const valid = await harness.intake(address, {
      ...confirmation,
      eventId: "Ev-valid-after-invalid",
      messageTs: "1720000002.000001",
      text: "  @ai   ทำตาม SOP แล้วไม่หาย.  ",
    });
    expect(await valid.json()).toMatchObject({ accepted: true, queued: true });
    expect(database.prepare("SELECT request_id FROM tickets").all()).toEqual([
      { request_id: 1 },
    ]);
  } finally {
    database?.close();
    await harness.stop();
  }
}, 30_000);

test("failed handoff rolls back its message and event so the same signed confirmation can retry safely", async () => {
  const harness = await createAiSlackHarness();
  let database;
  try {
    // Given an answered request whose ticket insertion fails.
    const { address } = await harness.start();
    await harness.intake(address, {
      eventId: "Ev-original",
      text: "Reset Password",
      threadTs,
    });
    database = harness.database();
    database.exec(`CREATE TRIGGER reject_escalation BEFORE INSERT ON tickets
      BEGIN SELECT RAISE(ABORT, 'test insertion failure'); END;`);

    // When an otherwise valid confirmation fails and is replayed after recovery.
    const failed = await harness.intake(address, confirmation);
    expect(failed.status).toBe(500);
    expect(
      database.prepare("SELECT count(*) AS count FROM slack_messages").get()
        .count
    ).toBe(1);
    expect(
      database
        .prepare("SELECT count(*) AS count FROM slack_intake_events")
        .get().count
    ).toBe(1);
    database.exec("DROP TRIGGER reject_escalation");
    const retried = await harness.intake(address, confirmation);

    // Then it succeeds exactly once rather than losing or duplicating the handoff.
    expect(await retried.json()).toMatchObject({
      duplicate: false,
      queued: true,
    });
    expect(
      database.prepare("SELECT count(*) AS count FROM tickets").get().count
    ).toBe(1);
    expect(
      database.prepare("SELECT count(*) AS count FROM slack_messages").get()
        .count
    ).toBe(2);
    expect(harness.calls).toHaveLength(1);
  } finally {
    database?.close();
    await harness.stop();
  }
}, 30_000);
