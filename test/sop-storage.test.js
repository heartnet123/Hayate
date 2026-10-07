import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = mkdtempSync(path.join(tmpdir(), "helpdesk-sop-storage-"));
const databasePath = path.join(directory, "local.db");
const serverRoot = path.join(import.meta.dir, "../apps/web/src/lib/server");
const moduleUrl = (name) => pathToFileURL(path.join(serverRoot, name)).href;
let driverNumber = 0;

const runDriver = async (source) => {
  driverNumber += 1;
  const driverPath = path.join(directory, `driver-${driverNumber}.ts`);
  await Bun.write(driverPath, source);
  const build = await Bun.build({
    entrypoints: [driverPath],
    naming: "[name].mjs",
    outdir: directory,
    plugins: [
      {
        name: "server-alias",
        setup(builder) {
          builder.onResolve(
            { filter: /^file:\/\//u },
            ({ path: imported }) => ({
              path: fileURLToPath(imported),
            })
          );
          builder.onResolve({ filter: /^\$lib\//u }, ({ path: imported }) => ({
            path: `${path.join(serverRoot, "..", imported.slice(5))}.ts`,
          }));
        },
      },
    ],
    target: "node",
  });
  expect(build.success).toBe(true);
  const process = Bun.spawn(
    [
      "node",
      "--disable-warning=ExperimentalWarning",
      driverPath.replace(/\.ts$/u, ".mjs"),
    ],
    {
      cwd: path.join(import.meta.dir, ".."),
      env: {
        ...Bun.env,
        HELPDESK_ADMIN_EMAIL: "bootstrap@example.com",
        HELPDESK_ADMIN_PASSWORD: "bootstrap-password-2026",
        HELPDESK_DB_PATH: databasePath,
        NODE_ENV: "test",
      },
      stderr: "pipe",
      stdout: "pipe",
    }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
  return JSON.parse(stdout);
};

afterEach(() => rmSync(directory, { force: true, recursive: true }));

test("storage keeps approved answer provenance and rejects ineligible versions across restart", async () => {
  await runDriver(`
    const { getDatabase } = await import(${JSON.stringify(moduleUrl("auth.ts"))});
    getDatabase().close();
    console.log(JSON.stringify({ initialized: true }));
  `);
  const coldStart = `
    const { listEligibleSops } = await import(${JSON.stringify(moduleUrl("sop-answers.ts"))});
    console.log(JSON.stringify(listEligibleSops()));
  `;
  const concurrent = await Promise.all([
    runDriver(coldStart),
    runDriver(coldStart),
  ]);
  expect(concurrent).toEqual([[], []]);
  const firstRun = await runDriver(`
    const { getDatabase } = await import(${JSON.stringify(moduleUrl("auth.ts"))});
    const { getSop, saveSopDraft } = await import(${JSON.stringify(moduleUrl("sop.ts"))});
    const { approveSop, withdrawSop } = await import(${JSON.stringify(moduleUrl("sop-lifecycle.ts"))});
    const { listEligibleSops, recordSopAnswer } = await import(${JSON.stringify(moduleUrl("sop-answers.ts"))});
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const db = getDatabase();
    db.exec(\`
      INSERT INTO users (email, password_hash, salt, role) VALUES
        ('admin@example.com', 'hash', 'salt', 'admin'),
        ('agent@example.com', 'hash', 'salt', 'agent'),
        ('former-admin@example.com', 'hash', 'salt', 'admin');
      INSERT INTO slack_requests (workspace, channel, thread_ts, owner_id, owner_name)
        VALUES ('T-SOP', 'C-SOP', '1.000001', 'U-SOP', 'SOP Test');
      INSERT INTO tickets (request_id, reason) VALUES (1, 'SOP provenance test');
    \`);
    const users = db.prepare("SELECT id, email, role FROM users WHERE email != 'bootstrap@example.com' ORDER BY id").all();
    const adminId = Number(users.find((user) => user.email === 'admin@example.com').id);
    const agentId = Number(users.find((user) => user.role === 'agent').id);
    const formerAdminId = Number(users.find((user) => user.email === 'former-admin@example.com').id);
    const created = saveSopDraft({ actorId: agentId, body: 'Version one body', id: null, revision: null, title: 'Version one' });
    check(created.kind === 'saved', 'draft create failed');
    const sopId = created.id;
    check(listEligibleSops().length === 0, 'draft became eligible');
    db.prepare("UPDATE users SET role = 'revoked' WHERE id = ?").run(formerAdminId);
    check(approveSop({ actorId: formerAdminId, revision: 1, sopId }).kind === 'forbidden', 'revoked admin approved');
    check(saveSopDraft({ actorId: formerAdminId, body: 'Revoked', id: sopId, revision: 1, title: 'Revoked' }).kind === 'forbidden', 'revoked actor edited draft');
    check(saveSopDraft({ actorId: formerAdminId, body: 'Revoked', id: null, revision: null, title: 'Revoked' }).kind === 'forbidden', 'revoked actor created draft');

    db.exec("CREATE TRIGGER abort_after_version BEFORE INSERT ON sop_events BEGIN SELECT RAISE(ABORT, 'event abort'); END;");
    let eventAbort = false;
    try { approveSop({ actorId: adminId, revision: 1, sopId }); } catch { eventAbort = true; }
    check(eventAbort, 'event abort did not throw');
    check(db.prepare('SELECT COUNT(*) AS count FROM sop_versions').get().count === 0, 'version survived event abort');
    check(getSop(sopId).revision === 1, 'draft changed after event abort');
    db.exec('DROP TRIGGER abort_after_version');

    db.exec(\`CREATE TRIGGER abort_after_audit BEFORE UPDATE ON sops WHEN OLD.id = \${sopId}
      BEGIN SELECT RAISE(ABORT, 'update abort'); END;\`);
    let updateAbort = false;
    try { approveSop({ actorId: adminId, revision: 1, sopId }); } catch { updateAbort = true; }
    check(updateAbort, 'update abort did not throw');
    check(db.prepare('SELECT COUNT(*) AS count FROM sop_versions').get().count === 0, 'version survived update abort');
    check(db.prepare('SELECT COUNT(*) AS count FROM sop_events').get().count === 0, 'audit survived update abort');
    check(getSop(sopId).title === 'Version one', 'saved draft lost after rollback');
    db.exec('DROP TRIGGER abort_after_audit');

    const firstApproval = approveSop({ actorId: adminId, revision: 1, sopId });
    check(firstApproval.kind === 'approved', 'first approval failed');
    const versionOneId = firstApproval.versionId;
    check(JSON.stringify(listEligibleSops()) === JSON.stringify([{ body: 'Version one body', sopId, title: 'Version one', versionId: versionOneId }]), 'first eligibility wrong');
    check(recordSopAnswer(0, versionOneId, 'invalid') === 'ineligible', 'invalid ticket recorded');
    check(recordSopAnswer(1, versionOneId, '  ') === 'ineligible', 'empty answer recorded');
    check(recordSopAnswer(1, versionOneId, 'Answer from version one') === 'recorded', 'first answer failed');
    let immutable = false;
    try { db.prepare("UPDATE sop_versions SET body = 'mutated' WHERE id = ?").run(versionOneId); } catch { immutable = true; }
    check(immutable, 'approved version was mutable');

    const edited = saveSopDraft({ actorId: agentId, body: 'Version two body', id: sopId, revision: 2, title: 'Version two' });
    check(edited.kind === 'saved', 'active draft edit failed');
    check(db.prepare('SELECT body FROM sop_versions WHERE id = ?').get(versionOneId).body === 'Version one body', 'approved version mutated');
    const secondApproval = approveSop({ actorId: adminId, revision: 3, sopId });
    check(secondApproval.kind === 'approved', 'second approval failed');
    const versionTwoId = secondApproval.versionId;
    const supersededResult = recordSopAnswer(1, versionOneId, 'Superseded answer');
    check(supersededResult === 'ineligible', 'superseded version recorded');
    check(recordSopAnswer(1, versionTwoId, 'Answer from version two') === 'recorded', 'second answer failed');
    db.exec("CREATE TRIGGER abort_withdrawal BEFORE INSERT ON sop_events WHEN NEW.action = 'withdrawn' BEGIN SELECT RAISE(ABORT, 'withdrawal abort'); END;");
    let withdrawalAbort = false;
    try { withdrawSop({ actorId: adminId, revision: 4, sopId }); } catch { withdrawalAbort = true; }
    check(withdrawalAbort && getSop(sopId).status === 'active' && getSop(sopId).revision === 4, 'failed withdrawal changed saved state');
    db.exec('DROP TRIGGER abort_withdrawal');
    check(withdrawSop({ actorId: adminId, revision: 4, sopId }).kind === 'withdrawn', 'withdrawal failed');
    check(listEligibleSops().length === 0, 'withdrawn SOP remained eligible');
    const withdrawnResult = recordSopAnswer(1, versionTwoId, 'Withdrawn answer');
    check(withdrawnResult === 'ineligible', 'withdrawn version recorded');
    db.prepare("UPDATE users SET email = 'renamed@example.com' WHERE id = ?").run(adminId);
    const auditEmails = db.prepare('SELECT actor_email AS email FROM sop_events ORDER BY id').all().map((row) => row.email);
    const answers = db.prepare('SELECT sop_answers.body, sop_versions.body AS sourceBody FROM sop_answers JOIN sop_versions ON sop_versions.id = sop_answers.version_id ORDER BY sop_answers.id').all();
    console.log(JSON.stringify({ answers, auditEmails, rejections: { supersededResult, withdrawnResult }, sopId, versionOneId, versionTwoId }));
    db.close();
  `);

  expect(firstRun.auditEmails).toEqual([
    "admin@example.com",
    "admin@example.com",
    "admin@example.com",
  ]);
  expect(firstRun.answers).toEqual([
    { body: "Answer from version one", sourceBody: "Version one body" },
    { body: "Answer from version two", sourceBody: "Version two body" },
  ]);
  expect(firstRun.rejections).toEqual({
    supersededResult: "ineligible",
    withdrawnResult: "ineligible",
  });

  const restarted = await runDriver(`
    const { getDatabase } = await import(${JSON.stringify(moduleUrl("auth.ts"))});
    const { getSop } = await import(${JSON.stringify(moduleUrl("sop.ts"))});
    const { listEligibleSops } = await import(${JSON.stringify(moduleUrl("sop-answers.ts"))});
    const db = getDatabase();
    const sop = getSop(${firstRun.sopId});
    const historical = db.prepare('SELECT sop_answers.body, sop_versions.body AS sourceBody FROM sop_answers JOIN sop_versions ON sop_versions.id = sop_answers.version_id ORDER BY sop_answers.id').all();
    console.log(JSON.stringify({ eligible: listEligibleSops(), historical, sop }));
    db.close();
  `);
  expect(restarted.eligible).toEqual([]);
  expect(restarted.sop).toMatchObject({
    revision: 5,
    status: "withdrawn",
    title: "Version two",
  });
  expect(restarted.historical).toEqual(firstRun.answers);
}, 30_000);
