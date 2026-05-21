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
  getQuorumRequirement,
} from "@agency-terminal/core";
import {
  createEvidenceSubmissionEmbed,
  createEvidenceStatusEmbed,
  createAcceptedEmbed,
  createReviewResultEmbed,
  createReviewButtons,
} from "@agency-terminal/discord-ui";
import { createTicket, submitEvidence, addReview, writeAuditLog } from "@agency-terminal/db";
import { processScoreCredits } from "./scoring";

// In-memory fallback for dev when DB is unavailable
const evidenceStore = new Map<string, { record: EvidenceRecord; reviews: ReviewRecord[] }>();
let dbAvailable = true;

export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction);
  } else if (interaction.isButton()) {
    await handleButton(interaction);
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const commandName = interaction.commandName;
  const subcommand = interaction.options.getSubcommand();

  if (commandName === "evidence") {
    if (subcommand === "submit") {
      await handleEvidenceSubmit(interaction);
    } else if (subcommand === "status") {
      await handleEvidenceStatus(interaction);
    }
  } else if (commandName === "ticket") {
    await handleTicketCommand(interaction);
  }
}

async function handleTicketCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;
  const creatorDiscordId = interaction.user.id;

  // Create a temporary channel-like ID for the ticket
  const channelId = `ticket-${subcommand}-${Date.now()}`;
  const idempotencyKey = `ticket:create:${guildId}:${interaction.id}`;

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

  const config = typeMap[subcommand];
  if (!config) {
    await interaction.editReply(`Unknown ticket type: ${subcommand}`);
    return;
  }

  try {
    const result = await createTicket({
      guildId,
      channelId,
      creatorDiscordId,
      type: subcommand === "doctrine" ? "doctrine_challenge" : subcommand as any,
      title: config.title,
      summary: config.summary,
      ...config.extra,
    }, idempotencyKey);

    const embed = createAcceptedEmbed(
      `Ticket **${result.shortId ?? result.id}** created.\nType: ${subcommand}\nTitle: ${config.title}`,
    );

    await interaction.editReply({ embeds: [embed] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // If DB is unavailable, fall back to a simulated response for dev
    if (message.includes("DATABASE_URL") || message.includes("connect") || message.includes("ECONNREFUSED")) {
      const simulatedId = `TKT-${String(evidenceStore.size + 1).padStart(4, "0")}`;
      const embed = createAcceptedEmbed(
        `[DEV MODE — DB unavailable]\nTicket **${simulatedId}** created (simulated).\nType: ${subcommand}\nTitle: ${config.title}`,
      );
      await interaction.editReply({ embeds: [embed] });
    } else {
      throw err;
    }
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
  const idempotencyKey = `evidence:submit:${guildId}:${interaction.id}`;

  if (dbAvailable) {
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
      }, idempotencyKey);

      const record: EvidenceRecord = {
        id: result.shortId ?? result.id,
        guildId,
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

      const embed = createEvidenceSubmissionEmbed(record);
      const buttons = createReviewButtons(result.id);

      await interaction.editReply({
        content: `Evidence **${result.shortId ?? result.id}** submitted for review.`,
        embeds: [embed],
        components: buttons,
      });

      if (link) {
        await interaction.followUp({ content: `Evidence link: ${link}`, ephemeral: false });
      }

      await writeAuditLog({
        guildId,
        actorDiscordId: interaction.user.id,
        action: "evidence_submitted",
        subjectType: "evidence",
        subjectId: result.id,
        payload: { metric, title },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (isDbError(message)) {
        dbAvailable = false;
        return handleEvidenceSubmitFallback(interaction, metric, title, description, subjectDiscordId, link);
      }
      throw err;
    }
  } else {
    return handleEvidenceSubmitFallback(interaction, metric, title, description, subjectDiscordId, link);
  }
}

function isDbError(message: string): boolean {
  return message.includes("DATABASE_URL") ||
    message.includes("connect") ||
    message.includes("ECONNREFUSED") ||
    message.includes("connection") ||
    message.includes("socket");
}

async function handleEvidenceSubmitFallback(
  interaction: ChatInputCommandInteraction,
  metric: MetricCategory,
  title: string,
  description: string,
  subjectDiscordId: string,
  link: string | null,
): Promise<void> {
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
    content: `[DEV MODE] Evidence **${evidenceId}** submitted for review.`,
    embeds: [embed],
    components: buttons,
  });
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

  const decision =
    type === "approve"
      ? "approve"
      : type === "object"
        ? "object"
        : "needs_more_evidence";

  if (dbAvailable) {
    try {
      const guildId = interaction.guildId!;
      const idempotencyKey = `review:${evidenceId}:${interaction.user.id}`;

      const reviewResult = await addReview({
        evidenceId,
        reviewerDiscordId: interaction.user.id,
        decision,
        rationale: `Review via ${type} button`,
        guildId,
      }, idempotencyKey);

      const review: ReviewRecord = {
        evidenceId,
        reviewerDiscordId: interaction.user.id,
        decision,
        rationale: `Review via ${type} button`,
        conflictDisclosed: false,
        createdAt: new Date(),
      };

      const resultEmbed = createReviewResultEmbed(review, evidenceId);
      await interaction.editReply({ embeds: [resultEmbed] });

      if (reviewResult.quorumReached) {
        // For DB path, we need to fetch the evidence record to get agent info.
        // Phase 2.2 uses a simplified flow — full evidence lookup in Phase 3.
        await interaction.followUp({
          content: `**Quorum reached for ${evidenceId}!** Score credit pending full evidence lookup.`,
          ephemeral: false,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (isDbError(message)) {
        dbAvailable = false;
        return handleButtonFallback(interaction, evidenceId, type as string, decision);
      }
      throw err;
    }
  } else {
    return handleButtonFallback(interaction, evidenceId, type as string, decision);
  }
}

async function handleButtonFallback(
  interaction: ButtonInteraction,
  evidenceId: string,
  type: string,
  decision: "approve" | "object" | "needs_more_evidence",
): Promise<void> {
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

    await processScoreCredits(
      interaction,
      evidenceId,
      record.guildId,
      record.subjectDiscordId,
      record.metricCategory,
    );

    record.status = "credited";
    record.creditedAt = new Date();
  }
}
