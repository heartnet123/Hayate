import { expect, test } from "bun:test";

import { createAiSlackHarness } from "./ai-slack-test-support.js";

for (const type of ["message", "app_mention"]) {
  test(`owner ${type} confirmation waits for outbound acknowledgement without losing its retry`, async () => {
    const harness = await createAiSlackHarness();
    let database;
    let initial;
    let acknowledgement;
    try {
      // Given Slack has received the answer but holds its acknowledgement.
      const first = await harness.start();
      const second = await harness.start();
      const threadTs = "1719500000.000001";
      await harness.intake(second.address, {
        eventId: "Ev-warm-route",
        text: "Warm route",
        threadTs,
        type: "message",
      });
      acknowledgement = harness.holdAcknowledgement();
      initial = harness.intake(first.address, {
        eventId: "Ev-original",
        text: "<@BOT> Reset Password",
        threadTs,
      });
      await acknowledgement.received;
      database = harness.database();
      const confirmation = {
        eventId: "Ev-racing-confirmation",
        messageTs: "1720000000.000001",
        parentThreadTs: threadTs,
        text:
          type === "app_mention"
            ? "<@BOT> SOP ไม่ได้ผล"
            : "<@U-COLLEAGUE> SOP did not work",
        type,
      };

      // When owner confirmations arrive before the successful acknowledgement.
      const pending = await Promise.all([
        harness.intake(first.address, confirmation),
        harness.intake(second.address, confirmation),
        harness.intake(second.address, {
          ...confirmation,
          eventId: "Ev-second-confirmation",
          messageTs: "1720000000.000002",
        }),
      ]);
      expect(pending.map((response) => response.status)).toEqual([
        503, 503, 503,
      ]);
      for (const response of pending) {
        expect(response.headers.get("x-slack-no-retry")).toBeNull();
      }
      const outcomes = await Promise.all(
        pending.map((response) => response.json())
      );
      expect(outcomes).toEqual([
        { accepted: false, pendingAiAnswer: true },
        { accepted: false, pendingAiAnswer: true },
        { accepted: false, pendingAiAnswer: true },
      ]);
      expect(
        database.prepare("SELECT status FROM ai_answers").get().status
      ).toBe("sending");
      expect(
        database.prepare("SELECT count(*) AS count FROM tickets").get().count
      ).toBe(0);
      expect(
        database.prepare("SELECT count(*) AS count FROM slack_messages").get()
          .count
      ).toBe(1);
      expect(
        database
          .prepare("SELECT count(*) AS count FROM slack_intake_events")
          .get().count
      ).toBe(1);
      acknowledgement.release();
      const sent = await initial;
      expect(sent.status).toBe(200);

      // Then Slack retries can promote once, with no consumed event or resend.
      const retried = await Promise.all([
        harness.intake(first.address, confirmation),
        harness.intake(second.address, confirmation),
        harness.intake(second.address, {
          ...confirmation,
          eventId: "Ev-second-confirmation",
          messageTs: "1720000000.000002",
        }),
      ]);
      expect(retried.map((response) => response.status)).toEqual([
        200, 200, 200,
      ]);
      const queued = await Promise.all(
        retried.map((response) => response.json())
      );
      for (const outcome of queued) {
        expect(outcome).toMatchObject({ accepted: true, queued: true });
      }
      expect(
        database
          .prepare("SELECT request_id, assignee_id, reason FROM tickets")
          .all()
      ).toEqual([
        {
          assignee_id: null,
          reason: "Request owner confirmed the SOP did not resolve the issue.",
          request_id: 1,
        },
      ]);
      expect(
        database.prepare("SELECT count(*) AS count FROM slack_messages").get()
          .count
      ).toBe(2);
      expect(
        database.prepare("SELECT status FROM ai_answers").get().status
      ).toBe("sent");
      expect(harness.calls).toHaveLength(1);
    } finally {
      acknowledgement?.release();
      if (initial) {
        await initial;
      }
      database?.close();
      await harness.stop();
    }
  }, 30_000);
}
