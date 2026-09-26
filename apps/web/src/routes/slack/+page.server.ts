import { listCentralQueue } from "$lib/server/auth";
import { sendOfficialReply } from "$lib/server/replies";
import { claimTicket, listAssignedTickets } from "$lib/server/tickets";
import { error as httpError, fail } from "@sveltejs/kit";

import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals }) => ({
  assigned: listAssignedTickets(locals.user?.id ?? -1),
  queue: listCentralQueue(),
});

export const actions: Actions = {
  claim: async ({ request, locals }) => {
    if (!locals.user || locals.user.role === "revoked") {
      httpError(403, "Support access required");
    }
    const data = await request.formData();
    const rawId = data.get("ticketId");
    const ticketId = Number(rawId);
    if (
      typeof rawId !== "string" ||
      !Number.isSafeInteger(ticketId) ||
      ticketId < 1
    ) {
      return fail(400, { message: "Invalid ticket." });
    }
    let result;
    try {
      result = claimTicket(ticketId, locals.user.id);
    } catch (error) {
      if (
        error instanceof Error &&
        /SQLITE_BUSY|database is (?:locked|busy)/u.test(error.message)
      ) {
        return fail(503, { message: "Ticket is busy. Refresh and try again." });
      }
      throw error;
    }
    if (!result.claimed) {
      return fail(409, {
        message:
          result.owner === null
            ? "Ticket not found."
            : `Ticket already claimed by agent #${result.owner}. Refresh to see current work.`,
      });
    }
    return { success: true };
  },
  reply: async ({ request, locals }) => {
    if (!locals.user || locals.user.role === "revoked") {
      httpError(403, "Support access required");
    }
    const data = await request.formData();
    const rawId = data.get("ticketId");
    const ticketId = Number(rawId);
    const body = data.get("body");
    if (
      typeof rawId !== "string" ||
      !Number.isSafeInteger(ticketId) ||
      ticketId < 1 ||
      typeof body !== "string" ||
      body.trim().length < 1 ||
      body.length > 4000
    ) {
      return fail(400, { message: "Enter a reply of 1 to 4000 characters." });
    }
    let result;
    try {
      result = await sendOfficialReply(ticketId, locals.user.id, body.trim());
    } catch (error) {
      if (
        error instanceof Error &&
        /SQLITE_BUSY|database is (?:locked|busy)/u.test(error.message)
      ) {
        return fail(503, { message: "Ticket is busy. Refresh and try again." });
      }
      throw error;
    }
    if (result.status === "forbidden") {
      httpError(403, result.message);
    }
    if (result.status === "conflict") {
      return fail(409, { message: result.message });
    }
    if (result.status !== "sent") {
      return fail(result.status === "failed" ? 502 : 503, {
        message: result.message,
      });
    }
    return { message: result.message, success: true };
  },
};
