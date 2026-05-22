import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleInteraction } from "../handlers";

const dbMocks = vi.hoisted(() => ({
  addReview: vi.fn(),
  directorOverrideEvidence: vi.fn(),
  getCapabilitiesForRoles: vi.fn(),
  submitEvidence: vi.fn(),
}));

vi.mock("@agency-terminal/db", () => ({
  addReview: dbMocks.addReview,
  createTicket: vi.fn(),
  directorOverrideEvidence: dbMocks.directorOverrideEvidence,
  getCapabilitiesForRoles: dbMocks.getCapabilitiesForRoles,
  submitEvidence: dbMocks.submitEvidence,
}));

const uiMocks = vi.hoisted(() => ({
  createAcceptedEmbed: vi.fn((description: string) => ({ description })),
  createEvidenceSubmissionEmbed: vi.fn(),
  createReviewButtons: vi.fn(),
  createReviewResultEmbed: vi.fn(() => ({})),
  createStaleEmbed: vi.fn((description: string) => ({ description })),
}));

vi.mock("@agency-terminal/discord-ui", () => uiMocks);

describe("interaction handler safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getCapabilitiesForRoles.mockResolvedValue(["can_override_quorum"]);
  });

  it("does not report success for nonexistent evidence override", async () => {
    dbMocks.directorOverrideEvidence.mockRejectedValueOnce(new Error("Evidence not found"));
    const interaction = makeDirectorOverrideInteraction();

    await handleInteraction(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringMatching(/not found/i));
    expect(JSON.stringify(interaction.editReply.mock.calls)).not.toContain("is now validated");
  });

  it("opens the review modal for authorized review button clicks", async () => {
    dbMocks.getCapabilitiesForRoles.mockResolvedValueOnce(["can_validate_evidence"]);
    const interaction = makeReviewButtonInteraction();

    await handleInteraction(interaction as never);

    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.showModal).toHaveBeenCalledOnce();
  });

  it("keeps submitter evidence receipts ephemeral without review controls", async () => {
    dbMocks.submitEvidence.mockResolvedValueOnce({ id: "ev-1", shortId: "EVD-0001", validationRequiredApprovals: 1 });
    const interaction = makeEvidenceSubmitInteraction();

    await handleInteraction(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    const receipt = interaction.editReply.mock.calls[0]?.[0] as { components?: unknown };
    expect(receipt.components).toBeUndefined();
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
    expect(JSON.stringify(interaction.editReply.mock.calls)).not.toContain("https://example.invalid/evidence");
  });

  it("evidence submission calls submitEvidence and returns queued-review acknowledgement", async () => {
    dbMocks.submitEvidence.mockResolvedValueOnce({ id: "ev-1", shortId: "EVD-0042", validationRequiredApprovals: 1 });
    const interaction = makeEvidenceSubmitInteraction();

    await handleInteraction(interaction as never);

    expect(dbMocks.submitEvidence).toHaveBeenCalledOnce();
    const [replyArg] = interaction.editReply.mock.calls[0] as [{ content: string }];
    expect(replyArg.content).toContain("EVD-0042");
    expect(replyArg.content).toContain("recorded and queued for private review");
  });

  it("submission acknowledgement contains no inline review components", async () => {
    dbMocks.submitEvidence.mockResolvedValueOnce({ id: "ev-1", shortId: "EVD-0001", validationRequiredApprovals: 1 });
    const interaction = makeEvidenceSubmitInteraction();

    await handleInteraction(interaction as never);

    for (const [arg] of interaction.editReply.mock.calls as [{ components?: unknown }][]) {
      expect(arg.components).toBeUndefined();
    }
  });

  it("handler does not invoke evidence submission embed or review buttons after submission", async () => {
    dbMocks.submitEvidence.mockResolvedValueOnce({ id: "ev-1", shortId: "EVD-0001", validationRequiredApprovals: 1 });
    const interaction = makeEvidenceSubmitInteraction();

    await handleInteraction(interaction as never);

    expect(uiMocks.createEvidenceSubmissionEmbed).not.toHaveBeenCalled();
    expect(uiMocks.createReviewButtons).not.toHaveBeenCalled();
  });

  it("handler does not access guild channels for evidence submission", async () => {
    dbMocks.submitEvidence.mockResolvedValueOnce({ id: "ev-1", shortId: "EVD-0001", validationRequiredApprovals: 1 });
    // No guild property — accessing guild.channels.fetch would throw and fail this test
    const interaction = makeEvidenceSubmitInteraction();

    await handleInteraction(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining("queued for private review") }),
    );
  });

  it("returns a truthful denial when approval is rejected by the domain service", async () => {
    dbMocks.getCapabilitiesForRoles.mockResolvedValueOnce(["can_validate_evidence"]);
    dbMocks.addReview.mockRejectedValueOnce(new Error("Reviewer cannot approve evidence they submitted."));
    const interaction = makeReviewModalInteraction("No");

    await handleInteraction(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringMatching(/cannot approve evidence/i));
  });
});

function makeDirectorOverrideInteraction() {
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    commandName: "director",
    guildId: "guild-1",
    user: { id: "director-1" },
    member: { roles: { cache: new Map([["role-1", {}]]) } },
    options: {
      getSubcommand: () => "override",
      getString: (name: string) => name === "evidence_id" ? "missing-ev" : "Valid override reason",
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  };
}

function makeReviewButtonInteraction() {
  return {
    isChatInputCommand: () => false,
    isButton: () => true,
    isModalSubmit: () => false,
    customId: "review:approve:evidence-1",
    guildId: "guild-1",
    user: { id: "reviewer-1" },
    member: { roles: { cache: new Map([["role-1", {}]]) } },
    reply: vi.fn().mockResolvedValue(undefined),
    showModal: vi.fn().mockResolvedValue(undefined),
  };
}

function makeEvidenceSubmitInteraction(metric = "technical_development_output") {
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    commandName: "evidence",
    guildId: "guild-1",
    user: { id: "submitter-1" },
    options: {
      getSubcommand: () => "submit",
      getString: (name: string) => {
        const values: Record<string, string> = {
          metric,
          title: "Test evidence",
          description: "Review this work",
          link: "https://example.invalid/evidence",
        };
        return values[name] ?? null;
      },
      getUser: () => null,
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
  };
}

function makeReviewModalInteraction(conflict: string) {
  return {
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => true,
    customId: "review_modal:approve:evidence-1",
    guildId: "guild-1",
    user: { id: "submitter-1" },
    member: { roles: { cache: new Map([["role-1", {}]]) } },
    fields: {
      getTextInputValue: (name: string) => name === "conflict" ? conflict : "Reviewed.",
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
  };
}
