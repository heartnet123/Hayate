import { ingestSlackEvent, verifySlackSignature } from "$lib/server/auth";
import type { SlackEventPayload } from "$lib/server/auth";
import { json } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  const rawBody = await request.text();
  if (
    !verifySlackSignature(
      rawBody,
      request.headers.get("x-slack-request-timestamp"),
      request.headers.get("x-slack-signature")
    )
  ) {
    return json({ error: "Invalid Slack signature." }, { status: 401 });
  }
  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody) as SlackEventPayload;
  } catch {
    return json({ error: "Invalid Slack event payload." }, { status: 400 });
  }
  if (payload?.type === "url_verification") {
    return json({ challenge: String(payload.challenge ?? "") });
  }
  if (payload?.type !== "event_callback") {
    return json({ accepted: false });
  }
  try {
    const result = ingestSlackEvent(payload);
    return json(result, { status: "slackError" in result ? 202 : 200 });
  } catch {
    return json({ error: "Unable to process Slack event." }, { status: 500 });
  }
};
