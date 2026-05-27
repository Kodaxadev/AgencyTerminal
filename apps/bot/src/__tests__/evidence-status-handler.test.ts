import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  addReview: vi.fn(),
  createTicket: vi.fn(),
  directorOverrideEvidence: vi.fn(),
  getCapabilitiesForRoles: vi.fn().mockResolvedValue([]),
  getEvidenceStatusForParticipant: vi.fn(),
  submitEvidence: vi.fn(),
}));

vi.mock("@agency-terminal/db", () => ({
  addReview: dbMocks.addReview,
  createTicket: dbMocks.createTicket,
  directorOverrideEvidence: dbMocks.directorOverrideEvidence,
  getCapabilitiesForRoles: dbMocks.getCapabilitiesForRoles,
  getEvidenceStatusForParticipant: dbMocks.getEvidenceStatusForParticipant,
  submitEvidence: dbMocks.submitEvidence,
}));

vi.mock("@agency-terminal/discord-ui", () => ({
  createAcceptedEmbed: vi.fn(),
  createReviewResultEmbed: vi.fn(),
  createStaleEmbed: vi.fn(),
}));

import { handleInteraction } from "../handlers";

const NEUTRAL_REPLY = "Evidence not found or not available to you.";

describe("/evidence status interaction handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defers ephemerally before any database call", async () => {
    dbMocks.getEvidenceStatusForParticipant.mockResolvedValueOnce(null);
    const interaction = makeEvidenceStatusInteraction("EVD-0023");

    await handleInteraction(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it("authorized lookup formats only safe fields", async () => {
    dbMocks.getEvidenceStatusForParticipant.mockResolvedValueOnce({
      id: "11111111-2222-3333-4444-555555555555",
      shortId: "EVD-0023",
      status: "under_review",
      metricCategory: "intelligence_acquisitions",
      validationRequiredApprovals: 2,
      eligibleApprovals: 1,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      validatedAt: null,
    });
    const interaction = makeEvidenceStatusInteraction("EVD-0023");

    await handleInteraction(interaction as never);

    expect(dbMocks.getEvidenceStatusForParticipant).toHaveBeenCalledWith({
      guildId: "guild-1",
      evidenceIdOrShortId: "EVD-0023",
      requestingDiscordId: "lookup-user-1",
    });
    const reply = String(interaction.editReply.mock.calls[0]?.[0] ?? "");
    expect(reply).toContain("EVD-0023");
    expect(reply).toContain("under_review");
    expect(reply).toContain("intelligence_acquisitions");
    expect(reply).toContain("1 / 2");
    expect(reply).toContain("2026-05-01");
    for (const forbidden of ["description", "rationale", "conflict", "reviewer", "submittedByDiscordId", "subjectDiscordId", "evidenceUrl", "link"]) {
      expect(reply).not.toContain(forbidden);
    }
  });

  it("authorized validated lookup includes the validated timestamp", async () => {
    dbMocks.getEvidenceStatusForParticipant.mockResolvedValueOnce({
      id: "11111111-2222-3333-4444-555555555555",
      shortId: "EVD-0099",
      status: "validated",
      metricCategory: "contracts_completed",
      validationRequiredApprovals: 2,
      eligibleApprovals: 2,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      validatedAt: new Date("2026-05-02T12:30:00Z"),
    });
    const interaction = makeEvidenceStatusInteraction("EVD-0099");

    await handleInteraction(interaction as never);

    const reply = String(interaction.editReply.mock.calls[0]?.[0] ?? "");
    expect(reply).toContain("Validated:");
    expect(reply).toContain("2026-05-02");
  });

  it("not-found and unauthorized share the same neutral reply", async () => {
    dbMocks.getEvidenceStatusForParticipant.mockResolvedValueOnce(null);
    const unauthorized = makeEvidenceStatusInteraction("EVD-0023");
    await handleInteraction(unauthorized as never);

    dbMocks.getEvidenceStatusForParticipant.mockResolvedValueOnce(null);
    const notFound = makeEvidenceStatusInteraction("EVD-9999");
    await handleInteraction(notFound as never);

    expect(unauthorized.editReply).toHaveBeenCalledWith(NEUTRAL_REPLY);
    expect(notFound.editReply).toHaveBeenCalledWith(NEUTRAL_REPLY);
  });

  it("DB connection error reuses the existing evidence DB-unavailable reply", async () => {
    dbMocks.getEvidenceStatusForParticipant.mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const interaction = makeEvidenceStatusInteraction("EVD-0023");

    await handleInteraction(interaction as never);

    const reply = String(interaction.editReply.mock.calls[0]?.[0] ?? "");
    expect(reply.toLowerCase()).toContain("database unavailable");
    expect(reply.toLowerCase()).toContain("evidence");
  });

  it("does not emit any public follow-up regardless of result", async () => {
    dbMocks.getEvidenceStatusForParticipant.mockResolvedValueOnce({
      id: "11111111-2222-3333-4444-555555555555",
      shortId: "EVD-0023",
      status: "validated",
      metricCategory: "contracts_completed",
      validationRequiredApprovals: 2,
      eligibleApprovals: 2,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      validatedAt: new Date("2026-05-02T00:00:00Z"),
    });
    const interaction = makeEvidenceStatusInteraction("EVD-0023");

    await handleInteraction(interaction as never);

    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it("missing guildId returns the neutral reply without calling the service", async () => {
    const interaction = makeEvidenceStatusInteraction("EVD-0023");
    interaction.guildId = null;

    await handleInteraction(interaction as never);

    expect(dbMocks.getEvidenceStatusForParticipant).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(NEUTRAL_REPLY);
  });
});

function makeEvidenceStatusInteraction(lookup: string) {
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    commandName: "evidence",
    guildId: "guild-1" as string | null,
    user: { id: "lookup-user-1" },
    options: {
      getSubcommand: () => "status",
      getString: (_name: string) => lookup,
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
  };
}
