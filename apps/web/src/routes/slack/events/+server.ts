import { deliverAiAnswer } from "$lib/server/ai-delivery";
import { verifySlackSignature } from "$lib/server/auth";
import { ingestSlackEvent } from "$lib/server/slack-intake";
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
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid Slack event payload." }, { status: 400 });
  }
  if (
    typeof payload === "object" &&
    payload !== null &&
    "type" in payload &&
    payload.type === "url_verification"
  ) {
    return json({
      challenge:
        "challenge" in payload && typeof payload.challenge === "string"
          ? payload.challenge
          : "",
    });
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("type" in payload) ||
    payload.type !== "event_callback"
  ) {
    return json({ accepted: false });
  }
  try {
    const result = ingestSlackEvent(payload);
    if (result.deliveryRequestId === undefined) {
      return json(result, { status: "slackError" in result ? 202 : 200 });
    }
    const delivery = await deliverAiAnswer(result.deliveryRequestId);
    return json(
      {
        accepted: result.accepted,
        duplicate: result.duplicate,
        queued: delivery.queued,
      },
      { status: delivery.queued ? 202 : 200 }
    );
  } catch {
    return json({ error: "Unable to process Slack event." }, { status: 500 });
  }
};
