import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const secret = "ai-slack-signing-secret";
const serverRoot = path.join(import.meta.dir, "apps/web/src/lib/server");
const moduleUrl = (name) => pathToFileURL(path.join(serverRoot, name)).href;

const intake = (address, input) => {
  const payload = {
    event: {
      channel: "C123ABC456",
      text: input.text,
      ts: input.messageTs ?? input.threadTs,
      type: input.type ?? "app_mention",
      user: input.user ?? "U-REQUESTER",
      user_name: input.userName ?? "Requester",
      ...(input.parentThreadTs ? { thread_ts: input.parentThreadTs } : {}),
    },
    event_id: input.eventId,
    team_id: "T123ABC456",
    type: "event_callback",
  };
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  return fetch(`${address}/slack/events`, {
    body,
    headers: {
      "content-type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": `v0=${createHmac("sha256", secret)
        .update(`v0:${timestamp}:${body}`)
        .digest("hex")}`,
    },
    method: "POST",
  });
};

const availablePort = () => {
  const probe = Bun.serve({ fetch: () => new Response(), port: 0 });
  const { port } = probe;
  probe.stop(true);
  return port;
};

const removeDirectory = async (directory, attempts = 20) => {
  try {
    rmSync(directory, { force: true, recursive: true });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "EBUSY" ||
      attempts === 0
    ) {
      throw error;
    }
    await delay(250);
    await removeDirectory(directory, attempts - 1);
  }
};

export const createAiSlackHarness = async ({ botToken = "xoxb-test" } = {}) => {
  const directory = mkdtempSync(path.join(tmpdir(), "helpdesk-ai-slack-"));
  const databasePath = path.join(directory, "local.db");
  const calls = [];
  const applications = [];
  let driverNumber = 0;
  let mode = "success";
  let heldAcknowledgement;
  const mock = Bun.serve({
    async fetch(request) {
      const body = await request.json();
      calls.push({
        authorization: request.headers.get("authorization"),
        body,
      });
      if (heldAcknowledgement) {
        heldAcknowledgement.received.resolve();
        await heldAcknowledgement.release.promise;
      }
      if (mode === "reject") {
        return Response.json({ error: "channel_not_found", ok: false });
      }
      if (mode === "unknown") {
        return Response.json({ error: "new_unknown_code", ok: false });
      }
      if (mode === "http_error") {
        return new Response("upstream failure", { status: 500 });
      }
      if (mode === "invalid_ack") {
        return Response.json({ channel: "C-WRONG", ok: true, ts: "invalid" });
      }
      if (mode === "slow") {
        await delay(150);
      }
      return Response.json({
        channel: body.channel,
        ok: true,
        ts: "1719999999.000001",
      });
    },
    port: 0,
  });

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
              ({ path: imported }) => ({ path: fileURLToPath(imported) })
            );
            builder.onResolve(
              { filter: /^\$lib\//u },
              ({ path: imported }) => ({
                path: `${path.join(serverRoot, "..", imported.slice(5))}.ts`,
              })
            );
          },
        },
      ],
      target: "node",
    });
    if (!build.success) {
      throw new Error("Driver build failed");
    }
    const running = Bun.spawn(
      [
        "node",
        "--disable-warning=ExperimentalWarning",
        driverPath.replace(/\.ts$/u, ".mjs"),
      ],
      {
        cwd: import.meta.dir,
        env: {
          ...process.env,
          HELPDESK_ADMIN_EMAIL: "admin@example.com",
          HELPDESK_ADMIN_PASSWORD: "secure-admin-password-2026",
          HELPDESK_DB_PATH: databasePath,
          NODE_ENV: "test",
          SLACK_API_URL: `http://127.0.0.1:${mock.port}/chat.postMessage`,
          SLACK_BOT_TOKEN: botToken,
        },
        stderr: "pipe",
        stdout: "pipe",
      }
    );
    const [exitCode, stderr, stdout] = await Promise.all([
      running.exited,
      new Response(running.stderr).text(),
      new Response(running.stdout).text(),
    ]);
    if (exitCode !== 0) {
      throw new Error(stderr);
    }
    return stdout ? JSON.parse(stdout) : null;
  };

  await runDriver(`
    const { getDatabase } = await import(${JSON.stringify(moduleUrl("auth.ts"))});
    const { ensureAiAnswerSchema } = await import(${JSON.stringify(moduleUrl("ai-answers.ts"))});
    ensureAiAnswerSchema();
    const db = getDatabase();
    db.exec(\`
      INSERT INTO slack_settings (id, workspace, channel) VALUES (1, 'T123ABC456', 'C123ABC456');
      INSERT INTO sops (id, title, body, status, created_by, updated_by) VALUES
        (100, 'Edited private title', 'Edited private procedure', 'active', 1, 1),
        (200, 'Draft Only', 'Private draft', 'draft', 1, 1),
        (300, 'Withdrawn Only', 'Withdrawn procedure', 'withdrawn', 1, 1);
      INSERT INTO sop_versions (id, sop_id, title, body) VALUES
        (100, 100, 'Reset Password', 'Approved reset procedure'),
        (300, 300, 'Withdrawn Only', 'Withdrawn procedure');
      UPDATE sops SET active_version_id = 100 WHERE id = 100;
      UPDATE sops SET active_version_id = 300 WHERE id = 300;
    \`);
    db.close();
  `);

  const start = async () => {
    const port = availablePort();
    const running = Bun.spawn(
      [
        "node",
        "node_modules/vite/bin/vite.js",
        "dev",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--strictPort",
      ],
      {
        cwd: path.join(import.meta.dir, "apps/web"),
        env: {
          ...process.env,
          HELPDESK_ADMIN_EMAIL: "admin@example.com",
          HELPDESK_ADMIN_PASSWORD: "secure-admin-password-2026",
          HELPDESK_DB_PATH: databasePath,
          NODE_ENV: "test",
          SLACK_API_URL: `http://127.0.0.1:${mock.port}/chat.postMessage`,
          SLACK_BOT_TOKEN: botToken,
          SLACK_SIGNING_SECRET: secret,
        },
        stderr: "inherit",
        stdout: "ignore",
      }
    );
    const address = `http://127.0.0.1:${port}`;
    const waitUntilReady = async (attempt = 0) => {
      if (attempt >= 80) {
        throw new Error("Vite failed to start");
      }
      try {
        const response = await fetch(`${address}/login`);
        if (response.ok) {
          applications.push(running);
          return;
        }
      } catch {
        // Vite is still starting.
      }
      await delay(200);
      await waitUntilReady(attempt + 1);
    };
    try {
      await waitUntilReady();
      return { address, running };
    } catch (error) {
      running.kill();
      throw error;
    }
  };

  return {
    calls,
    database: () => new DatabaseSync(databasePath),
    holdAcknowledgement: () => {
      heldAcknowledgement = {
        received: Promise.withResolvers(),
        release: Promise.withResolvers(),
      };
      return {
        received: heldAcknowledgement.received.promise,
        release: heldAcknowledgement.release.resolve,
      };
    },
    intake,
    runDriver,
    setMode: (value) => {
      mode = value;
    },
    start,
    stop: async () => {
      heldAcknowledgement?.release.resolve();
      for (const running of applications) {
        if (running.exitCode === null) {
          running.kill();
        }
      }
      await Promise.all(applications.map((running) => running.exited));
      mock.stop(true);
      await removeDirectory(directory);
    },
  };
};

export const aiDeliveryModuleUrl = moduleUrl("ai-delivery.ts");
