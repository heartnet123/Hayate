# Issue #7: Official replies from the Slack assignee

## Approach and repository evidence

Record official attribution when a new signed Slack message is inserted, using an administrator-managed Slack identity and the ticket's current assignee. Reuse persisted Slack messages for immutable history and keep the existing app delivery reservation separate.

- Base: `origin/main` at `b31a06f`, verified with fetch and `0 0` divergence. Branch: `feat/slack-assignee-official-replies`, matching existing `feat/` intent naming.
- Pre-existing untracked `docs/superpowers/` is unrelated and must remain untouched and unstaged.
- `apps/web/src/lib/server/auth.ts:80-195`: persistent SQLite, Slack messages deduplicated by event ID and request/message timestamp; no Slack identity binding or assignment timestamp exists.
- `apps/web/src/lib/server/auth.ts:354-421`: transactional intake; repeated mentions currently return before message persistence.
- `apps/web/src/routes/slack/events/+server.ts:7-36`: real HMAC validation before ingestion.
- `apps/web/src/lib/server/replies.ts:55-144`: one app delivery reservation per ticket, with retry/uncertain-delivery safeguards. Preserve this contract.
- `apps/web/src/routes/settings/roles/+page.server.ts:12-68` and `+page.svelte:19-36`: existing administrator-only account management is the identity-binding extension point.
- `apps/web/src/lib/server/tickets.ts:62-88` and `apps/web/src/routes/slack/+page.svelte:124-151`: shared staff ticket data and notes are the history extension points.
- `slack.test.js:20-113,166-494`: real HTTP app, signed events, isolated SQLite, mocked Slack, multiple agents and restart checks.
- GitHub #5 and #6 are closed. User explicitly confirmed #7; references to #6 in the objective are template leftovers.

## Scope and decisions

In scope: trusted workspace/member binding, persisted attribution and source timestamp, multiple official Slack messages, first-insert deduplication, shared staff history, private-note regression coverage, and documented Slack event subscriptions.

Out of scope: Slack OAuth, automatic matching by email/display name, reassignment UI, redesign, AI/SOP behavior, multiple app delivery attempts after a known success, and changes to unrelated files.

The administrator binds an active staff account to a Slack team ID and member ID. Each workspace/member pair belongs to at most one account. Staff and unauthenticated callers cannot edit bindings. Empty bindings remove a mapping; malformed/duplicate mappings fail visibly.

Add nullable `official_agent_id` to existing `slack_messages`; its value is captured only during the first successful insert. Existing `user_id`, `user_name`, `message_ts`, and body are already immutable snapshots. A sender qualifies only when the trusted mapping identifies the active current assignee, the sender is not the requester, and the message belongs to the source thread. Bot/subtype events remain excluded. Duplicate events never promote older messages or rewrite authors.

Track the start time of the current assignment in SQLite so a delayed pre-assignment message cannot become official. Existing assigned tickets start eligibility at migration time; old messages are never retroactively classified. Assignment changes update this timestamp without adding a new reassignment feature.

## Phases and commit architecture

### Phase 0 — `docs(slack): plan official assignee replies`

Scope/files: this plan only. Acceptance: explicit identity prerequisite, ownership and history contracts, verification matrix, and commit boundaries. Verify `git diff --check`, explicit staged paths, and ponytail review before commit.

### Phase 1 — `feat(slack): bind staff accounts to Slack identities`

Scope/files: `apps/web/src/lib/server/auth.ts`, `apps/web/src/routes/settings/roles/+page.server.ts`, `apps/web/src/routes/settings/roles/+page.svelte`, `auth.test.js`.

Add `slack_identities` with a staff-account primary key and unique workspace/member pair. Expose existing mappings and an administrator-only bind/unbind form. Validate canonical Slack IDs and active staff ownership; preserve existing role/create behavior. Tests cover authorized persistence, malformed/duplicate IDs, unbind, and direct-call denial for staff/guests.

Verification: `bun test auth.test.js`, fresh app-local `bun run check-types`, `npx -y oxlint@latest` on changed JS/TS, targeted Ultracite formatting/check, staged diff inspection, ponytail review. Commit only phase files when checks pass.

