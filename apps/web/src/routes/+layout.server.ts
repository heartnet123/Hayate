import { getSlackSettings } from "$lib/server/auth";

import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals }) => ({
  slack: locals.user ? getSlackSettings() : null,
  user: locals.user,
});
