import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { buildDiscordAuthorizeUrl, exchangeDiscordCode, fetchDiscordGuildMember, fetchDiscordUser } from "./auth/oauth";
import { canAccessPath, resolveCapabilities } from "./auth/access";
import { getBootstrapIdsForGuild, parseControlsGuilds, resolveControlsGuild } from "./auth/guilds";
import { shouldRefreshSessionAuthorization } from "./auth/session-refresh";
import { handleDatabaseDiagnostics } from "./diagnostics";
import { logApiError } from "./error-logging";
import {
  createExpiredSessionCookie,
  createSessionCookie,
  readSessionIdFromCookie,
  type ControlsSession,
  type SessionStore,
} from "./auth/session";
import { getDeploymentStatus, registerGuildCommandsAction } from "./deployment";
import type { ControlsRepository } from "./repository";
import type { Capability } from "../src/contracts";
import {
  HttpError,
  STATE_COOKIE,
  controlsEnabled,
  createExpiredStateCookie,
  createStateCookie,
  errorMessage,
  errorStatus,
  readCookieValue,
  readJsonObject,
  redirect,
  requireBoolean,
  requireCapability,
  requireConfirmation,
  requireNumber,
  requireOAuthEnv,
  requireSessionSecret,
  requireString,
  secureCookie,
  toConfigInput,
  writeJson,
} from "./http-utils";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export interface ControlsHttpDependencies {
  env: NodeJS.ProcessEnv;
  repository: ControlsRepository;
  sessions: SessionStore;
  registerCommands: (clientId: string, guildId: string, token: string) => Promise<void>;
}

interface AuthContext {
  sessionId: string;
  session: ControlsSession;
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ControlsHttpDependencies,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://controls.local");
  if (!url.pathname.startsWith("/api/")) return false;

  try {
    if (url.pathname === "/api/auth/status" && req.method === "GET") {
      await handleAuthStatus(req, res, deps);
      return true;
    }
    if (!controlsEnabled(deps.env)) {
      writeJson(res, 503, { error: "Controls page disabled" });
      return true;
    }
    if (url.pathname === "/api/diagnostics/database") {
      await handleDatabaseDiagnostics(req, res, url, deps.env);
      return true;
    }
    if (url.pathname === "/api/auth/discord/start" && req.method === "GET") {
      handleDiscordStart(res, deps);
      return true;
    }
    if (url.pathname === "/api/auth/discord/callback" && req.method === "GET") {
      await handleDiscordCallback(req, res, url, deps);
      return true;
    }
    if (url.pathname === "/api/auth/logout" && req.method === "POST") {
      handleLogout(req, res, deps);
      return true;
    }

    const auth = await authenticate(req, deps);
    await routeProtectedApi(req, res, url, deps, auth);
    return true;
  } catch (error) {
    logApiError(req, url, error);
    writeJson(res, errorStatus(error), { error: errorMessage(error) });
    return true;
  }
}

async function routeProtectedApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: ControlsHttpDependencies,
  auth: AuthContext,
): Promise<void> {
  const guildId = auth.session.guildId;
  if (req.method === "GET" && url.pathname === "/api/overview") {
    requirePage("/", auth.session.capabilities);
    writeJson(res, 200, await deps.repository.getOverview(guildId, deps.env));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/health") {
    requirePage("/health", auth.session.capabilities);
    writeJson(res, 200, await deps.repository.listHealth(guildId, deps.env));
    return;
  }
  if (url.pathname === "/api/config") {
    await handleConfig(req, res, deps, auth, guildId);
    return;
  }
  if (url.pathname === "/api/roles" || url.pathname.startsWith("/api/roles/")) {
    await handleRoles(req, res, url, deps, auth, guildId);
    return;
  }
  if (url.pathname === "/api/metrics") {
    await handleMetrics(req, res, deps, auth, guildId);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/evidence") {
    requirePage("/evidence", auth.session.capabilities);
    writeJson(res, 200, await deps.repository.listEvidenceQueue(guildId));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/tickets") {
    requirePage("/tickets", auth.session.capabilities);
    writeJson(res, 200, await deps.repository.listTickets(guildId));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/audit") {
    requirePage("/audit", auth.session.capabilities);
    writeJson(res, 200, await deps.repository.listAudit(guildId));
    return;
  }
  if (url.pathname === "/api/deployment" || url.pathname === "/api/deployment/register-commands") {
    await handleDeployment(req, res, deps, auth, guildId, url.pathname);
    return;
  }
  writeJson(res, 404, { error: "Not found" });
}

