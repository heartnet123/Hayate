<img src="apps/web/static/favicon.png" alt="HelpDesk AI icon" width="48" height="48">

# HelpDesk AI

An interactive help desk interface built with SvelteKit. Staff manage real Slack tickets and SOP drafts; administrators control access and approve or withdraw SOP guidance. Dashboard metrics and other configuration previews use sample data.

> [!IMPORTANT] Sign-in, Roles & Permissions, Slack configuration/intake, ticket claiming, notes, official replies, SOP review and approved-SOP Slack answers are persisted. Metrics, sample Slack conversations and other settings remain examples. Approved-SOP answers copy reviewed procedures exactly; they are not generated advice.

## Explore the demo

| Route | What you can explore |
| --- | --- |
| `/` | Dashboard with ticket trends, categories, CSAT, AI insight examples, and recent tickets. |
| `/slack` | Confirmed approved-SOP AI answer history, unconfirmed delivery attention, the unassigned central queue from signed `/slack/events` requests, claim actions, assigned tickets and app replies, plus shared ticket history. Sample conversations and triage below remain previews. |
| `/sop` | Private persisted drafts, administrator approval/withdrawal, immutable approved versions and decision history. |
| `/settings` | Admin-only: manage support agents and link staff Slack identities in Roles & Permissions; configure the Slack workspace and support channel in Slack Integration. Other tabs remain previews. |

The sidebar also shows planned areas such as Tickets, KB Chatbot, Knowledge Base, and Analytics. Those entries do not have pages yet.

## Run locally

