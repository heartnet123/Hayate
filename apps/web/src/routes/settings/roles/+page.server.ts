import {
  changeAgentRole,
  createAgent,
  listUsers,
  validEmail,
  validPassword,
} from "$lib/server/auth";
import { fail, error } from "@sveltejs/kit";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user?.role !== "admin") {
    error(403, "Admin access required");
  }
  return { users: listUsers() };
};

export const actions: Actions = {
  change: async ({ request, locals }) => {
    if (locals.user?.role !== "admin") {
      error(403, "Admin access required");
    }
    const form = await request.formData();
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const role = form.get("role");
    if (!validEmail(email) || (role !== "agent" && role !== "revoked")) {
      return fail(400, { message: "Invalid account or role." });
    }
    try {
      if (!changeAgentRole(email, role)) {
        return fail(400, {
          message: "Agent role already set or account not found.",
        });
      }
    } catch {
      return fail(500, { message: "Unable to save permissions. Try again." });
    }
    return { success: true };
  },
  create: async ({ request, locals }) => {
    if (locals.user?.role !== "admin") {
      error(403, "Admin access required");
    }
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
      if (!createAgent(email, password)) {
        return fail(400, { message: "Account already exists." });
      }
    } catch {
      return fail(500, { message: "Unable to save permissions. Try again." });
    }
    return { success: true };
  },
};
