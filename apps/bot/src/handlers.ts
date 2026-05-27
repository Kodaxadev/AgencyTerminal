import {
  ActionRowBuilder,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { GuildMember } from "discord.js";
import type { MetricCategory, ReviewRecord } from "@agency-terminal/core";
import {
  createAcceptedEmbed,
  createReviewResultEmbed,
  createStaleEmbed,
} from "@agency-terminal/discord-ui";
import {
  addReview,
  createTicket,
  directorOverrideEvidence,
  getCapabilitiesForRoles,
  getEvidenceStatusForParticipant,
  submitEvidence,
} from "@agency-terminal/db";
import type { Capability, EvidenceStatusResult, TicketType } from "@agency-terminal/db";
import {
  canHandleOverride,
  canHandleReview,
  getDbUnavailableReply,
  getEvidenceLinkReply,
  getQuorumReachedReply,
} from "./safety";

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction);
  } else if (interaction.isButton()) {
    await handleButton(interaction);
  } else if (interaction.isModalSubmit()) {
    await handleModalSubmit(interaction);
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const commandName = interaction.commandName;
  const subcommand = interaction.options.getSubcommand();

  if (commandName === "evidence") {
    if (subcommand === "submit") await handleEvidenceSubmit(interaction);
    if (subcommand === "status") await handleEvidenceStatus(interaction);
  } else if (commandName === "ticket") {
    await handleTicketCommand(interaction);
  } else if (commandName === "director" && subcommand === "override") {
    await handleDirectorOverride(interaction);
  }
}

async function handleTicketCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;
  const config = getTicketConfig(interaction, subcommand);
  if (!config) {
    await interaction.editReply(`Unknown ticket type: ${subcommand}`);
    return;
  }
  const requiredCapability = getTicketCapability(subcommand);
  if (requiredCapability && !await userHasCapability(interaction, requiredCapability)) {
    await interaction.editReply(`You are not authorized to create ${subcommand} tickets.`);
    return;
  }

  try {
    const result = await createTicket({
      guildId,
      channelId: `pending:${interaction.id}`,
      creatorDiscordId: interaction.user.id,
      type: toTicketType(subcommand),
      title: config.title,
      summary: config.summary,
      ...config.extra,
    }, `ticket:create:${guildId}:${interaction.id}`);

    const embed = createAcceptedEmbed(
      `Ticket **${result.shortId ?? result.id}** created.\nType: ${subcommand}\nTitle: ${config.title}`,
    );
    await interaction.editReply({ embeds: [embed] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (isDbError(message)) {
      await interaction.editReply(getDbUnavailableReply("ticket"));
      return;
    }
    throw err;
  }
}

async function handleEvidenceSubmit(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const metric = interaction.options.getString("metric", true) as MetricCategory;
  const title = interaction.options.getString("title", true);
  const description = interaction.options.getString("description") ?? "";
  const subjectUser = interaction.options.getUser("subject");
  const link = interaction.options.getString("link");
  const subjectDiscordId = subjectUser?.id ?? interaction.user.id;
  const guildId = interaction.guildId!;

  try {
    const result = await submitEvidence({
      guildId,
      submittedByDiscordId: interaction.user.id,
      subjectDiscordId,
      metricCategory: metric,
      title,
      description,
      linkUrl: link ?? undefined,
      linkSourceType: link ? "manual" : undefined,
    }, `evidence:submit:${guildId}:${interaction.id}`);

    await interaction.editReply({
      content: `Evidence **${result.shortId ?? result.id}** recorded and queued for private review.`,
    });

    if (link) await interaction.followUp(getEvidenceLinkReply(link));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (isDbError(message)) {
      await interaction.editReply(getDbUnavailableReply("evidence"));
      return;
    }
    throw err;
  }
}

function isDbError(message: string): boolean {
  return message.includes("DATABASE_URL") ||
    message.includes("connect") ||
    message.includes("ECONNREFUSED") ||
    message.includes("connection") ||
    message.includes("socket");
}

const EVIDENCE_STATUS_NEUTRAL_REPLY = "Evidence not found or not available to you.";

async function handleEvidenceStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const lookup = interaction.options.getString("id", true);
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply(EVIDENCE_STATUS_NEUTRAL_REPLY);
    return;
  }

  try {
    const status = await getEvidenceStatusForParticipant({
      guildId,
      evidenceIdOrShortId: lookup,
      requestingDiscordId: interaction.user.id,
    });
    if (!status) {
      await interaction.editReply(EVIDENCE_STATUS_NEUTRAL_REPLY);
      return;
    }
    await interaction.editReply(formatEvidenceStatusReply(status));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (isDbError(message)) {
      await interaction.editReply(getDbUnavailableReply("evidence"));
      return;
    }
    throw err;
  }
}

