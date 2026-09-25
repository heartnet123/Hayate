<img src="apps/web/static/favicon.png" alt="HelpDesk AI icon" width="48" height="48">

# HelpDesk AI

An interactive help desk interface prototype built with SvelteKit. Explore support metrics, Slack intake, SOP drafting, and configuration screens using sample data.

> [!IMPORTANT]
> This is a UI demo. Metrics, messages, tickets, and AI suggestions are examples. Actions such as saving settings, replying, creating tickets, and publishing SOPs stay in the current page session. They do not call Slack, an AI model, or a backend, and changes are lost on reload.

## Explore the demo

| Route | What you can explore |
| --- | --- |
| `/` | Dashboard with ticket trends, categories, CSAT, AI insight examples, and recent tickets. |
| `/slack` | Sample conversations, channel filtering, a reply draft, triage example, and ticket preview. |
| `/sop` | A sample ticket and editable SOP title and sections, with reviewer and publish controls. |
| `/settings` | Configuration previews for General, Ticket Workflow, Slack Integration, AI Automation, Knowledge Base, Notifications, Roles & Permissions, and SLA Policies. |

The sidebar also shows planned areas such as Tickets, KB Chatbot, Knowledge Base, and Analytics. Those entries do not have pages yet.

## Run locally

Requires [Bun](https://bun.sh/) 1.4.1 (the version declared in `package.json`). From the repository root:

```bash
bun install
bun run dev
```

Open [http://localhost:5173](http://localhost:5173). To run only the web workspace, use `bun run dev:web`.

No API keys or database are needed for the current demo. [`apps/web/.env.schema`](apps/web/.env.schema) defines `NODE_ENV` with a `development` default. Installation generates the typed environment accessor. After editing the schema, run `bun run env:generate`.

## Project layout

```text
apps/web/          SvelteKit app, routes, styles, and static assets
packages/config/   Shared TypeScript configuration
interface.test.js  Interface regression checks
```

Built with Svelte 5, SvelteKit, TypeScript, Tailwind CSS 4, Bun, Turborepo, Varlock, and Ultracite.

## Checks

Run from the repository root:

```bash
bun test
bun run check-types
bun run check
```

`bun run build` creates a production build. `bun run fix` applies the project's lint and format rules.
