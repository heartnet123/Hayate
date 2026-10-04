# Better Auth Cutover (workspace-access) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled session auth in `apps/web/src/lib/server/auth.ts` with Better Auth (email + password, 7-day DB sessions, admin/agent roles, ban = revoked) without resetting any existing password, mapped to the `workspace-access` feature in `ROADMAP.html`.

**Architecture:** Better Auth instance configured with the existing `node:sqlite` database (no new native deps), custom scrypt `salt:hash` password codec so every existing password keeps working, fresh Better Auth tables (`user`, `session`, `account`, `verification`) created by the Better Auth CLI, and a one-shot data migration that copies legacy `users` rows into the new tables and repoints the domain tables' foreign keys. The old login/logout/roles endpoints switch to `auth.api.*` calls in one atomic cutover task so the app is never half-migrated in a working state.

**Tech Stack:** better-auth, node:sqlite (`DatabaseSync`, already used), SvelteKit 2.70 (satisfies Better Auth's 2.20+ floor for `getRequestEvent`), bun.

## Global Constraints

- Branch: `feat/workspace-access` (the branch name declared in ROADMAP.html for `workspace-access`). Cut from latest `main`.
- No new native dependency. Better Auth uses the existing `node:sqlite` handle; do **not** install `better-sqlite3`.
- Existing passwords must still log in after migration. The scrypt params (`scryptSync(password, salt, 64)`, hex) and salt values are preserved verbatim.
- Roles stay exactly `admin` / `agent`; "revoked" is represented by the Better Auth admin-plugin `banned` flag and mapped back to `revoked` in the roles UI payload.
- Session lifetime stays 7 days (60×60×24×7).
- Env additions: `BETTER_AUTH_SECRET` (required in production, generated in dev), plus existing `HELPDESK_DB_PATH`, `HELPDESK_ADMIN_EMAIL`, `HELPDESK_ADMIN_PASSWORD` keep their meaning.
- Secrets (password hashes, `BETTER_AUTH_SECRET`, signing secret) must never appear in any response payload or log line. No `console.log` in app code.
- Every task ends with `bun run check-types` (repo root) and `bun x ultracite check` passing.
- ROADMAP.html `workspace-access` acceptance criteria (must hold at the end):
  1. Signed-in agents see their workspace; signed-out requests cannot access its records.
  2. Only administrators can change integration and AI settings; server requests enforce this rule.
  3. Saved settings survive reload and a second authenticated session; failed saves retain the draft and show an error.
  4. Secrets never appear in browser responses or exported settings.
- Testing note (deliberate deviation): this repo has no JS test runner. Each task's verification is `check-types` + `ultracite check` + the explicit runtime journey or migration-script verification listed in the task. Do not introduce a test framework in this plan.

## Acceptance-criteria ↔ task map

| workspace-access criterion | Where it is implemented / verified |
|---|---|
| 1. Signed-in only, per workspace | Task 4 hooks guards (unchanged semantics) + Task 6 journey |
| 2. Admin-only settings, enforced server-side | Task 4 hooks `/settings` guard + `requireAdmin` in roles actions |
| 3. Settings survive reload / second session | Already true via `slack_settings` table; Task 6 journey re-verifies under Better Auth sessions |
| 4. No secrets in responses | Task 6 checks `/api/get-session` payload exposes only user fields |

## Current-state inventory (for the implementer)

- `apps/web/src/lib/server/auth.ts` — mixes auth + domain. Auth pieces being replaced: `authenticate`, `getUser`, `startSession`, `endSession`, `cookie`, `listUsers`, `createAgent`, `changeAgentRole`, the legacy `users`/`sessions` DDL and first-admin seed inside `getDatabase()`. Domain pieces that stay (moving to `db.ts`): slack settings, slack event ingest, tickets, official replies, internal notes, `verifySlackSignature`, plus validators `validEmail`, `validPassword`, `validSlackWorkspace`, `validSlackChannel`.
- Auth consumers (all 9): `app.d.ts`, `hooks.server.ts`, `routes/+layout.server.ts`, `routes/login/+page.server.ts`, `routes/logout/+page.server.ts`, `routes/settings/roles/+page.server.ts`, `routes/slack/+page.server.ts`, `routes/settings/slack/+page.server.ts`, `routes/slack/events/+server.ts`.
- Guard behavior to preserve exactly (`hooks.server.ts` today): public paths `/login`, `/login/*`, `/slack/events`, `/_app/*`, `/favicon.png`; signed-out GET/HTML → `redirect(303, "/login")`, otherwise `error(401)`; `/settings*` requires `role === "admin"` → `error(403)`.
- Legacy schema: `users(id INTEGER PK, email UNIQUE, password_hash, salt, role CHECK admin/agent/revoked)`, `sessions(token_hash TEXT PK, user_id, expires_at)`. Domain FKs: `tickets.assignee_id`, `official_replies.agent_id`, `internal_notes.author_id` → `users(id)`.
- Cookie today: `helpdesk_session`, httpOnly, lax, 7d. After cutover Better Auth uses `better-auth.session_token` (httpOnly, secure in prod) — cookie name change is expected; users re-login once (sessions are NOT migrated).
- Dev DB file: `local.db` relative to process cwd. `bun run dev` (turbo) runs Vite with cwd `apps/web`, so the live file is `apps/web/local.db`. The migration script takes the path as argv so there is no ambiguity.

---

### Task 1: Split domain code out of `auth.ts` into `db.ts` (pure move, no behavior change)

**Files:**
- Create: `apps/web/src/lib/server/db.ts`
- Modify: `apps/web/src/lib/server/auth.ts` (shrink to auth-only)
- Modify (import swaps only): the 9 consumer files listed in the inventory, except `app.d.ts`

**Interfaces:**
- Produces: `getDatabase(): DatabaseSync`, `getSlackSettings()`, `saveSlackSettings(workspace, channel)`, `verifySlackSignature(rawBody, timestamp, signature)`, `ingestSlackEvent(payload)`, `listCentralQueue()`, `validSlackWorkspace(workspace)`, `validSlackChannel(channel)`, `validEmail(email)`, `validPassword(password)`, types `SlackEventPayload`, `User`, `Role` — all exported from `$lib/server/db` (auth helpers remain temporarily in `auth.ts` until Task 4; `validEmail`/`validPassword` may be re-exported from `auth.ts` to avoid touching login/roles twice).

- [ ] **Step 1: Create `db.ts`**

Move verbatim from `auth.ts` into `apps/web/src/lib/server/db.ts`: the `node:crypto` imports actually used by moved code (`createHash`, `createHmac`, `randomBytes`, `scryptSync`, `timingSafeEqual` — `randomBytes`/`scryptSync`/`timingSafeEqual` are used by both files until Task 4; copy into both), the `DatabaseSync` import, the `SlackEventPayload` type and `aiMentionPattern`, `parseSlackMessage`, `getDatabase` **including the legacy `users`/`sessions` DDL and the first-admin seed block** (this block is removed in Task 4, not here — old login must keep working), and all slack/ticket functions: `getSlackSettings`, `saveSlackSettings`, `verifySlackSignature`, `ingestSlackEvent`, `listCentralQueue`, `validSlackWorkspace`, `validSlackChannel`, plus the `Role`/`User` types and `validEmail`, `validPassword`.

Do not edit any function bodies. Resulting file shape:

```ts
import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export type Role = "admin" | "agent" | "revoked";
export interface User {
  id: number;
  email: string;
  role: Role;
}

export const validEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) && email.length <= 254;
export const validPassword = (password: string) =>
  password.length >= 12 && password.length <= 128;
export const validSlackWorkspace = (workspace: string) =>
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,62}(?:\.slack\.com)?$/u.test(workspace);
export const validSlackChannel = (channel: string) =>
  /^(?:#[a-z0-9][a-z0-9_-]{1,79}|[CG][A-Z0-9]{8,})$/u.test(channel);

export const getDatabase = (): DatabaseSync => {
  /* moved verbatim — keep legacy users/sessions DDL + admin seed for now */
};
/* ...moved slack/ticket functions verbatim... */
```

`auth.ts` keeps: `hashPassword`, `hashToken`, `newSalt`, `sessionDuration`, `StoredUser`, `authenticate`, `getUser`, `startSession`, `endSession`, `cookie`, `listUsers`, `createAgent`, `changeAgentRole` — importing `getDatabase`, `validEmail`, `validPassword`, and types from `./db`. It no longer creates the database.

- [ ] **Step 2: Update imports in consumers**

In the consumer files, point domain imports at `$lib/server/db`. Domain consumers (`routes/+layout.server.ts`, `routes/slack/+page.server.ts`, `routes/settings/slack/+page.server.ts`, `routes/slack/events/+server.ts`) typically lose their `$lib/server/auth` import entirely. `app.d.ts` keeps importing `User` — from `"$lib/server/db"` now. Example for `routes/slack/events/+server.ts`:

```ts
import { ingestSlackEvent, verifySlackSignature } from "$lib/server/db";
```

- [ ] **Step 3: Verify**

Run: `bun run check-types && bun x ultracite check`
Expected: 0 errors. Then `bun run dev:web`, sign in with the existing admin account, open `/` and `/settings/slack` — behavior identical to before.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(web): split domain storage out of auth module"
```

---

### Task 2: Install Better Auth, create the auth instance, generate tables

**Files:**
- Modify: `apps/web/package.json` (add `better-auth`)
- Create: `apps/web/src/lib/server/better-auth.ts` (temporary home; moved to `auth.ts` in Task 4)
- Modify: `.env` / deploy docs (add `BETTER_AUTH_SECRET`)

**Interfaces:**
- Produces: `auth` — the Better Auth instance exported from `$lib/server/better-auth`; used by Tasks 4's hooks/login/logout/roles and nothing else until then. Consumes `getDatabase` from `$lib/server/db`.

- [ ] **Step 1: Install**

```bash
cd apps/web && bun add better-auth
```

- [ ] **Step 2: Create the Better Auth instance**

`apps/web/src/lib/server/better-auth.ts`:

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { getDatabase } from "$lib/server/db";

export const validEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) && email.length <= 254;
export const validPassword = (password: string) =>
  password.length >= 12 && password.length <= 128;

const newSalt = () => randomBytes(16).toString("hex");
const hashPassword = (password: string, salt: string) =>
  scryptSync(password, salt, 64).toString("hex");

// Packed format keeps legacy passwords working: "<salt-hex>:<scrypt-hex>"
export const packPassword = (password: string) => {
  const salt = newSalt();
  return `${salt}:${hashPassword(password, salt)}`;
};

export const verifyPackedPassword = (packed: string, password: string) => {
  const separator = packed.indexOf(":");
  if (separator < 0) return false;
  const salt = packed.slice(0, separator);
  const stored = packed.slice(separator + 1);
  const computed = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(stored, "hex");
  return (
    computed.length === expected.length && timingSafeEqual(computed, expected)
  );
};

export const auth = betterAuth({
  database: getDatabase(),
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    password: {
      hash: (password: string) => packPassword(password),
      verify: ({ hash, password }) => verifyPackedPassword(hash, password),
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7 },
  plugins: [admin(), sveltekitCookies(getRequestEvent)], // sveltekitCookies must stay last
});
```

Notes: `admin()` adds the `role`/`banned` fields and the `setRole`/`banUser`/`unbanUser` APIs used in Task 4. `role` defaults to `"user"` on signup — the roles create-action in Task 4 writes `'agent'` explicitly right after `signUpEmail`, so no plugin default tweak is needed. Do not add `user.additionalFields.role` here — `admin()` already declares it; a duplicate declaration breaks the schema.

- [ ] **Step 3: Generate secret and add schema tables**

Create a 32-byte secret (keep it out of git):

```bash
openssl rand -base64 32
```

Add to `.env` (git-ignored) and to the deployment env docs: `BETTER_AUTH_SECRET=<generated value>`.

Then apply the Better Auth schema to the dev database:

```bash
cd apps/web && bun x @better-auth/cli@latest migrate --config src/lib/server/better-auth.ts
```

Confirm the prompt. Expected output ends with schema applied successfully.

- [ ] **Step 4: Verify tables exist**

```bash
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('apps/web/local.db');console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\").all().map(r=>r.name).join('\n'))"
```

Expected: includes `user`, `session`, `account`, `verification` alongside the legacy tables.

- [ ] **Step 5: Verify nothing broke**

Run: `bun run check-types && bun x ultracite check`
Expected: 0 errors. Old login flow still works (nothing consumes `better-auth.ts` yet — svelte-check must still pass with the unused module).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json bun.lock apps/web/src/lib/server/better-auth.ts
git commit -m "feat(web): add better-auth instance over node:sqlite"
```

(bun workspaces keep `bun.lock` at the repo root — `git status` is the source of truth if the path differs.)

---

### Task 3: One-shot data migration to Better Auth tables

**Files:**
- Create: `scripts/migrate-to-better-auth.mjs`
- Modify: `apps/web/src/lib/server/db.ts` (guard the legacy admin seed so boot never throws once legacy tables are renamed)

**Interfaces:**
- Produces: migrated data — `user` rows with `id = String(legacyId)`, `name = email`, `role`, `banned = 0`; `account` rows (`providerId = 'credential'`, `password = "<salt>:<hash>"`); domain tables `tickets`, `official_replies`, `internal_notes` rebuilt with TEXT foreign keys to `user(id)`; legacy tables preserved as `users_legacy`, `sessions_legacy`. The migration script is the only component allowed to touch this structure.

- [ ] **Step 1: Guard the legacy seed in `db.ts`**

Wrap the first-admin seed block inside `getDatabase()` so a renamed `users` table cannot throw at boot (Task 4 deletes the block; until then boot must survive):

```ts
const usersTable = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
  .get();
if (usersTable && !db.prepare("SELECT id FROM users WHERE role = ? LIMIT 1").get("admin")) {
  /* existing seed body unchanged */
}
```

- [ ] **Step 2: Write `scripts/migrate-to-better-auth.mjs`**

```js
// One-shot: legacy users/sessions -> Better Auth user/account tables.
// Run once per environment BEFORE deploying the cutover commit:
//   node scripts/migrate-to-better-auth.mjs apps/web/local.db
import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const dbPath = process.argv[2] ?? process.env.HELPDESK_DB_PATH;
if (!dbPath) {
  console.error("Pass the db path: node scripts/migrate-to-better-auth.mjs apps/web/local.db");
  process.exit(1);
}
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout = 5000");
db.exec("PRAGMA journal_mode = WAL");

const tableExists = (name) =>
  Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));