### Phase 2 — `feat(slack): record immutable official thread replies`

Scope/files: `apps/web/src/lib/server/auth.ts`, `slack.test.js`, focused storage/migration tests if needed.

Migrate Slack messages with nullable official author and tickets with assignment time. Classify new inserts inside the existing transaction. Process assignee messages containing mentions without creating extra tickets. Preserve original author/time and dedupe event IDs and source timestamps. Validate timestamps used for official attribution. Tests use real signed events to prove multiple assignee replies, exclusion of requester/other staff/participants/bots, invalid signatures, duplicates across assignment changes, and delayed pre-assignment exclusion. Existing app-send reservation and notes remain untouched.

Verification: `bun test slack.test.js` plus focused migration test, fresh app-local typecheck, oxlint/Ultracite on changed files, staged diff inspection, ponytail review.

### Phase 3 — `feat(slack): show official replies in staff ticket history`

Scope/files: `apps/web/src/lib/server/tickets.ts`, `apps/web/src/routes/slack/+page.svelte`, `slack.test.js`, `README.md`, `DESIGN.md` if a history contract addition is needed.

Read saved official author IDs independently of current assignment and expose ordered Slack reply history on shared staff ticket cards. Render official label, stored Slack sender, staff author, source time and body separately from internal notes and generic thread messages. Reuse existing styles and semantic elements. Verify another staff member sees history after reload/restart, reassignment/binding changes do not rewrite old authors, and internal notes never reach mocked Slack or the signed-event response. Document `message.channels`/`message.groups` subscriptions and manual trusted bindings.

Verification: targeted signed-event/staff-view HTTP tests, fresh `bun test`, `bun run check-types --force`, `bun run check`, `bun run build`, rendered page/browser checks where available, staged diff inspection, ponytail review. Commit only phase files.

## Acceptance and DoD matrix

| Issue #7 requirement | Phase | Objective evidence |
| --- | --- | --- |
| New current-assignee message in original thread saved as official with identity/time | 1–3 | Signed HTTP message; persisted author/source timestamp; rendered staff history |
| Other staff, requester and participants are not official | 2 | Signed negative events; official history count unchanged, spoofed display name ignored |
| Slack retries do not duplicate; reassignment does not rewrite historical author | 2–3 | Same event and same timestamp with new event ID; reassignment, replay and new reply; unchanged old author |
| Internal notes are never sent or displayed in Slack | 2–3 | Note creation preserves Slack mock call count and reply records; webhook response excludes note text |
| Tests validate real Slack signatures and staff ticket history | 2–3 | Real HMAC route, invalid-signature denial, second staff page, reload and server restart |
| Separate intent branch and atomic phase commits | 0–3 | Branch/status/history inspection and explicit file staging |
| Final review has no actionable findings | All | Ponytail review before every commit and after final verification; parallel standards/spec review |

## Safeguards, migration, and rollback

- Identity binding uses trusted server permissions and Slack IDs, never the event's display name.
- Additive schema migration preserves existing messages, notes, and app delivery state. Unique constraints and the existing immediate transaction prevent duplicate classification.
- An unlinked/revoked account never produces new official attribution; existing history remains attributable through its saved author ID and Slack sender fields.
- Migration failure aborts startup instead of discarding data. Revert source commits in reverse dependency order; additive database data can remain without leaking or sending notes.
- Development server tests require execution outside the managed sandbox because process startup is blocked by `spawn EPERM`. Cached typecheck output is not final evidence; run fresh checks.

## Final validation

- Execute phases in order; each implementation commit includes relevant passing tests and prior ponytail review.
- Run full relevant checks once after implementation; address introduced failures.
- Review standards and Issue #7 acceptance separately, then repeat ponytail review on the final branch diff.
- Inspect status, diff, explicit changed paths, commit order, debug/temporary artifacts, and unchanged pre-existing `docs/superpowers/`.
- Record actual command results and any residual blockers. No push or GitHub issue closure is part of this request.

Planning is complete. Execution is authorized by the goal objective, including phase commits.
