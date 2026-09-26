# Issue #5: Slack ticket ownership and official replies

## Scope and evidence

- Base: `main` at `d52be58` (#4 merged); branch: `feat/slack-ticket-ownership-replies`.
- `apps/web/src/lib/server/auth.ts:128` already stores nullable `tickets.assignee_id`; `listCentralQueue` at `:406` selects unassigned requests with original thread messages. No claim/write-reply contract exists.
- `apps/web/src/routes/slack/+page.server.ts:5` only loads queue. `+page.svelte:58` displays it beside an explicitly local-only sample conversation. Preserve that distinction; do not send sample replies.
- `apps/web/src/hooks.server.ts:5` authenticates users, but actions still need role and ownership checks at the server boundary. `auth.test.js:129` tests signed intake, users, and persistence with a real Vite app and SQLite.
- The configured workspace/channel may change after intake; delivery must use the stored source channel and parent thread, not current settings. Slack `chat.postMessage` accepts JSON with `channel`, `thread_ts`, `text` and returns `ok`, `ts`, `channel`; errors can be ambiguous even with an error response. Requires `SLACK_BOT_TOKEN` with `chat:write`.
- Pre-existing unrelated changes: `AGENTS.md`, `opencode.json`, `.zcodeignore`, `CONTEXT.md`, `docs/`. Stage only explicitly named issue files; do not touch the pre-existing files.

## Decisions and boundaries

- Atomic conditional SQLite `UPDATE ... WHERE assignee_id IS NULL` elects exactly one assignee. Losing action returns current assignee; assigned requests leave central queue but appear under the owner's work.
- One official reply per ticket in this issue. Save the draft and an outbound attempt before calling Slack. Only a valid Slack acknowledgement for the stored channel and a message timestamp makes it `sent`; store response text, sender, and timestamp as history. A known rejection leaves the draft retryable; an ambiguous transport result or crash leaves it `uncertain` and **not** retryable automatically. This avoids duplicate posts at the cost of manual reconciliation for uncertain outcomes. No false delivery claim.
- Do not implement reassignment, general chat, synthetic Slack previews as real history, auto-reconciliation, or a new UI framework.

## Commit phases

0. **Plan.** Record this plan before implementation on the feature branch; no product code. Commit: `docs(slack): plan ticket ownership and replies`.
1. **Claim and visibility.** Change `apps/web/src/lib/server/auth.ts`, `apps/web/src/lib/server/tickets.ts`, `apps/web/src/routes/slack/+page.server.ts`, and add focused `slack.test.js` claim cases. Acceptance: unassigned list, single winning claimant, loser sees current owner, assigned items visible after reload. Verify `bun test slack.test.js`, `bun run check-types`, `bun x oxlint` on touched JS/TS, diff and staged paths. Commit: `feat(slack): claim queued tickets atomically`.
2. **Delivery state and Slack acknowledgement.** Add `apps/web/src/lib/server/replies.ts` (using existing SQLite ownership exported from auth), update schema and server actions, extend `slack.test.js`. Acceptance: server rejects non-owner, stored source thread, valid Slack ack only, durable draft and status, duplicate and ambiguous outcome protection. Verify targeted HTTP tests with mock Slack, typecheck, lint, staged diff. Commit: `feat(slack): persist official reply delivery state`.
3. **Real work UI and documentation.** Update `apps/web/src/routes/slack/+page.svelte`, `README.md`, and `slack.test.js` for displayed actions/status/history, keeping sample-only pane explicit. Acceptance: agent claims, drafts, sends, sees failure and sent state after reload/restart. Verify tests, typecheck, lint, build, browser click/fill/refresh, diff. Commit: `feat(slack): expose claimed work and reply history`.

## Acceptance matrix

| Issue criterion | Phase | Proof |
| --- | --- | --- |
| Unassigned work, source thread, claim removes from queue | 1, 3 | HTTP page before/after claim and reload |
| Two claimants, one owner; loser sees latest state | 1 | concurrent POSTs, one success and one conflict with winner visible |
| Owner-only send on direct server call | 2 | non-owner POST denied; mock Slack sees zero sends |
| Thread delivery and official history only after acknowledgement; failed draft remains | 2, 3 | inspect mock JSON, page and SQLite before/after success/failure |
| Known-success retry does not duplicate; recovery never claims receipt without evidence | 2 | repeat POST and restart/ambiguous response test, mock call count and status |
| Real app with simulated Slack including race and send failure | 1–3 | `bun test slack.test.js` exercises running Vite HTTP and local mock Slack |

## Final verification and rollback

Run `bun test`, `bun run check-types`, `bun run check`, `bun run build`; inspect each commit and final worktree against recorded baseline; use real browser for claim/send flow. Run deletion-first ponytail review after commits and repeat fix/verify/commit/review until actionable findings clear. Each commit reverts independently in reverse order; persisted reply records remain in SQLite if code rolls back and are not silently removed.