if (!tableExists("user") || !tableExists("account")) {
  console.error("Better Auth tables missing. Run: bun x @better-auth/cli migrate --config src/lib/server/better-auth.ts");
  process.exit(1);
}
if (tableExists("users_legacy")) {
  console.log("Already migrated (users_legacy exists). Nothing to do.");
  process.exit(0);
}
if (!tableExists("users")) {
  console.log("No legacy users table. Nothing to do.");
  process.exit(0);
}

const legacyUsers = db.prepare("SELECT id, email, password_hash, salt, role FROM users").all();

const insertUser = db.prepare(`
  INSERT INTO user (id, name, email, emailVerified, image, createdAt, updatedAt, role, banned, banReason, banExpires)
  VALUES (?, ?, ?, 0, NULL, ?, ?, ?, 0, NULL, NULL)
  ON CONFLICT(id) DO NOTHING
`);
const insertAccount = db.prepare(`
  INSERT INTO account (id, accountId, providerId, userId, accessToken, refreshToken, idToken,
    accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt)
  VALUES (?, ?, 'credential', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)
`);

db.exec("BEGIN IMMEDIATE");
try {
  const now = new Date().toISOString();
  for (const u of legacyUsers) {
    const id = String(u.id);
    insertUser.run(id, u.email, u.email, now, now, u.role === "revoked" ? "agent" : u.role);
    insertAccount.run(randomBytes(16).toString("hex"), id, id, `${u.salt}:${u.password_hash}`, now, now);
  }

  // Rebuild domain tables so their FKs point at the Better Auth user table.
  const rebuild = (table, createSql) => {
    db.exec(`CREATE TABLE ${table}_new ${createSql}`);
    db.exec(`INSERT INTO ${table}_new SELECT * FROM ${table}`);
    db.exec(`DROP TABLE ${table}`);
    db.exec(`ALTER TABLE ${table}_new RENAME TO ${table}`);
  };
  rebuild("internal_notes", `(
    id INTEGER PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES tickets(id),
    author_id TEXT NOT NULL REFERENCES user(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  rebuild("official_replies", `(
    ticket_id INTEGER PRIMARY KEY REFERENCES tickets(id),
    agent_id TEXT NOT NULL REFERENCES user(id),
    body TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sending', 'failed', 'uncertain', 'sent')),
    slack_ts TEXT,
    error TEXT NOT NULL DEFAULT ''
  )`);
  rebuild("tickets", `(
    id INTEGER PRIMARY KEY,
    request_id INTEGER NOT NULL UNIQUE REFERENCES slack_requests(id),
    assignee_id TEXT REFERENCES user(id),
    reason TEXT NOT NULL,
    slack_error TEXT NOT NULL DEFAULT ''
  )`);

  db.exec("ALTER TABLE sessions RENAME TO sessions_legacy");
  db.exec("ALTER TABLE users RENAME TO users_legacy");
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}

// ---- Verification (fails loud, no partial trust) ----
const migratedCount = db.prepare("SELECT COUNT(*) AS n FROM user").get().n;
const accountCount = db.prepare("SELECT COUNT(*) AS n FROM account WHERE providerId = 'credential'").get().n;
if (migratedCount !== legacyUsers.length || accountCount !== legacyUsers.length) {
  throw new Error(`Count mismatch: users=${legacyUsers.length} user=${migratedCount} account=${accountCount}`);
}
const fkIssues = db.prepare("PRAGMA foreign_key_check").all();
if (fkIssues.length) {
  throw new Error(`foreign_key_check reported ${fkIssues.length} violations`);
}
const sample = db.prepare("SELECT a.password FROM account a JOIN user u ON u.id = a.userId WHERE u.banned = 0 LIMIT 1").get();
if (sample) {
  const [salt, stored] = String(sample.password).split(":");
  const check = scryptSync("definitely-not-the-password", salt, 64).toString("hex");
  if (timingSafeEqual(Buffer.from(check, "hex"), Buffer.from(stored, "hex"))) {
    throw new Error("Password codec sanity check failed");
  }
}
const admins = db.prepare("SELECT COUNT(*) AS n FROM user WHERE role = 'admin'").get().n;
if (admins === 0) {
  const email = process.env.HELPDESK_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.HELPDESK_ADMIN_PASSWORD;
  if (!(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) && password?.length >= 12 && password.length <= 128)) {
    throw new Error("Set HELPDESK_ADMIN_EMAIL and HELPDESK_ADMIN_PASSWORD to seed the first admin.");
  }
  const id = randomBytes(16).toString("hex");
  const now = new Date().toISOString();
  insertUser.run(id, email, email, now, now, "admin");
  const salt = randomBytes(16).toString("hex");
  insertAccount.run(randomBytes(16).toString("hex"), id, id, `${salt}:${scryptSync(password, salt, 64).toString("hex")}`, now, now);
  console.log(`Seeded first admin: ${email}`);
}
console.log(`Migrated ${legacyUsers.length} users. Legacy tables kept as users_legacy / sessions_legacy.`);
```

Rebuild order note: `internal_notes` and `official_replies` are rebuilt before `tickets` only because SQLite rewrites child FK references on `ALTER TABLE ... RENAME`; rebuilding children first (before `users` is renamed) keeps their FK targets resolvable, and `tickets` last drops the old `users` reference in the same transaction. Legacy `sessions` is intentionally **not** migrated — everyone logs in fresh once.

- [ ] **Step 3: Run it against the dev database**

```bash
node scripts/migrate-to-better-auth.mjs apps/web/local.db
```

Expected final lines: `Migrated N users. Legacy tables kept as users_legacy / sessions_legacy.` (plus `Seeded first admin:` only if the new tables were empty). Re-run it — expected: `Already migrated ... Nothing to do.` (idempotency check).

- [ ] **Step 4: Verify**

Run: `bun run check-types && bun x ultracite check`
Expected: 0 errors. Start `bun run dev:web` and sign in with the legacy admin — old login still works at this point (legacy code path reads `users_legacy` via the seed guard only; login itself reads `users` → will fail until Task 4 lands, which is the intended mid-branch state; Task 3's deliverable is the migration script + data, tested by its own verification above).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate-to-better-auth.mjs apps/web/src/lib/server/db.ts
git commit -m "feat(web): migrate legacy users into better-auth tables"
```

---

### Task 4: Cutover — hooks, login, logout, roles, types (atomic)

**Files:**
- Modify: `apps/web/src/hooks.server.ts`
- Modify: `apps/web/src/app.d.ts`
- Modify: `apps/web/src/routes/login/+page.server.ts`
- Modify: `apps/web/src/routes/logout/+page.server.ts`
- Modify: `apps/web/src/routes/settings/roles/+page.server.ts`
- Modify: `apps/web/src/lib/server/auth.ts` (replace: becomes the Better Auth module), delete `apps/web/src/lib/server/better-auth.ts`
- Modify: `apps/web/src/lib/server/db.ts` (remove legacy DDL + seed + auth helpers)

**Interfaces:**
- Consumes: `auth`, `packPassword`, `verifyPackedPassword`, `validEmail`, `validPassword` from `$lib/server/auth` (Task 2); `getDatabase` from `$lib/server/db` (Task 1).
- Produces: `App.Locals.user: { id: string; email: string; role: "admin" | "agent" } | null`; guard semantics identical to the current hooks; roles page payload keeps the shape `{ users: { id, email, role }[] }` with `revoked` synthesized from `banned`, so `roles/+page.svelte` needs no change.

- [ ] **Step 1: Move the Better Auth module to its final name**

Move the whole content of `apps/web/src/lib/server/better-auth.ts` into `apps/web/src/lib/server/auth.ts` (replacing the old file) and delete `better-auth.ts`. `auth.ts` now exports `auth`, `packPassword`, `verifyPackedPassword`, `validEmail`, `validPassword`.

- [ ] **Step 2: Remove legacy auth remnants from `db.ts`**

Delete from `db.ts`: the `users`/`sessions` CREATE statements and the first-admin seed block (with its `HELPDESK_ADMIN_*` logic — seeding now lives in the migration script), plus the now-unused `randomBytes`/`scryptSync`/`timingSafeEqual` imports and `Role`/`User` auth-only types if nothing else references them. Also delete `validEmail`/`validPassword` from `db.ts` — after the cutover they are exported only from `$lib/server/auth`; `grep -rn "validEmail\|validPassword" apps/web/src` must show exactly one definition (in `auth.ts`).

- [ ] **Step 3: Rewrite `hooks.server.ts`**

```ts
import { building } from "$app/environment";
import { error, redirect } from "@sveltejs/kit";
import { svelteKitHandler } from "better-auth/svelte-kit";
import type { Handle } from "@sveltejs/kit";
import { auth } from "$lib/server/auth";

export const handle: Handle = async ({ event, resolve }) => {
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.user = session
    ? {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role as "admin" | "agent",
      }
    : null;

  if (event.url.pathname.startsWith("/api/auth")) {
    return svelteKitHandler({ event, resolve, auth, building });
  }

  const path = event.url.pathname;
  if (
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/slack/events" ||
    path.startsWith("/_app/") ||
    path === "/favicon.png"
  ) {
    return resolve(event);
  }
  if (!event.locals.user) {
    if (
      event.request.method === "GET" &&
      event.request.headers.get("accept")?.includes("text/html")
    ) {
      redirect(303, "/login");
    }
    error(401, "Sign in required");
  }
  if (
    (event.route.id === "/settings" ||
      event.route.id?.startsWith("/settings/")) &&
    event.locals.user.role !== "admin"
  ) {
    error(403, "Admin access required");
  }
  return resolve(event);
};
```

- [ ] **Step 4: Update `app.d.ts`**

```ts
declare global {
  namespace App {
    interface Locals {
      user: { id: string; email: string; role: "admin" | "agent" } | null;
    }
  }
}

export {};
```

Note: user ids are now strings. `check-types` will surface any domain code that did arithmetic on them — treat ids as opaque everywhere.

- [ ] **Step 5: Rewrite login action**

`apps/web/src/routes/login/+page.server.ts`:

```ts
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { auth, validEmail, validPassword } from "$lib/server/auth";

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) {
    redirect(303, "/");
  }
};

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    if (!validEmail(email) || !validPassword(password)) {
      return fail(400, { message: "Invalid email or password." });
    }
    try {
      await auth.api.signInEmail({
        body: { email, password },
        headers: request.headers,
      });
    } catch {
      return fail(400, { message: "Invalid email or password." });
    }
    redirect(303, "/");
  },
};
```

The `sveltekitCookies` plugin (last plugin in the instance) sets `better-auth.session_token` through SvelteKit cookies — no manual `cookies.set` here.

- [ ] **Step 6: Rewrite logout action**

`apps/web/src/routes/logout/+page.server.ts`:

```ts
import { redirect } from "@sveltejs/kit";
import type { Actions } from "./$types";
import { auth } from "$lib/server/auth";