async function handleAuthStatus(
  req: IncomingMessage,
  res: ServerResponse,
  deps: ControlsHttpDependencies,
): Promise<void> {
  try {
    const auth = await authenticate(req, deps);
    writeJson(res, 200, {
      authenticated: true,
      controlsEnabled: controlsEnabled(deps.env),
      user: auth.session.user,
      guildId: auth.session.guildId,
      capabilities: auth.session.capabilities,
    });
  } catch {
    writeJson(res, 200, {
      authenticated: false,
      controlsEnabled: controlsEnabled(deps.env),
      capabilities: [],
    });
  }
}

function handleDiscordStart(res: ServerResponse, deps: ControlsHttpDependencies): void {
  const authEnv = requireOAuthEnv(deps.env);
  const state = randomBytes(16).toString("base64url");
  const url = buildDiscordAuthorizeUrl({
    clientId: authEnv.clientId,
    redirectUri: authEnv.redirectUri,
    state,
  });
  redirect(res, url.toString(), [createStateCookie(state, secureCookie(deps.env))]);
}

async function handleDiscordCallback(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps: ControlsHttpDependencies,
): Promise<void> {
  const authEnv = requireOAuthEnv(deps.env);
  const state = url.searchParams.get("state");
  if (!state || state !== readCookieValue(req.headers.cookie, STATE_COOKIE)) {
    throw new HttpError(400, "OAuth state validation failed");
  }
  const code = url.searchParams.get("code");
  if (!code) throw new HttpError(400, "Missing OAuth code");

  const token = await exchangeDiscordCode({
    clientId: authEnv.clientId,
    clientSecret: authEnv.clientSecret,
    code,
    redirectUri: authEnv.redirectUri,
  });
  const user = await fetchDiscordUser(token.accessToken);
  const resolvedGuild = await resolveControlsGuild({
    env: deps.env,
    user,
    fetchMember: (guildId) => fetchDiscordGuildMember(token.accessToken, guildId),
    listRoleMappings: (guildId) => deps.repository.listRoleCapabilityMappings(guildId),
  });
  if (!resolvedGuild) throw new HttpError(403, "No controls capability mapped for this Discord user");

  const capabilities = resolveCapabilities({
    discordUserId: user.id,
    discordRoleIds: resolvedGuild.member.roles,
    roleMappings: resolvedGuild.roleMappings,
    bootstrapDiscordIds: getBootstrapIdsForGuild(deps.env, resolvedGuild.config.key),
  });

  const now = Date.now();
  const session = await deps.sessions.create({
    user: { id: user.id, username: user.username, globalName: user.global_name ?? undefined },
    guildId: resolvedGuild.config.guildId,
    discordRoleIds: resolvedGuild.member.roles,
    capabilities,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    tokenExpiresAt: now + token.expiresInSeconds * 1000,
    validatedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SECONDS * 1000,
  });
  redirect(res, "/", [
    createExpiredStateCookie(),
    createSessionCookie({
      sessionId: session.id,
      secret: requireSessionSecret(deps.env),
      secure: secureCookie(deps.env),
      maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
    }),
  ]);
}

async function authenticate(req: IncomingMessage, deps: ControlsHttpDependencies): Promise<AuthContext> {
  const sessionId = readSessionIdFromCookie(req.headers.cookie, requireSessionSecret(deps.env));
  if (!sessionId) throw new HttpError(401, "Not authenticated");
  const session = await deps.sessions.get(sessionId);
  if (!session) throw new HttpError(401, "Session expired");

  const guildConfig = parseControlsGuilds(deps.env).find((config) => config.guildId === session.guildId);
  if (!guildConfig) throw new HttpError(403, "Session guild is no longer configured for controls access");
  const now = Date.now();
  if (!shouldRefreshSessionAuthorization(session, now)) return { sessionId, session };

  const member = await fetchMemberOrUseCachedSession(session);
  if (!member) return { sessionId, session };
  const mappings = await deps.repository.listRoleCapabilityMappings(session.guildId);
  const capabilities = resolveCapabilities({
    discordUserId: session.user.id,
    discordRoleIds: member.roles,
    roleMappings: mappings,
    bootstrapDiscordIds: getBootstrapIdsForGuild(deps.env, guildConfig.key),
  });
  if (capabilities.length === 0) throw new HttpError(403, "No controls capability mapped for this Discord user");

  const updated = await deps.sessions.update(sessionId, { discordRoleIds: member.roles, capabilities, validatedAt: now });
  if (!updated) throw new HttpError(401, "Session expired");
  return { sessionId, session: updated };
}

