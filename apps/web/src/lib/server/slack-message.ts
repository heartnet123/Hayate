const HUMAN_MESSAGE_SUBTYPES = new Set([
  "thread_broadcast",
  "file_share",
  "me_message",
]);
const SLACK_TIMESTAMP = /^\d+\.\d{1,6}$/u;

interface SlackEvent {
  readonly bot_id?: unknown;
  readonly channel?: unknown;
  readonly subtype?: unknown;
  readonly text?: unknown;
  readonly thread_ts?: unknown;
  readonly ts?: unknown;
  readonly type?: unknown;
  readonly user?: unknown;
  readonly user_name?: unknown;
}

interface SlackMessage {
  readonly body: string;
  readonly eventId: string;
  readonly messageTs: string;
  readonly threadTs: string;
  readonly type: "app_mention" | "message";
  readonly userId: string;
  readonly userName: string;
}

const field = (value: object, key: string): unknown =>
  key in value ? Reflect.get(value, key) : undefined;

const parseEvent = (value: unknown): SlackEvent | null =>
  typeof value === "object" && value !== null ? value : null;

const validTimestamp = (value: string): boolean =>
  SLACK_TIMESTAMP.test(value) &&
  Number(value) > 0 &&
  !Number.isNaN(new Date(Number(value) * 1000).getTime());

export const parseSlackMessage = (
  payload: unknown,
  settings: { readonly channel: string; readonly workspace: string }
): SlackMessage | null => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const event = parseEvent(field(payload, "event"));
  if (event === null) {
    return null;
  }
  const eventIdValue = field(payload, "event_id");
  const teamValue = field(payload, "team_id") ?? field(payload, "workspace");
  const eventId = typeof eventIdValue === "string" ? eventIdValue.trim() : "";
  const messageTs = typeof event.ts === "string" ? event.ts.trim() : "";
  const userId = typeof event.user === "string" ? event.user.trim() : "";
  const body = typeof event.text === "string" ? event.text.trim() : "";
  const threadTs =
    typeof event.thread_ts === "string" ? event.thread_ts.trim() : messageTs;
  const type =
    event.type === "message" || event.type === "app_mention"
      ? event.type
      : null;
  const subtypeAllowed =
    event.subtype === undefined ||
    (typeof event.subtype === "string" &&
      HUMAN_MESSAGE_SUBTYPES.has(event.subtype));
  const validEnvelope = [
    Boolean(settings.workspace),
    teamValue === settings.workspace,
    event.channel === settings.channel,
    Boolean(eventId),
    Boolean(type),
    event.bot_id === undefined,
    subtypeAllowed,
    Boolean(userId),
    Boolean(body),
    event.thread_ts === undefined || typeof event.thread_ts === "string",
    validTimestamp(messageTs),
    validTimestamp(threadTs),
  ].every(Boolean);
  if (!(validEnvelope && type)) {
    return null;
  }
  return {
    body,
    eventId,
    messageTs,
    threadTs,
    type,
    userId,
    userName:
      typeof event.user_name === "string" && event.user_name.trim()
        ? event.user_name.trim()
        : userId,
  };
};