export const actions: Actions = {
  default: async ({ request }) => {
    await auth.api.signOut({ headers: request.headers });
    redirect(303, "/login");
  },
};
```

- [ ] **Step 7: Rewrite roles admin actions**

`apps/web/src/routes/settings/roles/+page.server.ts`:

```ts
import { fail, error } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { auth, validEmail, validPassword } from "$lib/server/auth";
import { getDatabase } from "$lib/server/db";

type UserRow = { id: string; email: string; role: string; banned: number };

const requireAdmin = (locals: App.Locals) => {
  if (locals.user?.role !== "admin") {
    error(403, "Admin access required");
  }
};

export const load: PageServerLoad = ({ locals }) => {
  requireAdmin(locals);
  const rows = getDatabase()
    .prepare("SELECT id, email, role, banned FROM user ORDER BY email")
    .all() as unknown as UserRow[];
  return {
    users: rows.map(({ banned, ...user }) => ({
      ...user,
      role: banned ? "revoked" : user.role,
    })),
  };
};

export const actions: Actions = {
  change: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const role = form.get("role");
    if (!validEmail(email) || (role !== "agent" && role !== "revoked")) {
      return fail(400, { message: "Invalid account or role." });
    }
    const current = getDatabase()
      .prepare("SELECT id, role, banned FROM user WHERE email = ?")
      .get(email) as { id: string; role: string; banned: number } | undefined;
    if (!current || current.role === "admin") {
      return fail(400, { message: "Agent role already set or account not found." });
    }
    const revoked = Boolean(current.banned);
    if (role === "agent" && !revoked && current.role === "agent") {
      return fail(400, { message: "Agent role already set or account not found." });
    }
    if (role === "revoked" && revoked) {
      return fail(400, { message: "Agent role already set or account not found." });
    }
    try {
      if (role === "revoked") {
        await auth.api.banUser({ body: { userId: current.id }, headers: request.headers });
      } else {
        await auth.api.unbanUser({ body: { userId: current.id }, headers: request.headers });
        await auth.api.setRole({
          body: { userId: current.id, role: "agent" },
          headers: request.headers,
        });
      }
    } catch {
      return fail(500, { message: "Unable to save permissions. Try again." });
    }
    return { success: true };
  },
  create: async ({ request, locals }) => {
    requireAdmin(locals);
    const form = await request.formData();
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    if (!validEmail(email) || !validPassword(password)) {
      return fail(400, {
        message: "Enter valid email and password of 12 to 128 characters.",
      });
    }
    try {
      await auth.api.signUpEmail({
        body: { email, password, name: email },
        headers: request.headers,
      });
      // Fresh user has no live session; a direct role write avoids relying on
      // the admin plugin's default role for this one case.
      getDatabase()
        .prepare("UPDATE user SET role = 'agent' WHERE email = ?")
        .run(email);
    } catch {
      return fail(400, { message: "Account already exists." });
    }
    return { success: true };
  },
};
```

- [ ] **Step 8: Verify the full journey (dev)**

Run: `bun run check-types && bun x ultracite check` — 0 errors expected.
Then `bun run dev:web` and walk:

1. Signed-out GET `/` → redirected to `/login`.
2. Sign in with the **pre-migration** admin password → lands on `/` (proves the packed-legacy password codec).
3. `/settings/roles`: create agent `test.agent@example.com` / 12+ char password; sign in as that agent in a second browser profile → succeeds; revoke that agent → agent's next request gets redirected to `/login` (banned sessions rejected).
4. Agent account hitting `/settings` → `403 Admin access required` (server-side, also via `curl -i` with the agent cookie).
5. Sign out → cookie cleared, `/login`.
6. Signed-out `curl -i http://localhost:5173/` → `401` for API-style requests (non-HTML accept header).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): cutover session auth to better-auth"
```

---

### Task 5: Drop legacy tables and dead code

**Files:**
- Modify: `scripts/migrate-to-better-auth.mjs` (no change expected — verification only)
- Modify: `apps/web/src/lib/server/db.ts`, `apps/web/src/lib/server/auth.ts` (final sweep)

**Interfaces:**
- Consumes: everything from Task 4. Produces: a codebase with no reference to `users_legacy`, `sessions_legacy`, `helpdesk_session`, `authenticate`, `startSession`, `endSession`, `changeAgentRole`, `createAgent`.

- [ ] **Step 1: Sweep for dead references**

```bash
grep -rn "users_legacy\|sessions_legacy\|helpdesk_session\|startSession\|endSession\|authenticate\|changeAgentRole\|createAgent\|token_hash" apps/web/src scripts
```

Expected: only hits inside `scripts/migrate-to-better-auth.mjs` (its own rename logic). Remove any stragglers.

- [ ] **Step 2: Drop legacy tables (destructive — backup first)**

Back up the dev database, then drop:

```bash
cp apps/web/local.db apps/web/local.db.pre-drop.bak
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('apps/web/local.db');db.exec('DROP TABLE IF EXISTS users_legacy');db.exec('DROP TABLE IF EXISTS sessions_legacy');console.log('legacy tables dropped')"
```

For production, drop only after one release cycle on Better Auth and a fresh backup. Do not run this against production during this task.

- [ ] **Step 3: Verify and commit**

`bun run check-types && bun x ultracite check` — 0 errors. Boot the app and repeat journey steps 1–2 of Task 4.

```bash
git add -A
git commit -m "chore(web): drop legacy auth tables and helpers"
```

---

### Task 6: ROADMAP.html sync + final acceptance pass

**Files:**
- Modify: `ROADMAP.html` (one field)

**Interfaces:**
- Consumes: nothing. Produces: roadmap board state matching reality.

- [ ] **Step 1: Flip the card status**

In `ROADMAP.html`, feature `workspace-access`, change `status:'Planned'` → `status:'In Progress'`. Leave `branch:'feat/workspace-access'` and the acceptance criteria untouched (they are now implemented; flip to `'Done'` in the merge PR once the pilot journey below is recorded).

- [ ] **Step 2: Final acceptance pass against the roadmap card**

Verify and record results in the PR description, one line per criterion:

1. Signed-out access denied everywhere except `/login`, `/slack/events`, static assets (Task 4 journey step 1 + 6).
2. Admin-only settings enforced server-side: agent cookie gets `403` on `/settings*` (Task 4 journey step 4). Also re-check `/settings/slack` save still persists and survives reload + a second admin session (criterion 3).
3. Response secret scan: `curl -s http://localhost:5173/api/auth/get-session -H "Cookie: <admin cookie>"` — response contains `id`, `email`, `role` only; no password, salt, hash, or `BETTER_AUTH_SECRET` value anywhere in any response body (criterion 4).

- [ ] **Step 3: Final checks and push**

```bash
bun run check-types && bun x ultracite check && bun run build
```

Expected: all pass. Push branch `feat/workspace-access` and open the PR toward the `ticket-lifecycle` dependency chain (roadmap: `ticket-lifecycle` depends on this feature).
