import { HttpError, writeJson } from "../http-utils";
import { getQueueScope } from "../queue-scope";
import type { ProtectedRouteContext } from "./types";

export async function handleQueueRoute(context: ProtectedRouteContext): Promise<void> {
  if (context.req.method !== "GET") {
    writeJson(context.res, 405, { error: "Method not allowed" });
    return;
  }

  const scope = requireQueueScope(context);
  if (scope.kind === "intel_evidence") {
    writeJson(context.res, 200, await context.deps.repository.listIntelEvidence(
      context.guildId,
      context.auth.session.capabilities,
    ));
    return;
  }
  if (scope.kind === "contract_tickets") {
    writeJson(context.res, 200, await context.deps.repository.listContractTickets(
      context.guildId,
      context.auth.session.capabilities,
    ));
    return;
  }
  writeJson(context.res, 200, await context.deps.repository.listClearanceTickets(
    context.guildId,
    context.auth.session.capabilities,
  ));
}

function requireQueueScope(context: ProtectedRouteContext) {
  try {
    return getQueueScope(context.url.pathname, context.auth.session.capabilities);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing required capability")) {
      throw new HttpError(403, "Missing required controls capability");
    }
    throw error;
  }
}
