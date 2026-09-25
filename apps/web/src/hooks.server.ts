import { cookie, getUser } from "$lib/server/auth";
import { error, redirect } from "@sveltejs/kit";
import type { Handle } from "@sveltejs/kit";

export const handle: Handle = ({ event, resolve }) => {
  const user = getUser(event.cookies.get(cookie.name));
  event.locals.user = user;
  const path = event.url.pathname;

  if (
    path === "/login" ||
    path.startsWith("/login/") ||
    path.startsWith("/_app/") ||
    path === "/favicon.png"
  ) {
    return resolve(event);
  }
  if (!user) {
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
    user.role !== "admin"
  ) {
    error(403, "Admin access required");
  }
  return resolve(event);
};
