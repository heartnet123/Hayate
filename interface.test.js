import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf-8");

test("shared shell keeps navigation names and permits 320px reflow", () => {
  const layout = source("./apps/web/src/routes/+layout.svelte");
  const styles = source("./apps/web/src/app.css");
  expect(layout).toContain('class="skip-link"');
  expect(layout).toContain("aria-label={item.label}");
  expect(styles).not.toContain("min-width: 360px");
});

test("Slack sample reply never writes into another selected conversation", () => {
  const slack = source("./apps/web/src/routes/slack/+page.svelte");
  expect(slack).toContain("selectedId === 1");
  expect(slack).toContain("replyDraft = '';");
  expect(slack).not.toContain("Reply sent in Slack.");
});

test("settings switch rows use native label for switch id", () => {
  const preferences = source(
    "./apps/web/src/routes/settings/general/system-preferences-card.svelte"
  );
  const ai = source("./apps/web/src/routes/settings/ai/+page.svelte");
  expect(preferences).toContain('<label for="switch-ai"');
  expect(ai).toContain('<label for="sw-sop"');
});

test("modal dialog contains overscroll-contain and inerts background", () => {
  const general = source("./apps/web/src/routes/settings/general/+page.svelte");
  expect(general).toContain("inert={showResetConfirm}");
  expect(general).toContain("overscroll-behavior: contain;");
  expect(general).toContain("autofocus");
});

test("SOP ticket facts use valid DL DT DD and tooltip is keyboard focusable", () => {
  const sop = source("./apps/web/src/routes/sop/+page.svelte");
  expect(sop).toContain('<dt><span class="fact-icon"');
  expect(sop).toContain('<button type="button" class="tooltip-trigger"');
  expect(sop).not.toContain("font-size: 10px");
});
