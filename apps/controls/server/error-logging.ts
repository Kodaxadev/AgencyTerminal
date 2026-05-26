import type { IncomingMessage } from "node:http";
import { HttpError } from "./http-utils";
import { toSafeErrorDetails } from "./diagnostics";

export function logApiError(req: IncomingMessage, url: URL, error: unknown): void {
  if (error instanceof HttpError && error.status < 500) return;

  const details = toSafeErrorDetails(error);
  const cause = error instanceof Error && error.cause ? toSafeErrorDetails(error.cause) : undefined;
  console.error(JSON.stringify({
    level: "error",
    event: "controls_api_error",
    method: req.method,
    path: url.pathname,
    status: error instanceof HttpError ? error.status : 500,
    error: details,
    cause,
  }));
}
