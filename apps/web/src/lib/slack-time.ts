const SLACK_TIMESTAMP = /^\d+\.\d{1,6}$/u;

const slackSeconds = (timestamp: string): number | null => {
  const seconds = Number(timestamp);
  if (
    !SLACK_TIMESTAMP.test(timestamp) ||
    Number.isNaN(new Date(seconds * 1000).getTime())
  ) {
    return null;
  }
  return seconds;
};

export const slackTimeIso = (timestamp: string): string => {
  const seconds = slackSeconds(timestamp);
  return seconds === null ? "" : new Date(seconds * 1000).toISOString();
};

export const formatSlackTime = (timestamp: string): string => {
  const seconds = slackSeconds(timestamp);
  return seconds === null
    ? timestamp
    : `${new Date(seconds * 1000).toISOString().slice(0, 19).replace("T", " ")} UTC`;
};
