import {
  ChannelType,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import type { EvidenceRecord } from "@agency-terminal/core";
import {
  createEvidenceSubmissionEmbed,
  createReviewButtons,
} from "@agency-terminal/discord-ui";

export async function postEvidenceReviewProjection(
  interaction: ChatInputCommandInteraction,
  record: EvidenceRecord,
  evidenceId: string,
): Promise<void> {
  const guild = interaction.guild ?? await interaction.client.guilds.fetch(interaction.guildId!);
  const channels = await guild.channels.fetch();
  const opsChannel = Array.from(channels.values()).find(
    (channel) => channel?.name === "ops-queue" && channel.type === ChannelType.GuildText,
  ) as TextChannel | undefined;

  if (!opsChannel) {
    throw new Error("Review routing failed: private ops-queue channel is missing.");
  }

  await opsChannel.send({
    content: `Evidence **${record.id}** submitted for review.`,
    embeds: [createEvidenceSubmissionEmbed(record)],
    components: createReviewButtons(evidenceId),
  });
}