Requires [Bun](https://bun.sh/) 1.4.1 (the version declared in `package.json`). From the repository root:

```bash
bun install
# Set HELPDESK_ADMIN_EMAIL and HELPDESK_ADMIN_PASSWORD in your shell first.
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). To run only the web workspace, use `bun run dev:web`.

First startup requires `HELPDESK_ADMIN_EMAIL` and `HELPDESK_ADMIN_PASSWORD` (12–128 characters) in the server environment. Administrator account is created only when database has no admin; use credentials to sign in at `/login`. Administrator creates support agents under `/settings/roles` with temporary passwords, then agents sign in to see dashboard, Slack, and SOP review. Agents cannot open settings. Roles and sessions persist in SQLite at `apps/web/local.db` by default; set `HELPDESK_DB_PATH` to a writable persistent path in production. Protect database files and environment variables; do not store credentials in browser-side config or commit them. Use a persistent Node.js deployment with writable disk, not ephemeral serverless storage. `node:sqlite` requires Node.js 22.13+ (Node.js 24 recommended).

For Slack Events API intake, set `SLACK_SIGNING_SECRET` on the server and configure the **team ID** (`T...`) as workspace and the **channel ID** (`C...` or `G...`) as support channel under `/settings/slack`. Slack delivers these IDs, not workspace and channel names; previously saved names must be replaced with IDs before real `app_mention` events can be routed. Add the installed Slack app to the source support channel and subscribe to `app_mention`, plus [`message.channels`](https://docs.slack.dev/reference/events/message.channels/) with `channels:history` for a public channel or [`message.groups`](https://docs.slack.dev/reference/events/message.groups/) with `groups:history` for a private channel. Neither signing secret nor bot token belongs in the settings form.

Before staff messages can count as official replies, an administrator must verify and link the active staff account to its Slack **team ID** (`T...`) and **member ID** (`U...` or `W...`) under `/settings/roles`. Each team/member pair can belong to only one staff account. Clear both identity fields to unlink; only administrators can edit mappings.

To send official replies from the app, set `SLACK_BOT_TOKEN` on the server to a bot token with `chat:write` in the source channel. Only the current ticket assignee can send. A Slack rejection saves a retryable draft; transport errors or restarts during an attempt leave delivery **unconfirmed** and block repeat sends until the thread is checked manually. The page marks a reply delivered only after Slack returns a matching channel and message timestamp. The app keeps one delivery reservation per ticket; the sample conversation composer is never sent to Slack.

For a new signed Slack request, the approved-SOP path removes one leading bot mention, normalizes case and whitespace, and requires the remaining text to match exactly one current approved SOP title. It sends that approved procedure snapshot verbatim, so an external AI provider is intentionally unnecessary. Draft, withdrawn, missing, non-exact, ambiguous, oversized or instruction-appended requests fall back conservatively to one unassigned central-queue ticket; the app never invents an answer.

Each approved-SOP attempt persists the immutable SOP version, title and procedure, exact answer body, request owner, source workspace/channel/thread, status and UTC times. Staff see confirmed `sent` records separately from `sending`, `failed` and `uncertain` delivery attention. A missing bot token, rejection, transport uncertainty or interrupted process is never presented as success. Unconfirmed work requires checking the source thread and existing central queue; there is no automatic resend. Dispatch uses an atomic, durable `dispatch_claimed_at` claim: only one process can send each reserved answer, and restarts never release the claim. Upgrading an older database also blocks existing `sending` reservations conservatively. Stop all old application processes before upgrading; old code cannot honor the new claim.

In Slack, each new message sent after assignment by the active, linked current assignee in the ticket's original thread becomes an official reply. Multiple replies appear in the shared Support ticket history with the saved staff email, original Slack member/name, UTC source time, and body. New messages from unlinked or revoked accounts, other staff, the requester, and participants are not official replies. Slack retries do not duplicate history; reassignment and identity changes do not rewrite earlier authors or reclassify existing messages.

Active support agents and admins can read and add internal notes on any ticket in the shared Support ticket history section of `/slack`. Notes include author and time, persist in the SQLite database, and never go to Slack or change the official reply. Only signed-in staff can access this section, including direct server requests; Slack requesters have no staff access.

## No suitable SOP

A new unmatched request creates one unassigned ticket, a fallback-notification reservation and an unconfirmed-delivery warning in the same SQLite transaction. After commit, the bot attempts to post this fixed notice in the request's original channel and parent thread:

> AI ยังตอบไม่ได้ เพราะไม่มี SOP ที่อนุมัติและเหมาะสมกับคำขอนี้ ส่งต่อเรื่องให้เจ้าหน้าที่ในคิวกลางแล้ว

The notice contains no draft procedure, requester text or guessed advice. Its body and destination are persisted; later Slack settings changes cannot redirect a reserved notice. Event retries, repeated mentions, concurrent processes and restarts do not create duplicate tickets. An unclaimed reservation can resume on replay, but a durable `dispatch_claimed_at` claim is never cleared or automatically retried, even after a known rejection. This guarantees at most one dispatch attempt, not exactly-once delivery across SQLite and Slack.

The ticket survives a missing token, rejection, timeout, invalid acknowledgement or interrupted process. A fresh delivery returns HTTP 200 only after a matching Slack acknowledgement is saved; failed or unconfirmed delivery returns HTTP 202. Both return `queued: true`. Intake or result-save storage exceptions return HTTP 500 instead; a result-save failure after Slack accepts retains the ticket, claim and unconfirmed warning. A duplicate HTTP 200 acknowledges intake, not successful notification delivery. Staff warnings remain visible in the central queue, assigned work and shared ticket history after reload or restart; check the original Slack thread before replying to unconfirmed work. Fallback notices are neither approved-SOP answers nor official staff replies.

Existing tickets are not backfilled, and approved-SOP delivery failures or owner-confirmed SOP handoffs do not gain an extra notice. Stop all old application processes before upgrading so old intake cannot create tickets without reservations. Keep delivery records and dispatch claims during rollback; do not clear them to force a resend.

## Owner-confirmed SOP handoff

After a confirmed AI answer, the original request owner can reply in that same Slack thread with `SOP ไม่ได้ผล`, `SOP ไม่แก้ปัญหา`, `ทำตาม SOP แล้วไม่หาย`, or `SOP did not work`. Case and whitespace are normalized; one leading Slack mention or textual AI mention and a final period or exclamation mark are optional. The owner need not address AI exclusively. These are explicit confirmation phrases, not a natural-language classifier. Questions, uncertain wording, quotations, negation, and extra instructions do not authorize a handoff. Other participants, other source threads, and messages sent before the AI answer cannot confirm on the owner's behalf.

A valid confirmation promotes the original request into one unassigned central-queue ticket with the reason that the owner confirmed the SOP did not resolve the issue. Concurrent confirmations, repeated mentions, and Slack retries never duplicate that ticket or its confirmation message. No additional Slack answer or acknowledgement is sent. A failed database insertion rolls back the confirmation event and message so Slack can retry safely; persisted decisions survive server restarts.

If the owner confirms while the outbound AI acknowledgement is still pending, `/slack/events` returns HTTP 503 without consuming that confirmation event or message. Slack's native retry after acknowledgement can then promote the request once; no retry is disabled and no extra answer is sent. Failed or uncertain delivery never authorizes SOP-failure promotion. These narrow pending responses count toward Slack's delivery-failure limits; persistently unconfirmed delivery still needs staff attention.

Staff see the prior immutable SOP title/version, exact AI answer, and UTC answer time inside the central queue before claiming, their assigned work, and shared ticket history. This guidance stays labelled **not an official reply**. Later draft edits or withdrawal do not replace the guidance originally sent, and AI answers never enter official staff reply history.

## SOP review

At `/sop`, active staff create and edit private title/procedure drafts. Save Draft persists edits across reloads and server restarts. Only administrators can approve saved content or withdraw an active SOP; server-side checks protect direct requests too. Unsaved edits must be saved before moderation. Approval snapshots an immutable version and records administrator and UTC time; withdrawal keeps that version and decision history but removes it from eligibility. Editing a draft does not change an already-approved version. Stale edits or failed saves display an error and preserve submitted fields rather than reporting success.

The server-only `listEligibleSops()` and legacy `recordSopAnswer(ticketId, versionId, answerBody)` in `apps/web/src/lib/server/sop-answers.ts` remain the ticket-bound recording API. The query returns only current approved versions; legacy recording rechecks eligibility atomically and persists the exact source version with the answer. The request-bound Slack delivery path uses its separate `ai_answers` record and does not change this API. Superseded or withdrawn versions cannot be recorded for new answers; earlier answers retain immutable source content. No public draft endpoint, fuzzy matching, embeddings or generated advice is added.

## Project layout

```text
apps/web/          SvelteKit app, routes, styles, and static assets
packages/config/   Shared TypeScript configuration
interface.test.js  Interface regression checks
auth.test.js       HTTP sign-in and permission regression checks
```

Built with Svelte 5, SvelteKit, TypeScript, Tailwind CSS 4, Bun, Turborepo, Node.js SQLite, and Ultracite.

## Checks

Run from the repository root:

```bash
bun test
bun run check-types
bun run check
```

`bun run build` creates a production build. `bun run fix` applies the project's lint and format rules. Auth tests start a local Vite server on a random port and use an isolated temporary SQLite database.
