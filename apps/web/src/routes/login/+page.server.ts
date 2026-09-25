import { authenticate, cookie, startSession } from "$lib/server/auth";
import { fail, redirect } from "@sveltejs/kit";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => {
  if (locals.user) {
    redirect(303, "/");
  }
};

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const form = await request.formData();
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    const user = authenticate(email, password);
    if (!user) {
      return fail(400, { message: "Invalid email or password." });
    }
    const token = startSession(user);
    cookies.set(cookie.name, token, {
      ...cookie.options,
      secure: url.protocol === "https:",
    });
    redirect(303, "/");
  },
};
