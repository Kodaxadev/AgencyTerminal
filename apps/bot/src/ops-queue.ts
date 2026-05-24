import {
  ChannelType,
  Client,
  PermissionsBitField,
  TextChannel,
} from "discord.js";
import { getRoleIdsForCapabilities } from "@agency-terminal/db";
import type { Capability } from "@agency-terminal/db";
import { buildDenyEveryoneOverwrite } from "./safety";

const OPS_QUEUE_NAME = "ops-queue";
const OPS_QUEUE_CAPABILITIES: Capability[] = ["can_validate_evidence", "can_override_quorum"];
const OPS_QUEUE_PERMISSION_FLAGS = [
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.ReadMessageHistory,
];
type OpsQueueDiagnosticEvent =
  | "ops_queue_created"
  | "ops_queue_permission_repaired"
  | "configured_ops_queue_rejected"
  | "ops_queue_setup_failed";

function allowOpsActor(id: string) {
  return {
    allow: new PermissionsBitField(OPS_QUEUE_PERMISSION_FLAGS),
    id,
  };
}

export async function resolveOpsQueueChannel(
  client: Client,
  guildId: string,
): Promise<TextChannel> {
  const guild = await client.guilds.fetch(guildId);
  const botUserId = client.user?.id;
  if (!botUserId) {
    throw new Error("Discord client user unavailable for ops queue setup");
  }
  const mappedRoleIds = await getRoleIdsForCapabilities(guildId, OPS_QUEUE_CAPABILITIES);
  const configured = process.env.AGENCY_OPS_QUEUE_CHANNEL_ID;
  const setupAllowed = canSelfSetupOpsQueue();

  if (configured) {
    const configuredChannel = await guild.channels.fetch(configured).catch(() => null);
    const rejection = getConfiguredChannelRejection(configuredChannel);
    if (!rejection && configuredChannel?.type === ChannelType.GuildText) {
      if (hasRequiredOpsQueueAccess(configuredChannel, botUserId, mappedRoleIds)) {
        return configuredChannel;
      }
      if (!setupAllowed) {
        logOpsQueueDiagnostic("configured_ops_queue_rejected", guildId, configured, "missing_required_access");
        throw new Error("Configured ops queue is private but missing required bot or mapped-role access");
      }
      if (await tryRepairOpsQueueAccess(configuredChannel, guildId, botUserId, mappedRoleIds)) {
        return configuredChannel;
      }
      logOpsQueueDiagnostic("configured_ops_queue_rejected", guildId, configured, "access_repair_failed");
    } else {
      logOpsQueueDiagnostic("configured_ops_queue_rejected", guildId, configured, rejection ?? "channel_not_found");
    }
  } else {
    logOpsQueueDiagnostic("configured_ops_queue_rejected", guildId, undefined, "missing_channel_id");
  }

  if (!setupAllowed) {
    throw new Error("AGENCY_OPS_QUEUE_CHANNEL_ID must reference a private usable ops queue unless development setup is explicitly enabled");
  }

  const channels = await guild.channels.fetch();
  const existing = Array.from(channels.values()).find(
    (channel) => channel?.name === OPS_QUEUE_NAME &&
      channel.type === ChannelType.GuildText &&
      isPrivateToEveryone(channel),
  );
  if (existing?.type === ChannelType.GuildText) {
    const prepared = hasRequiredOpsQueueAccess(existing, botUserId, mappedRoleIds) ||
      await tryRepairOpsQueueAccess(existing, guildId, botUserId, mappedRoleIds);
    if (prepared) return existing;
  }

  try {
    const created = await guild.channels.create({
      name: OPS_QUEUE_NAME,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        buildDenyEveryoneOverwrite(guild.roles.everyone.id),
        allowOpsActor(botUserId),
        ...mappedRoleIds.map(allowOpsActor),
      ],
      reason: "Agency Terminal private operator review queue setup",
    });
    logOpsQueueDiagnostic("ops_queue_created", guildId, created.id, "development_setup_enabled");
    return created;
  } catch (err) {
    logOpsQueueDiagnostic("ops_queue_setup_failed", guildId, undefined, getErrorMessage(err));
    throw err;
  }
}

export function isPrivateToEveryone(channel: TextChannel): boolean {
  const everyoneId = channel.guild.roles.everyone.id;
  const everyoneOverwrite = channel.permissionOverwrites.resolve(everyoneId);
  return Boolean(everyoneOverwrite?.deny?.has(PermissionsBitField.Flags.ViewChannel));
}

function canSelfSetupOpsQueue(): boolean {
  return process.env.NODE_ENV !== "production" &&
    process.env.AGENCY_ALLOW_OPS_QUEUE_SETUP === "true";
}

function getConfiguredChannelRejection(channel: unknown): string | null {
  if (!channel) return "channel_not_found";
  if (!isGuildTextChannel(channel)) return "wrong_channel_type";
  if (!isPrivateToEveryone(channel)) return "public_channel";
  return null;
}

function isGuildTextChannel(channel: unknown): channel is TextChannel {
  return typeof channel === "object" &&
    channel !== null &&
    "type" in channel &&
    channel.type === ChannelType.GuildText;
}

async function tryRepairOpsQueueAccess(
  channel: TextChannel,
  guildId: string,
  botUserId: string,
  mappedRoleIds: string[],
): Promise<boolean> {
  try {
    await ensureOpsQueueAccess(channel, guildId, botUserId, mappedRoleIds);
    return true;
  } catch (err) {
    logOpsQueueDiagnostic("ops_queue_setup_failed", guildId, channel.id, getErrorMessage(err));
    return false;
  }
}

async function ensureOpsQueueAccess(
  channel: TextChannel,
  guildId: string,
  botUserId: string,
  mappedRoleIds: string[],
): Promise<void> {
  for (const actorId of [botUserId, ...mappedRoleIds]) {
    if (hasOpsQueueAccess(channel, actorId)) continue;
    await channel.permissionOverwrites.edit(actorId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    }, {
      reason: "Agency Terminal private operator review queue access repair",
    });
    logOpsQueueDiagnostic(
      "ops_queue_permission_repaired",
      guildId,
      channel.id,
      actorId === botUserId ? "bot_access_repaired" : "mapped_role_access_repaired",
      actorId === botUserId ? undefined : actorId,
    );
  }
}

function hasOpsQueueAccess(channel: TextChannel, actorId: string): boolean {
  return Boolean(channel.permissionsFor(actorId)?.has(OPS_QUEUE_PERMISSION_FLAGS));
}

function hasRequiredOpsQueueAccess(
  channel: TextChannel,
  botUserId: string,
  mappedRoleIds: string[],
): boolean {
  return [botUserId, ...mappedRoleIds].every((actorId) => hasOpsQueueAccess(channel, actorId));
}

function logOpsQueueDiagnostic(
  event: OpsQueueDiagnosticEvent,
  guildId: string,
  channelId: string | undefined,
  reason: string,
  affectedRoleId?: string,
): void {
  const payload: Record<string, string> = { level: "warn", event, guildId, reason };
  if (channelId) payload.channelId = channelId;
  if (affectedRoleId) payload.affectedRoleId = affectedRoleId;
  const line = JSON.stringify(payload);
  if (event === "ops_queue_created" || event === "ops_queue_permission_repaired") {
    console.info(line);
    return;
  }
  console.error(line);
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
