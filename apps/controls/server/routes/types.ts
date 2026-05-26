import type { IncomingMessage, ServerResponse } from "node:http";
import type { ControlsSession } from "../auth/session";
import type { ControlsHttpDependencies } from "../http";

export interface AuthContext {
  sessionId: string;
  session: ControlsSession;
}

export interface ProtectedRouteContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  deps: ControlsHttpDependencies;
  auth: AuthContext;
  guildId: string;
}