function formatEvidenceStatusReply(status: EvidenceStatusResult): string {
  const visibleId = status.shortId ?? status.id;
  const lines = [
    `Evidence **${visibleId}**`,
    `Status: ${status.status}`,
    `Metric: ${status.metricCategory}`,
    `Approvals: ${status.eligibleApprovals} / ${status.validationRequiredApprovals}`,
    `Submitted: ${status.createdAt.toISOString()}`,
  ];
  if (status.validatedAt) lines.push(`Validated: ${status.validatedAt.toISOString()}`);
  return lines.join("\n");
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const [action, type, evidenceId] = interaction.customId.split(":");
  if (action !== "review") return;

  if (!type || !evidenceId) {
    await interaction.reply({ content: "Invalid review button.", ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`review_modal:${type}:${evidenceId}`)
    .setTitle(`Review: ${type === "approve" ? "Approve" : type === "object" ? "Object" : "Needs More"}`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("conflict")
          .setLabel("Conflict of interest? Type No if none.")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(200),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("rationale")
          .setLabel("Review rationale / reasoning")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000),
      ),
    );

  await interaction.showModal(modal);
}

async function handleDirectorOverride(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const evidenceId = interaction.options.getString("evidence_id", true);
  const reason = interaction.options.getString("reason", true);
  const guildId = interaction.guildId!;
  const directorDiscordId = interaction.user.id;

  try {
    if (!await userCanOverride(interaction)) {
      await interaction.editReply("You are not authorized to override evidence quorum.");
      return;
    }

    await directorOverrideEvidence(evidenceId, directorDiscordId, reason, guildId);

    const staleEmbed = createStaleEmbed(
      `Evidence **${evidenceId}** has been force-validated by <@${directorDiscordId}>.\nReason: ${reason}`,
    );
    await interaction.editReply({
      content: `Director override applied. Evidence **${evidenceId}** is now validated.`,
      embeds: [staleEmbed],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (isDbError(message)) {
      await interaction.editReply(getDbUnavailableReply("override"));
      return;
    }
    await interaction.editReply(`Override failed: ${message}`);
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId.startsWith("review_modal:")) await handleReviewModal(interaction);
}

async function handleReviewModal(interaction: ModalSubmitInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  if (!await userCanReview(interaction)) {
    await interaction.editReply("You are not authorized to review evidence.");
    return;
  }

  const [, decision, evidenceId] = interaction.customId.split(":");
  const conflictAnswer = interaction.fields.getTextInputValue("conflict");
  const rationale = interaction.fields.getTextInputValue("rationale");
  const hasConflict = conflictAnswer.trim().toLowerCase() !== "no" && conflictAnswer.trim().length > 0;
  const mappedDecision = mapReviewDecision(decision);

  try {
    const reviewResult = await addReview({
      evidenceId,
      reviewerDiscordId: interaction.user.id,
      decision: mappedDecision,
      rationale,
      guildId: interaction.guildId!,
      conflictDisclosed: hasConflict,
      conflictReason: hasConflict ? conflictAnswer.trim() : undefined,
    }, `review:${evidenceId}:${interaction.user.id}`);

    const review: ReviewRecord = {
      evidenceId,
      reviewerDiscordId: interaction.user.id,
      decision: mappedDecision,
      rationale,
      conflictDisclosed: hasConflict,
      conflictReason: hasConflict ? conflictAnswer.trim() : undefined,
      createdAt: new Date(),
    };

    await interaction.editReply({ embeds: [createReviewResultEmbed(review, evidenceId)] });
    if (reviewResult.quorumReached) {
      await interaction.followUp({
        content: getQuorumReachedReply(evidenceId),
        ephemeral: false,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (isDbError(message)) {
      await interaction.editReply(getDbUnavailableReply("review"));
      return;
    }
    if (isReviewRejection(message)) {
      await interaction.editReply(message);
      return;
    }
    throw err;
  }
}

function isReviewRejection(message: string): boolean {
  return message.includes("cannot approve evidence");
}

async function userCanReview(
  interaction: ButtonInteraction | ModalSubmitInteraction,
): Promise<boolean> {
  if (!interaction.guildId) return false;
  const capabilities = await getCapabilitiesForRoles(interaction.guildId, getMemberRoleIds(interaction.member));
  return canHandleReview(capabilities);
}

async function userCanOverride(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (!interaction.guildId) return false;
  const capabilities = await getCapabilitiesForRoles(interaction.guildId, getMemberRoleIds(interaction.member));
  return canHandleOverride(capabilities);
}

async function userHasCapability(
  interaction: ChatInputCommandInteraction,
  capability: Capability,
): Promise<boolean> {
  if (!interaction.guildId) return false;
  const capabilities = await getCapabilitiesForRoles(interaction.guildId, getMemberRoleIds(interaction.member));
  return capabilities.includes(capability);
}

function getMemberRoleIds(member: ButtonInteraction["member"]): string[] {
  const roles = (member as GuildMember | null)?.roles;
  if (!roles) return [];
  if (Array.isArray(roles)) return roles;
  return Array.from(roles.cache.keys());
}

function mapReviewDecision(decision: string | undefined): "approve" | "object" | "needs_more_evidence" {
  if (decision === "approve" || decision === "object") return decision;
  return "needs_more_evidence";
}


function getTicketConfig(
  interaction: ChatInputCommandInteraction,
  subcommand: string,
): { title: string; summary?: string; extra?: Record<string, string> } | null {
  const typeMap: Record<string, { title: string; summary?: string; extra?: Record<string, string> }> = {
    enlistment: { title: "Enlistment Request" },
    contract: {
      title: interaction.options.getString("title") ?? "Contract",
      summary: interaction.options.getString("target") ? `Target: ${interaction.options.getString("target")}` : undefined,
    },
    intel: { title: interaction.options.getString("title") ?? "Intel Report" },
    clearance: { title: `Clearance Request: ${interaction.options.getString("level") ?? "unknown"}` },
    doctrine: { title: interaction.options.getString("title") ?? "Doctrine Challenge" },
    general: { title: interaction.options.getString("title") ?? "General Ticket" },
  };

  return typeMap[subcommand] ?? null;
}

function toTicketType(subcommand: string): TicketType {
  if (subcommand === "doctrine") return "doctrine_challenge";
  if (
    subcommand === "enlistment" ||
    subcommand === "contract" ||
    subcommand === "intel" ||
    subcommand === "clearance" ||
    subcommand === "general"
  ) {
    return subcommand;
  }
  throw new Error(`Unsupported ticket type: ${subcommand}`);
}

function getTicketCapability(subcommand: string): Capability | null {
  const capabilityMap: Record<string, Capability> = {
    enlistment: "can_manage_enlistment",
    contract: "can_manage_contracts",
    intel: "can_manage_intel",
    clearance: "can_manage_clearance",
  };
  return capabilityMap[subcommand] ?? null;
}
