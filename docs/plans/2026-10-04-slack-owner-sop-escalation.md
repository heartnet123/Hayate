# Owner-confirmed ineffective SOP escalation (Issue #10)

## Delivery contract and repository evidence

- Base: freshly fetched `origin/main` at `92b6906`; branch `feat/slack-owner-sop-escalation`.
- Protected pre-existing changes: `.mcp.json` and untracked `docs/superpowers/`. Never stage or edit these paths.
- Dependency #9 is closed and its approved-answer implementation is merged. Issue #10 has no open blockers.
- Observed: `slack-intake.ts:129` serializes ingestion with `BEGIN IMMEDIATE`; `auth.ts:81`, `auth.ts:92`, and `auth.ts:96` enforce one request per source thread, one stored message per source timestamp, and one ticket per request.
- Observed: `slack-intake.ts:178` currently suppresses repeated AI mentions before processing follow-ups. Ordinary follow-ups never promote answered requests.
- Observed: `ai-answers.ts:113` exposes immutable request-bound SOP provenance and confirmed answer time. `tickets.ts:64` selects official replies only through saved staff attribution, independently of AI answers.
- Observed: `ai-slack-test-support.js:13` signs actual HTTP events; its harness supports multiple Node application processes sharing one isolated SQLite database.
- Missing: explicit owner confirmation, promotion of the existing answered request, and AI provenance inside each ticket's context before and after claiming.

## Proposed minimal policy

- Match an explicit standalone confirmation, not sentiment or a substring: `SOP ไม่ได้ผล`, `SOP ไม่แก้ปัญหา`, `ทำตาม SOP แล้วไม่หาย`, or `SOP did not work`.
- Normalize case and whitespace; allow one leading Slack bot mention or existing textual AI mention, and an optional final period or exclamation mark. Questions, negation, hedges, quotations, and extra instructions are not confirmation. Document the supported phrases for employees.
- Only the saved request owner in the original configured workspace/channel/thread can confirm. Require a distinct reply timestamp strictly after the confirmed AI Slack answer timestamp. Failed, uncertain, and still-sending attempts do not authorize owner-confirmed escalation.
- Insert one unassigned ticket for the same request with reason `Request owner confirmed the SOP did not resolve the issue.` within the existing ingestion transaction. Preserve the original answer record, version, and sent time even if the SOP is later edited or withdrawn.
- Persist the first confirmation as ordinary requester context, never as an official reply. Record replay event IDs but suppress repeated confirmations and AI mentions once queued. Existing event and message timestamp uniqueness prevents conflicting duplicate callbacks from changing the decision.
- Do not send another Slack message, rematch an SOP, add a schema, install dependencies, or create an external AI classifier.

## Logical phases and commit boundaries

0. **Delivery plan**: this document. Check it against all five issue criteria and current repository state. Commit `docs(slack): plan owner-confirmed SOP escalation`.
1. **Preparatory parsing seam**: move the existing event parsing and typed Slack message into `apps/web/src/lib/server/slack-message.ts`; keep persistence/routing in `slack-intake.ts`. No behavior change. This keeps the subsequent owner boundary readable without expanding the intake module into another oversized unit. Verify `bun test ai-slack.test.js slack.test.js`, typecheck, changed-file Oxlint/format checks and diagnostics. Commit `refactor(slack): separate event parsing from request intake`.
2. **Owner-confirmed handoff**: exact confirmation recognition and transactional promotion in `slack-intake.ts`, with signed HTTP regression tests in `ai-escalation.test.js` using the existing AI harness. Cover owner/source/time checks, ambiguous inputs, replay and multi-process races, duplicate source timestamps, atomic rollback, and restart persistence. Verify the new suite, existing intake/delivery regressions, typecheck, changed-file lint and diagnostics. Commit `feat(slack): escalate owner-confirmed ineffective SOP answers`.
3. **Ticket provenance and operational guidance**: expose request IDs in assigned/shared ticket projections, reuse loaded AI deliveries to render a small `ticket-ai-context.svelte` in central queue, assigned work, and shared history. Add staff HTTP visibility/claim/restart/permission coverage and README guidance. Expected files: `tickets.ts`, `routes/slack/+page.svelte`, the new component, `ai-escalation-history.test.js`, and `README.md`. Verify targeted history tests, full `bun test`, `bun run check-types`, `bun run check`, `bun run build`, and real browser checks at desktop/tablet/mobile widths before and after claiming. Commit `feat(slack): show prior AI guidance in escalated ticket context`.

Each phase is implemented, verified, diff-reviewed, and ponytail-reviewed before its atomic commit. Tests accompany their behavior. Phase 3's projection/component/page/tests are one ticket-context contract; splitting them would ship a context that cannot be rendered or verified. No amend, squash, push, or PR creation.

## Acceptance-to-evidence map

| Issue #10 acceptance criterion | Phase | Objective evidence |
| --- | --- | --- |
| Owner confirmation in the original thread creates one central ticket with ineffective-SOP reason | 2 | Real signed AI request followed by signed owner confirmation; one ticket references the original request and is unassigned |
| Staff see previously used SOP and answer time, separate from official replies | 3 | Queue article shows immutable version, exact answer and UTC time before claim; assigned/shared context survives claim; official reply list remains empty |
| Repeated confirmations, AI mentions, retries and simultaneous events create no duplicate tickets/messages | 2 | Two application processes receive concurrent distinct confirmations, same event replays and same timestamp under different event IDs; one ticket, one confirmation, one outbound answer |
| Others and other threads cannot confirm; ambiguous wording is never guessed | 2 | Signed non-owner/wrong-thread/earlier/question/negated/quoted/instruction-appended cases leave the original request unqueued |
| Signed simulated Slack path from AI answer to central queue | 2, 3 | HMAC-verified HTTP tests with local Slack API mock; invalid signature cannot promote; staff authenticated HTTP and real browser inspect resulting queue |

## Lifecycle, rollback, and final audit

- Use existing tables and uniqueness constraints. No migration or mixed-format data change is required.
- A failed ticket insertion rolls back the confirmation message and event together, allowing the same signed event to succeed after the failure is removed.
- Serialize concurrent processes through SQLite; never hold the transaction across Slack network calls. Restart keeps tickets, deduplication and immutable AI provenance intact.
- Reverting behavior/context commits disables this feature without deleting stored requests, tickets, answers, or notes. Parser preparation can be reverted independently after dependent commits are reverted.
- Final audit compares base-to-HEAD scope and commit history to this plan; verifies protected changes remain outside commits; checks for debug/temporary/uncommitted implementation; audits every acceptance row; collects independent correctness/standards review and final `/ponytail:ponytail-review` with no actionable findings. Any relevant finding gets a new verified atomic commit and another review.
