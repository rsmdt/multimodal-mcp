const API_KEY_PATTERNS: RegExp[] = [
  /sk-[a-zA-Z0-9_-]{10,}/g,
  /xai-[a-zA-Z0-9_-]{10,}/g,
  /AIzaSy[a-zA-Z0-9_-]{10,}/g,
  /key=[a-zA-Z0-9_-]{20,}/g,
  /xi-[a-zA-Z0-9_-]{10,}/g,
  /\b[a-f0-9]{32}\b/g,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
];

export function sanitizeError(error: unknown): string {
  let message: string;

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string" && error.length > 0) {
    message = error;
  } else {
    return "Unknown error";
  }

  for (const pattern of API_KEY_PATTERNS) {
    message = message.replace(pattern, "[REDACTED]");
  }

  message = message.replace(/\n\s+at .+/g, "");
  message = message.replace(/\/[^\s:]+\.[tj]s(:\d+)?(:\d+)?/g, "[internal]");

  return message.trim() || "Unknown error";
}
