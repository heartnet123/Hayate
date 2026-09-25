<img src="apps/web/static/favicon.png" alt="HelpDesk AI icon" width="48" height="48">

# HelpDesk AI

An interactive help desk interface prototype built with SvelteKit. Administrators manage staff access; support metrics, Slack intake, SOP drafting, and other configuration screens use sample data.

> [!IMPORTANT] This remains a UI demo except for sign-in and Roles & Permissions. Metrics, messages, tickets, AI suggestions, and other settings are examples. Preview actions do not call Slack or an AI model and are lost on reload.

## Explore the demo

| Route | What you can explore |
| --- | --- |
| `/` | Dashboard with ticket trends, categories, CSAT, AI insight examples, and recent tickets. |
| `/slack` | Sample conversations, channel filtering, a reply draft, triage example, and ticket preview. |
| `/sop` | A sample ticket and editable SOP title and sections, with reviewer and publish controls. |
| `/settings` | Admin-only: create, revoke, and restore support agents in Roles & Permissions. Other tabs remain previews. |

The sidebar also shows planned areas such as Tickets, KB Chatbot, Knowledge Base, and Analytics. Those entries do not have pages yet.

## Run locally

Requires [Bun](https://bun.sh/) 1.4.1 (the version declared in `package.json`). From the repository root:

```bash
bun install
# Set HELPDESK_ADMIN_EMAIL and HELPDESK_ADMIN_PASSWORD in your shell first.
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). To run only the web workspace, use `bun run dev:web`.

First startup requires `HELPDESK_ADMIN_EMAIL` and `HELPDESK_ADMIN_PASSWORD` (12–128 characters) in the server environment. Administrator account is created only when database has no admin; use credentials to sign in at `/login`. Administrator creates support agents under `/settings/roles` with temporary passwords, then agents sign in to see dashboard, Slack, and SOP previews. Agents cannot open settings. Roles and sessions persist in SQLite at `apps/web/local.db` by default; set `HELPDESK_DB_PATH` to a writable persistent path in production. Protect database files and environment variables; do not store credentials in browser-side config or commit them. Use a persistent Node.js deployment with writable disk, not ephemeral serverless storage. `node:sqlite` requires Node.js 22.13+ (Node.js 24 recommended).

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
