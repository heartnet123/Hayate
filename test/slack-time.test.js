import { expect, test } from "bun:test";

import { formatSlackTime, slackTimeIso } from "../apps/web/src/lib/slack-time";

test("Slack timestamps render as readable UTC time", () => {
  expect(formatSlackTime("1759900000.000100")).toBe("2025-10-08 05:06:40 UTC");
  expect(slackTimeIso("1759900000.000100")).toBe("2025-10-08T05:06:40.000Z");
});

test("unparseable timestamps stay visible instead of throwing", () => {
  expect(formatSlackTime("not-a-timestamp")).toBe("not-a-timestamp");
  expect(formatSlackTime("")).toBe("");
  expect(slackTimeIso("not-a-timestamp")).toBe("");
});
