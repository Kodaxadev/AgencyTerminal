import type { IncomingMessage, ServerResponse } from "node:http";
import { registerCommands } from "../packages/discord-ui/src/slash-commands";
import { handleApiRequest } from "../apps/controls/server/http";
import { PostgresSessionStore } from "../apps/controls/server/auth/postgres-session";
import { createControlsRepository } from "../apps/controls/server/repository";
import { rewriteVercelApiUrl } from "../apps/controls/server/vercel-url";

const repository = createControlsRepository();
const sessions = new PostgresSessionStore();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  req.url = rewriteVercelApiUrl(req.url ?? "/api/index");
  const handled = await handleApiRequest(req, res, {
    env: process.env,
    repository,
    sessions,
    registerCommands,
  });

  if (!handled && !res.headersSent) {
    res.statusCode = 404;
    res.end("Not found");
  }
}
