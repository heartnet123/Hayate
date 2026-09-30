import {
  getSopDraft,
  listSopDrafts,
  saveSopDraft,
  SOP_BODY_MAX_LENGTH,
  SOP_TITLE_MAX_LENGTH,
} from "$lib/server/sop";
import { error as httpError, fail, redirect } from "@sveltejs/kit";

import type { Actions, PageServerLoad } from "./$types";

const positiveInteger = (value: string): number | null => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const load: PageServerLoad = ({ locals, url }) => {
  if (!locals.user || locals.user.role === "revoked") {
    httpError(403, "Support access required");
  }
  const rawId = url.searchParams.get("id");
  const selectedId = rawId === null ? null : positiveInteger(rawId);
  if (rawId !== null && selectedId === null) {
    httpError(400, "Invalid SOP draft");
  }
  try {
    return {
      selected: selectedId === null ? null : getSopDraft(selectedId),
      sops: listSopDrafts(),
    };
  } catch {
    httpError(500, "Unable to load SOP drafts");
  }
};

export const actions: Actions = {
  save: async ({ locals, request }) => {
    if (!locals.user || locals.user.role === "revoked") {
      httpError(403, "Support access required");
    }
    const form = await request.formData();
    const rawId = form.get("id");
    const rawRevision = form.get("revision");
    const rawTitle = form.get("title");
    const rawBody = form.get("body");
    const attempted = {
      body: typeof rawBody === "string" ? rawBody : "",
      id: typeof rawId === "string" ? rawId : "",
      revision: typeof rawRevision === "string" ? rawRevision : "",
      title: typeof rawTitle === "string" ? rawTitle : "",
    };
    const id = attempted.id === "" ? null : positiveInteger(attempted.id);
    const revision =
      attempted.revision === "" ? null : positiveInteger(attempted.revision);
    const isCreate = attempted.id === "" && attempted.revision === "";
    const isEdit = id !== null && revision !== null;
    const title = attempted.title.trim();
    const body = attempted.body.trim();
    if (
      !(isCreate || isEdit) ||
      title.length < 1 ||
      title.length > SOP_TITLE_MAX_LENGTH ||
      body.length < 1 ||
      body.length > SOP_BODY_MAX_LENGTH
    ) {
      return fail(400, {
        ...attempted,
        message: `Enter a title of 1 to ${SOP_TITLE_MAX_LENGTH} characters and body of 1 to ${SOP_BODY_MAX_LENGTH} characters.`,
      });
    }
    let result;
    try {
      result = saveSopDraft({
        actorId: locals.user.id,
        body,
        id,
        revision,
        title,
      });
    } catch {
      return fail(500, {
        ...attempted,
        message: "Unable to save SOP draft. Try again.",
      });
    }
    if (result.kind === "forbidden") {
      return fail(403, { ...attempted, message: "Support access required" });
    }
    if (result.kind === "conflict") {
      return fail(409, {
        ...attempted,
        message: "Draft changed since it was loaded. Refresh and try again.",
      });
    }
    redirect(303, `/sop?id=${result.id}`);
  },
};
