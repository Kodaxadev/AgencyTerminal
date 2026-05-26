import { createServer, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { registerCommands } from "../../../packages/discord-ui/src/slash-commands";
import { handleApiRequest } from "./http";
import { MemorySessionStore } from "./auth/session";
import { createControlsRepository } from "./repository";

const port = Number(process.env.CONTROLS_PORT ?? 3002);
const staticDir = process.env.CONTROLS_STATIC_DIR ?? resolve(process.cwd(), "apps/controls/dist");

const sessions = new MemorySessionStore();
const repository = createControlsRepository();

const server = createServer((req, res) => {
  void handleRequest(req, res).catch((error: unknown) => {
    console.error(error);
    res.statusCode = 500;
    res.end("Internal server error");
  });
});

server.listen(port, () => {
  console.log(`Agency Terminal controls server listening on http://localhost:${port}`);
});

async function handleRequest(req: Parameters<typeof handleApiRequest>[0], res: ServerResponse): Promise<void> {
  const handled = await handleApiRequest(req, res, {
    env: process.env,
    repository,
    sessions,
    registerCommands,
  });
  if (!handled) await serveStatic(req.url ?? "/", res);
}

async function serveStatic(requestUrl: string, res: ServerResponse): Promise<void> {
  const url = new URL(requestUrl, "http://controls.local");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const requestedPath = resolve(staticDir, `.${decodeURIComponent(pathname)}`);

  if (!requestedPath.startsWith(resolve(staticDir))) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  const filePath = await resolveExistingFile(requestedPath);
  const body = await readFile(filePath);
  res.statusCode = 200;
  res.setHeader("content-type", contentType(filePath));
  res.end(body);
}

async function resolveExistingFile(requestedPath: string): Promise<string> {
  try {
    const info = await stat(requestedPath);
    return info.isDirectory() ? join(requestedPath, "index.html") : requestedPath;
  } catch {
    return join(staticDir, "index.html");
  }
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