async function fetchMemberOrUseCachedSession(
  session: ControlsSession,
): Promise<{ roles: string[] } | null> {
  try {
    return await fetchDiscordGuildMember(session.accessToken, session.guildId);
  } catch (error) {
    if (session.capabilities.length > 0 && isDiscordRateLimitError(error)) return null;
    throw error;
  }
}

function isDiscordRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Discord API request failed: 429");
}

async function handleConfig(req: IncomingMessage, res: ServerResponse, deps: ControlsHttpDependencies, auth: AuthContext, guildId: string): Promise<void> {
  requirePage("/config", auth.session.capabilities);
  if (req.method === "GET") {
    writeJson(res, 200, await deps.repository.getGuildConfig(guildId));
    return;
  }
  if (req.method !== "PATCH") return writeJson(res, 405, { error: "Method not allowed" });
  const body = await readJsonObject(req);
  const current = await deps.repository.getGuildConfig(guildId);
  const saved = await deps.repository.saveGuildConfig(toConfigInput(body, current, guildId), auth.session.user.id);
  writeJson(res, 200, saved);
}

async function handleRoles(req: IncomingMessage, res: ServerResponse, url: URL, deps: ControlsHttpDependencies, auth: AuthContext, guildId: string): Promise<void> {
  requirePage("/roles", auth.session.capabilities);
  if (req.method === "GET") return writeJson(res, 200, await deps.repository.listRoleMappings(guildId));
  if (req.method === "POST" && url.pathname === "/api/roles") {
    const body = await readJsonObject(req);
    requireConfirmation(body, "SAVE");
    const mapping = await deps.repository.createRoleMapping({
      guildId,
      discordRoleId: requireString(body.discordRoleId, "discordRoleId"),
      capability: requireCapability(body.capability),
    }, auth.session.user.id);
    return writeJson(res, 201, mapping);
  }
  if (req.method === "DELETE" && url.pathname.startsWith("/api/roles/")) {
    await deps.repository.deleteRoleMapping(guildId, decodeURIComponent(url.pathname.slice("/api/roles/".length)), auth.session.user.id);
    return writeJson(res, 204, {});
  }
  writeJson(res, 405, { error: "Method not allowed" });
}

async function handleMetrics(req: IncomingMessage, res: ServerResponse, deps: ControlsHttpDependencies, auth: AuthContext, guildId: string): Promise<void> {
  requirePage("/metrics", auth.session.capabilities);
  if (req.method === "GET") return writeJson(res, 200, await deps.repository.listMetrics(guildId));
  if (req.method !== "POST") return writeJson(res, 405, { error: "Method not allowed" });
  const body = await readJsonObject(req);
  requireConfirmation(body, "VERSION");
  const metric = await deps.repository.createMetricVersion({
    guildId,
    category: requireString(body.category, "category"),
    basePoints: requireNumber(body.basePoints, "basePoints"),
    visibility: requireString(body.visibility, "visibility"),
    enabled: requireBoolean(body.enabled, "enabled"),
  }, auth.session.user.id);
  writeJson(res, 201, metric);
}

async function handleDeployment(req: IncomingMessage, res: ServerResponse, deps: ControlsHttpDependencies, auth: AuthContext, guildId: string, pathname: string): Promise<void> {
  requirePage("/deployment", auth.session.capabilities);
  if (req.method === "GET" && pathname === "/api/deployment") {
    writeJson(res, 200, getDeploymentStatus(deps.env));
    return;
  }
  if (req.method === "POST" && pathname === "/api/deployment/register-commands") {
    const body = await readJsonObject(req);
    await registerGuildCommandsAction({
      confirmation: requireString(body.confirmation, "confirmation"),
      env: deps.env,
      guildId,
      registerCommands: deps.registerCommands,
    });
    await deps.repository.writeAudit({
      guildId,
      actorDiscordId: auth.session.user.id,
      action: "controls_discord_commands_registered",
      subjectType: "discord_guild",
      subjectId: guildId,
    });
    return writeJson(res, 200, { registered: true });
  }
  writeJson(res, 405, { error: "Method not allowed" });
}

function requirePage(pathname: string, capabilities: Capability[]): void {
  if (!canAccessPath(pathname, capabilities)) throw new HttpError(403, "Missing required controls capability");
}

function handleLogout(req: IncomingMessage, res: ServerResponse, deps: ControlsHttpDependencies): void {
  const sessionId = readSessionIdFromCookie(req.headers.cookie, requireSessionSecret(deps.env));
  if (sessionId) void deps.sessions.delete(sessionId);
  writeJson(res, 200, { authenticated: false }, [createExpiredSessionCookie()]);
}
