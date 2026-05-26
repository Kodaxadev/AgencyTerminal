import type { RoleCapabilityMapping } from "../../src/contracts";
import { resolveCapabilities } from "./access";
import type { DiscordGuildMemberResponse, DiscordUserResponse } from "./oauth";
import type { MaybePromise } from "./session";

export interface ControlsGuildConfig {
  key: string;
  guildId: string;
}

export interface ResolvedControlsGuild {
  config: ControlsGuildConfig;
  member: DiscordGuildMemberResponse;
  roleMappings: RoleCapabilityMapping[];
}

export function parseControlsGuilds(env: NodeJS.ProcessEnv): ControlsGuildConfig[] {
  const configured = env.CONTROLS_GUILDS?.split(",").map((entry) => entry.trim()).filter(Boolean) ?? [];
  if (configured.length === 0) {
    return env.DISCORD_GUILD_ID ? [{ key: "agency", guildId: env.DISCORD_GUILD_ID }] : [];
  }

  return configured.map((entry) => {
    const [rawKey, rawGuildId] = entry.split(":", 2);
    const key = normalizeGuildKey(rawKey);
    const guildId = rawGuildId?.trim();
    if (!key || !guildId) throw new Error(`Invalid controls guild entry: ${entry}`);
    return { key, guildId };
  });
}

export function getBootstrapIdsForGuild(env: NodeJS.ProcessEnv, guildKey: string): string[] {
  const scopedKey = `CONTROLS_BOOTSTRAP_DISCORD_IDS_${envKeySuffix(guildKey)}`;
  const scoped = parseCsv(env[scopedKey]);
  if (scoped.length > 0) return scoped;
  return env.CONTROLS_GUILDS ? [] : parseCsv(env.CONTROLS_BOOTSTRAP_DISCORD_IDS);
}

export async function resolveControlsGuild(input: {
  env: NodeJS.ProcessEnv;
  user: DiscordUserResponse;
  fetchMember: (guildId: string) => MaybePromise<DiscordGuildMemberResponse>;
  listRoleMappings: (guildId: string) => MaybePromise<RoleCapabilityMapping[]>;
}): Promise<ResolvedControlsGuild | null> {
  for (const config of parseControlsGuilds(input.env)) {
    const member = await tryFetchMember(input.fetchMember, config.guildId);
    if (!member) continue;

    const roleMappings = await input.listRoleMappings(config.guildId);
    const capabilities = resolveCapabilities({
      discordUserId: input.user.id,
      discordRoleIds: member.roles,
      roleMappings,
      bootstrapDiscordIds: getBootstrapIdsForGuild(input.env, config.key),
    });
    if (capabilities.length > 0) return { config, member, roleMappings };
  }

  return null;
}

function normalizeGuildKey(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_") ?? "";
}

function envKeySuffix(value: string): string {
  return normalizeGuildKey(value).toUpperCase();
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

async function tryFetchMember(
  fetchMember: (guildId: string) => MaybePromise<DiscordGuildMemberResponse>,
  guildId: string,
): Promise<DiscordGuildMemberResponse | null> {
  try {
    return await fetchMember(guildId);
  } catch {
    return null;
  }
}
