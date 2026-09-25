import {
  saveSlackSettings,
  validSlackChannel,
  validSlackWorkspace,
} from "$lib/server/auth";
import { error, fail } from "@sveltejs/kit";

import type { Actions } from "./$types";

export const actions: Actions = {
  default: async ({ request, locals }) => {
    if (locals.user?.role !== "admin") {
      error(403, "Admin access required");
    }
    const form = await request.formData();
    const workspace = String(form.get("workspace") ?? "").trim();
    const channel = String(form.get("channel") ?? "").trim();
    if (!validSlackWorkspace(workspace) || !validSlackChannel(channel)) {
      return fail(400, {
        channel,
        message:
          "Enter a valid Slack workspace and support channel (for example, acme-support and #it-support).",
        workspace,
      });
    }
    try {
      saveSlackSettings(workspace, channel);
    } catch {
      return fail(500, {
        channel,
        message: "Unable to save Slack settings. Try again.",
        workspace,
      });
    }
    return { success: true };
  },
};
