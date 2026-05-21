import {
  ChatInputCommandInteraction,
  Interaction,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import type { EvidenceRecord, ReviewRecord, MetricCategory } from "@agency-terminal/core";
import {
  evaluateQuorum,
  canValidateEvidence,
  calculateScoreCredits,
  getQuorumRequirement,
} from "@agency-terminal/core";
import {
  createEvidenceSubmissionEmbed,
  createEvidenceStatusEmbed,
  createAcceptedEmbed,
  createReviewResultEmbed,
  createScoreCreditEmbed,
  createReviewButtons,
} from "@agency-terminal/discord-ui";

// In-memory store for Phase 1. Replace with DB writes in Phase 2.
const evidenceStore = new Map<string, { record: EvidenceRecord; reviews: ReviewRecord[] }>();

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction);
  } else if (interaction.isButton()) {
    await handleButton(interaction);
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "submit") {
    await handleEvidenceSubmit(interaction);
  } else if (subcommand === "status") {
    await handleEvidenceStatus(interaction);
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
  const evidenceId = `EVD-${String(evidenceStore.size + 1).padStart(4, "0")}`;

  const record: EvidenceRecord = {
    id: evidenceId,
    guildId: interaction.guildId!,
    submittedByDiscordId: interaction.user.id,
    subjectDiscordId,
    metricCategory: metric,
    status: "under_review",
    sensitivity: "member",
    title,
    description,
    validationRequiredApprovals: getQuorumRequirement(metric),
    submittedMode: "live_bot",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  evidenceStore.set(evidenceId, { record, reviews: [] });

  const embed = createEvidenceSubmissionEmbed(record);
  const buttons = createReviewButtons(evidenceId);

  await interaction.editReply({
    content: `Evidence **${evidenceId}** submitted for review.`,
    embeds: [embed],
    components: buttons,
  });

  // Post review request to the channel for officers to see
  if (link) {
    await interaction.followUp({
      content: `Evidence link: ${link}`,
      ephemeral: false,
    });
  }
}

async function handleEvidenceStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const evidenceId = interaction.options.getString("id", true);
  const entry = evidenceStore.get(evidenceId);

  if (!entry) {
    await interaction.editReply(`Evidence ${evidenceId} not found.`);
    return;
  }

  const { record, reviews } = entry;
  const quorum = evaluateQuorum(reviews, record.metricCategory);
  const embed = createEvidenceStatusEmbed(record, quorum.approvals, quorum.required);

  await interaction.editReply({ embeds: [embed] });
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const [action, type, evidenceId] = interaction.customId.split(":");

  if (action !== "review") return;

  await interaction.deferReply({ ephemeral: true });

  const entry = evidenceStore.get(evidenceId);
  if (!entry) {
    await interaction.editReply("Evidence not found.");
    return;
  }

  const { record, reviews } = entry;

  // Check for duplicate review
  const existingReview = reviews.find((r) => r.reviewerDiscordId === interaction.user.id);
  if (existingReview) {
    await interaction.editReply("You have already reviewed this evidence.");
    return;
  }

  const decision =
    type === "approve"
      ? "approve"
      : type === "object"
        ? "object"
        : "needs_more_evidence";

  const review: ReviewRecord = {
    evidenceId,
    reviewerDiscordId: interaction.user.id,
    decision,
    rationale: `Review via ${type} button`,
    conflictDisclosed: false,
    createdAt: new Date(),
  };

  reviews.push(review);

  const resultEmbed = createReviewResultEmbed(review, evidenceId);
  await interaction.editReply({ embeds: [resultEmbed] });

  // Check if quorum reached → credit score
  const quorum = evaluateQuorum(reviews, record.metricCategory);
  if (quorum.reached) {
    record.status = "validated";
    record.validatedAt = new Date();

    const quorumEmbed = createEvidenceStatusEmbed(record, quorum.approvals, quorum.required);
    await interaction.followUp({
      content: `**Quorum reached for ${evidenceId}!** Processing score credit...`,
      embeds: [quorumEmbed],
      ephemeral: false,
    });

    // Calculate and post score credits
    const subjects = [
      {
        evidenceId,
        subjectDiscordId: record.subjectDiscordId,
        role: "primary" as const,
        pointMultiplier: 1.0,
      },
    ];

    // Use a default metric config for Phase 1
    const metricConfig = {
      category: record.metricCategory,
      basePoints: 10,
      visibility: "public" as const,
      enabled: true,
      version: 1,
    };

    const creditResult = calculateScoreCredits(
      subjects,
      metricConfig,
      evidenceId,
      record.guildId,
      "system",
      new Date(),
    );

    for (const event of creditResult.events) {
      const scoreEmbed = createScoreCreditEmbed(event);
      await interaction.followUp({
        content: `<@${event.agentDiscordId}>`,
        embeds: [scoreEmbed],
        ephemeral: false,
      });
    }

    record.status = "credited";
    record.creditedAt = new Date();
  }
}
