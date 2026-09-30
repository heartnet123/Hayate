# Issue #8: SOP approval lifecycle

## Evidence and delivery contract

- Base `origin/main` / `8abddba`, fetch confirmed `0 0` divergence. Work on `feat/sop-approval-lifecycle`, never default branch.
- Protect pre-existing untracked `docs/superpowers/`; never stage or edit it.
- `apps/web/src/routes/sop/+page.svelte:15`: draft title/sections are browser-only sample state. No SOP persistence exists.
- `apps/web/src/lib/server/auth.ts:100`: shared Node SQLite connection, durable database path, foreign keys and transactional migrations.
- `apps/web/src/hooks.server.ts:5`: authenticated, current staff identity supplied through locals. Settings actions already enforce administrator authorization.
- `auth.test.js:18`: real HTTP tests use isolated SQLite and spawned Node/Vite, with restart verification. Reuse this pattern.
- `DESIGN.md:19`: existing panel/button/field primitives, explicit error/status feedback, no optimistic success.
- No AI generation/retrieval exists. Oracle confirmed a server-only eligibility query and atomic answer-recording seam is the smallest truthful implementation. No AI engine, heuristic matching, Slack auto-send, or public KB added.

## Proposed contracts

Active staff may create/edit private drafts. Only administrators approve or withdraw. All action guards run server-side and use session identity, not submitted actor IDs.

Mutable drafts have optimistic revision tokens. Approval snapshots title/body into an immutable version and switches the active version atomically with an actor/time event. Draft edits do not change an already-approved version. Withdrawal removes eligibility, not versions or answer provenance. New approval replaces the active version; stale actions return conflict rather than silently overwriting another person's work.

`listEligibleSops()` returns only currently approved active versions. `recordSopAnswer(ticketId, versionId, answerBody)` inserts answer provenance with a single eligibility-gated SQL statement. It rejects withdrawn/superseded versions even if the caller retrieved them earlier. Future AI callers must record successfully before exposing an answer. These seams do not generate or send answers.

Approval/withdrawal use transactions. Invalid input, stale revision and database errors return honest failure, preserving submitted draft fields and saved state. No draft is deleted by lifecycle operations.

## Logical phases and atomic commits

### Phase 0: `docs(sop): plan approval lifecycle`

Scope: this plan. Criteria: branch isolation, boundaries, verification mapping. Checks: Markdown formatting, diff hygiene, independent ponytail review. Commit only plan.

### Phase 1: `feat(sop): persist private staff drafts`

Files: new `apps/web/src/lib/server/sop.ts`, new `apps/web/src/routes/sop/+page.server.ts`, new `sop.test.js`.

Scope: additive SOP schema, staff-only load/save actions, input limits, revision conflicts, durable drafts. These three files belong together because HTTP tests exercise the route's persisted draft operations against the new storage module.

Criteria: durable create/edit after reload/restart, private drafts excluded from answer use, unauthenticated/revoked denial, submitted input preserved on failure.

Checks: `bun test sop.test.js`, fresh web typecheck, scoped Oxlint/Ultracite, diagnostics, diff review and independent ponytail review. Commit only phase files after passing.

### Phase 2: `feat(sop): audit approval and withdrawal with versioned sources`

Files: SOP storage and route above, new `apps/web/src/lib/server/sop-answers.ts`, SOP HTTP tests and new `sop-storage.test.js`.

Scope: administrator-only approve/withdraw, immutable approval snapshots, actor/time audit, atomic eligibility query/answer persistence, retained history. Tests paired with their behavior; all files implement one lifecycle invariant across route, storage and consumer boundary.

Criteria: direct non-admin calls denied; withdrawal stops new answer use; old answers retain exact version; editing drafts does not alter approved content; stale/failed actions do not lose drafts or claim success.

Checks: both SOP tests, forced SQLite abort/rollback, stale tokens, restart and provenance driver, fresh typecheck, scoped lint/format and diagnostics, independent ponytail review before commit.

### Phase 3: `feat(sop): expose persisted review workflow to staff`

Files: `apps/web/src/routes/sop/+page.svelte`, `DESIGN.md`, `README.md`, SOP tests as needed.

Scope: replace fictitious preview with saved draft list/editor, current status, approved snapshot and actor/time history. Staff edit drafts; only admins see moderation controls. Ordinary form failures preserve input, enhanced transport failures preserve local edits. Reuse existing UI primitives and metadata semantics rather than redesign.

Criteria: administrator UI create/edit/approve/withdraw and staff read/edit/denial work after reload; no fake confidence or success; accessible responsive controls and failure states.

Checks: browser happy path and rejected action, failed moderation retaining unsaved editor, 375/768/1280 screenshots, console, SOP and interface tests, fresh full `bun test`, `bun run check-types --force`, `bun run build --force`, full `bun run check` plus scoped checks; independent review and ponytail review before commit.

## Acceptance evidence matrix

| Acceptance | Phase | Observable proof |
| --- | --- | --- |
| Draft edits persist, drafts are not usable guidance | 1–3 | HTTP reload/restart and browser edit; eligible query excludes drafts |
| Admin approval/withdrawal record actor/time; staff direct calls fail | 2–3 | HTTP 403 and unchanged DB; persisted audit displayed in UI |
| Withdrawal stops new use without removing old source version | 2 | Retrieve approved revision, record answer, withdraw, reject new use, exact historical join survives restart |
| Failed lifecycle is honest and preserves draft | 2–3 | SQLite abort trigger, transaction rollback, HTTP error; browser retained unsaved fields |
| Screen flow and unauthorized denial tested | 3 | Real browser admin lifecycle, staff controls absent, forged staff POST denied |

## Migration, rollback and final gate

New tables are additive and initialized through the existing database connection. No destructive migration. Revert commits in reverse order; retained tables remain private and never become AI inputs without explicit eligibility checks. No new dependencies.

Baseline: `bun test` 11 pass / 594 assertions. Fresh typecheck 0 errors / 7 existing warnings. Full `bun run check` fails on 28 existing formatting files, including protected untracked docs. Do not mix unrelated formatting into this work. Report this limitation alongside clean scoped checks.

Inspect final status/diff/history against phase boundaries, excluding protected docs. Check no debug code, temporary artifacts or uncommitted implementation. Repeat independent ponytail review (delete/stdlib/native/YAGNI/shrink) until no actionable findings. Slash-command skill is unavailable; run equivalent explicit review through an independent reviewer. No push, PR or issue closure requested.

Planning complete. User explicitly authorized planning through implementation, verification and phase commits.
