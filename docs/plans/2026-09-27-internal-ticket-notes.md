# Issue #6: Private ticket notes

## Delivery contract and evidence

- Base `origin/main` at `4222c80`; branch `feat/internal-ticket-notes`; working tree clean before work. Issue #4 is merged. No requester login or ticket detail route exists.
- `apps/web/src/lib/server/auth.ts:80` initializes persistent SQLite, including `tickets` and the separate `official_replies` table. `apps/web/src/hooks.server.ts:5` authenticates requests and excludes revoked sessions.
- `apps/web/src/lib/server/tickets.ts:23` lists only tickets assigned to the current agent. `apps/web/src/routes/slack/+page.server.ts:8` loads the queue and personal work; `:50` owns Slack delivery. `+page.svelte:84` shows only personal work and official replies.
- `slack.test.js:130` uses a real Vite server, isolated SQLite, two agents, and a mock Slack endpoint. Reuse that test surface.

## Decisions and scope

- All active support staff (`admin`, `agent`) can view and append notes to **any** persisted ticket, not only its assignee. Provide a shared ticket list on `/slack` next to the existing queue and personal official-reply workflow; do not broaden official-reply permissions.
- Notes are append-only rows in `internal_notes` with ticket FK, author FK, body, and SQLite UTC timestamp. Read with the author's email and ordered timestamp/id. No Slack calls, no changes to `official_replies` or ticket ownership in the note path.
- Validate the ticket ID and trimmed body (1–4000 chars) at the server action. Unknown ticket: 404; missing/revoked session: 401/403; SQLite busy/save failure: visible 503/500. Return the original draft and selected ticket ID on form failures, including save failure. Successful submit reloads notes; reload/restart preserves saved notes.
- No requester authentication or public notes API is created. Requesters only exist as Slack IDs and cannot authenticate into staff UI. Keep note content out of Slack payloads, sample conversations, and official replies. Do not redesign the app or introduce dependencies.

## Phases and commit architecture

0. **Plan and UI contract.** Files: this plan, `DESIGN.md` (existing visual tokens and the note composer pattern). Acceptance: documented boundaries, shared-visibility choice, test matrix, UI rules before component work. Verify `git diff --check` and staged paths. Commit: `docs(tickets): plan private support notes`.
1. **Persistent notes.** Files: `apps/web/src/lib/server/auth.ts`, `apps/web/src/lib/server/tickets.ts`, focused tests in `slack.test.js`. Add schema and ticket/notes queries with append-only insert. Acceptance: author/time and durable shared records, no side effects on replies. Verify `bun test slack.test.js`, `bun run check-types`, oxlint on changed JS/TS. Commit: `feat(tickets): persist staff-only ticket notes`.
2. **Server boundary.** Files: `apps/web/src/routes/slack/+page.server.ts`, `slack.test.js`. Add support-only load/action, validate and handle invalid/failed saves without losing draft. Acceptance: direct HTTP rejects guests/revoked and bad inputs, two staff accounts read the same notes, simulated Slack remains untouched and reply status unchanged. Verify targeted HTTP tests, typecheck, oxlint, staged diff. Commit: `feat(tickets): enforce private note access on server`.
3. **Ticket screen.** Files: `apps/web/src/routes/slack/+page.svelte`, `README.md`, `slack.test.js` (if rendered coverage needs it). Add a shared ticket list with per-ticket notes and an explicitly internal composer; retain draft on failed form result and distinguish it from official reply. Acceptance: usable ticket-screen read/write, timestamps, refresh persistence and errors. Verify targeted tests, `bun run check-types`, `bun run check`, build, actual browser fill/submit/reload/invalid flow, staged diff. Commit: `feat(tickets): show collaborative notes in support view`.

Each phase commits only its named files after verification and staged review. Dependencies: 0 → 1 → 2 → 3; rollback in reverse order leaves persisted note data intact, never sends it externally. No amend/squash or unrelated file staging.

## Acceptance matrix

| Issue criterion | Phase | Evidence |
| --- | --- | --- |
| Authorized agents read/add shared notes with author/time; survive reload | 1–3 | Real HTTP forms + second account page + SQLite rows after restart; browser reload |
| Requester and unauthorized callers cannot read/write | 2 | Anonymous direct GET/POST denied; revoked session direct GET/POST denied; no requester access path |
| No Slack delivery or official reply state change | 1–2 | Mock Slack call count stays zero; `official_replies` remains unchanged after note write |
| Invalid input/save failure reports error, preserves draft | 2–3 | Direct form response with `body` returned; browser sees original draft after invalid or locked database failure |
| Ticket-screen reading/writing with mocked Slack | 2–3 | Existing `slack.test.js` running app + mock Slack; browser form submit/reload |

## Final gate

Run `bun test`, `bun run check-types`, `bun run check`, `bun run build`; inspect branch-vs-base diff, each commit, and working tree. Inspect for debug/temporary artifacts. Run a deletion-first ponytail review and fix/reverify/commit/review until clear.
