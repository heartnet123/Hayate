# Approved SOP answers in Slack (Issue #9)

## Delivery contract and evidence

- Base: `origin/main` at `dd58825`; branch `feat/slack-approved-sop-answers`.
- Protected pre-existing changes: `.mcp.json`, untracked `docs/superpowers/`.
- Dependencies #4 and #8 are closed. Signed intake and immutable approved SOP versions exist.
- Observed: `auth.ts:464` currently queues every request; `sop-answers.ts:12` selects only active approved versions; its existing recording API is ticket-bound and remains unchanged.
- Observed: `replies.ts:74` reserves delivery before Slack calls. Reuse that delivery policy, not ticket ownership.
- Missing: request-bound answer delivery/history and safe first-request SOP routing.
- Proposed: deterministic, case/whitespace-normalized exact approved-title matching, after removing one leading bot mention. Exactly one match only; copy approved procedure verbatim. No fuzzy matching, generated advice, embeddings, or external AI provider. Nonmatches, ambiguous titles, oversized answers, and extra bypass instructions escalate.
- Approved SOP means administrator-approved for employee disclosure. Draft edits never replace approved snapshots.

## Phases and commit boundaries

0. **Delivery plan**: this document. Commit `docs(slack): plan approved SOP answer delivery`.
1. **Request-bound records and safe selection**: new server-only answer schema/storage and exact matcher; storage tests. Preserve legacy ticket-bound `sop_answers`. Cover active/draft/withdrawn eligibility, ambiguous matching and immutable provenance. Verify targeted storage tests, typecheck, changed-file lint, diagnostics. Commit `feat(ai-answers): persist request-bound SOP delivery records`.
2. **Signed intake and truthful Slack delivery**: intake integration, first-request reservation, persisted source coordinates, Slack transport and integration tests. Cover successful source-thread delivery without tickets, one fallback ticket, replay/concurrency, blocked instructions, withdrawal before dispatch, rejected/uncertain/crashed delivery. Verify signed HTTP scenarios against local Slack mock, existing Slack/migration tests, typecheck/lint/diagnostics. Commit `feat(slack): answer first requests from approved SOPs safely`.
3. **Staff history and operational guidance**: protected Slack load, separate history component, staff HTTP visibility tests and README. Cover exact version, answer time, owner/thread, non-success delivery states, reload/restart persistence and unauthorized access. Verify browser desktop/mobile inspection and staff views, complete suite, typecheck, lint, build. Commit `feat(slack): expose separate AI answer history to staff`.

Tests stay with the behavior they protect. Phase 2 storage/intake/delivery integration is one unit: reservations must never ship without dispatch or visible failure semantics. Each phase is implemented and verified before its commit; no amend/squash or push.

## Lifecycle and safety

- Add a request-keyed table with one delivery per request, immutable version FK, body, created time, status, confirmed Slack timestamp and sent time. Storage checks prevent non-sent rows from carrying success timestamps.
- Begin immediate transaction before deduplication; check globally unique event ID before creating a request. Only the reservation inserter receives permission to dispatch.
- Existing threads never rematch or resend. Store ordinary follow-ups without creating a ticket for answered/in-flight requests. Repeated mentions remain the original request.
- Recheck exactly one current eligible match with the reserved version immediately before dispatch. This is the eligibility linearization point; withdrawal after dispatch begins cannot recall an external Slack call. Never hold a SQLite transaction over network I/O.
- Send only to stored channel/thread; confirm channel and valid message timestamp. Copy approved body, disable unintended mentions/unfurls where Slack permits.
- Persist terminal failure/uncertainty and one unassigned escalation ticket in one transaction. Safe fixed errors only; do not log payloads, secrets, or raw Slack errors.
- Interrupted `sending` stays visibly unconfirmed, never counted as success, never automatically resent. Staff check source thread before action. No automatic retries for uncertain delivery.
- Existing rows and legacy answer API remain intact. Rollback disables new routing/UI without deleting stored provenance; additive schema remains safe.

## Acceptance evidence

| Criterion | Phase | Observable proof |
| --- | --- | --- |
| Approved/current SOP only; bypass text cannot authorize | 1, 2 | Draft/withdrawn/nonexact/ambiguous inputs yield no Slack answer |
| Source-thread success and provenance without queue/assignee | 2, 3 | Mock request has original `thread_ts`; sent row references immutable version and UTC sent time; no ticket; staff history visible |
| Insufficient evidence yields one ticket, no invention | 2 | Signed unmatched intake has exactly one unassigned ticket and no outbound answer |
| Retries/failure never duplicate or falsely succeed; work stays visible | 2, 3 | Concurrent/replayed events make one call; rejected/uncertain/interrupted attempts display non-success; fallback tickets unique |
| Signed Slack scenarios and staff perspective tested | 2, 3 | Active/draft/withdrawn/missing SOP HTTP fixtures, persisted records, mock Slack and real browser |

Final audit: compare commit history with phases; inspect status/diff for only protected pre-existing changes; full verification; independent correctness review and `/ponytail:ponytail-review` on each pre-commit diff and final branch diff. Fix actionable in-scope findings in new atomic commits, verify, repeat review.
