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
  if (configured) {
    const configuredChannel = await guild.channels.fetch(configured).catch(() => null);
    if (configuredChannel?.type === ChannelType.GuildText && isPrivateToEveryone(configuredChannel)) {
      const preparedChannel = await tryPrepareOpsQueueChannel(configuredChannel, botUserId, mappedRoleIds);
      if (preparedChannel) return preparedChannel;
    }
  }

  const channels = await guild.channels.fetch();
  const existing = Array.from(channels.values()).find(
    (channel) => channel?.name === OPS_QUEUE_NAME &&
      channel.type === ChannelType.GuildText &&
      isPrivateToEveryone(channel),
  );
  if (existing?.type === ChannelType.GuildText) {
    const preparedChannel = await tryPrepareOpsQueueChannel(existing, botUserId, mappedRoleIds);
    if (preparedChannel) return preparedChannel;
  }

  return guild.channels.create({
    name: OPS_QUEUE_NAME,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      buildDenyEveryoneOverwrite(guild.roles.everyone.id),
      allowOpsActor(botUserId),
      ...mappedRoleIds.map(allowOpsActor),
    ],
    reason: "Agency Terminal private operator review queue setup",
  });
}

export function isPrivateToEveryone(channel: TextChannel): boolean {
  const everyoneId = channel.guild.roles.everyone.id;
  const everyoneOverwrite = channel.permissionOverwrites.resolve(everyoneId);
  return Boolean(everyoneOverwrite?.deny?.has(PermissionsBitField.Flags.ViewChannel));
}

async function tryPrepareOpsQueueChannel(
  channel: TextChannel,
  botUserId: string,
  mappedRoleIds: string[],
): Promise<TextChannel | null> {
  try {
    await ensureOpsQueueAccess(channel, botUserId, mappedRoleIds);
    return channel;
  } catch {
    return null;
  }
}

async function ensureOpsQueueAccess(
  channel: TextChannel,
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
  }
}

function hasOpsQueueAccess(channel: TextChannel, actorId: string): boolean {
  return Boolean(channel.permissionsFor(actorId)?.has(OPS_QUEUE_PERMISSION_FLAGS));
}
