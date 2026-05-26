export const DISCORD_API_BASE = "https://discord.com/api";
export const DISCORD_OAUTH_SCOPES = ["identify", "guilds", "guilds.members.read"] as const;

export interface DiscordTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface DiscordUserResponse {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export interface DiscordGuildMemberResponse {
  user?: DiscordUserResponse;
  roles: string[];
}

interface JsonFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export function buildDiscordAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): URL {
  const url = new URL(`${DISCORD_API_BASE}/oauth2/authorize`);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DISCORD_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  return url;
}

export async function exchangeDiscordCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<DiscordTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
  });

  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  }) as JsonFetchResponse;
  if (!response.ok) throw new Error(`Discord token exchange failed: ${response.status}`);

  const payload = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token || !payload.refresh_token || !payload.expires_in) {
    throw new Error("Discord token response missing required fields");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresInSeconds: payload.expires_in,
  };
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUserResponse> {
  return fetchDiscordResource("/users/@me", accessToken);
}

export async function fetchDiscordGuildMember(
  accessToken: string,
  guildId: string,
): Promise<DiscordGuildMemberResponse> {
  return fetchDiscordResource(`/users/@me/guilds/${guildId}/member`, accessToken);
}

async function fetchDiscordResource<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  }) as JsonFetchResponse;
  if (!response.ok) throw new Error(`Discord API request failed: ${response.status}`);
  return await response.json() as T;
}
