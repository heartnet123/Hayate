import { cookie, endSession } from "$lib/server/auth";
import { redirect } from "@sveltejs/kit";

import type { Actions } from "./$types";

export const actions: Actions = {
  default: ({ cookies }) => {
    endSession(cookies.get(cookie.name));
    cookies.delete(cookie.name, { path: "/" });
    redirect(303, "/login");
  },
};
