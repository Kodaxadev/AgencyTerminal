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

vi.mock("@agency-terminal/discord-ui", () => ({
  createAcceptedEmbed: vi.fn((description: string) => ({ description })),
  createEvidenceSubmissionEmbed: vi.fn((record: { title: string }) => ({ title: record.title })),
  createReviewButtons: vi.fn((evidenceId: string) => [`controls:${evidenceId}`]),
  createReviewResultEmbed: vi.fn(() => ({})),
  createStaleEmbed: vi.fn((description: string) => ({ description })),
}));

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
    dbMocks.submitEvidence.mockResolvedValueOnce({ id: "ev-1", shortId: "EVD-0001" });
    const opsChannel = { send: vi.fn().mockResolvedValue(undefined) };
    const interaction = makeEvidenceSubmitInteraction(opsChannel);

    await handleInteraction(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    const receipt = interaction.editReply.mock.calls[0]?.[0] as { components?: unknown };
    expect(receipt.components).toBeUndefined();
    expect(interaction.followUp).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
    expect(JSON.stringify(interaction.editReply.mock.calls)).not.toContain("https://example.invalid/evidence");
  });

  it("routes review controls to the private ops queue projection", async () => {
    dbMocks.submitEvidence.mockResolvedValueOnce({ id: "ev-1", shortId: "EVD-0001" });
    const opsChannel = { send: vi.fn().mockResolvedValue(undefined) };
    const interaction = makeEvidenceSubmitInteraction(opsChannel);

    await handleInteraction(interaction as never);

    expect(opsChannel.send).toHaveBeenCalledWith(expect.objectContaining({
      components: ["controls:ev-1"],
    }));
    expect(JSON.stringify(opsChannel.send.mock.calls)).not.toContain("https://example.invalid/evidence");
  });

  it("fails visibly when review routing has no ops queue", async () => {
    dbMocks.submitEvidence.mockResolvedValueOnce({ id: "ev-1", shortId: "EVD-0001" });
    const interaction = makeEvidenceSubmitInteraction(undefined);

    await handleInteraction(interaction as never);

    expect(interaction.editReply).toHaveBeenLastCalledWith(expect.stringMatching(/routing failed/i));
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

function makeEvidenceSubmitInteraction(opsChannel: { send: ReturnType<typeof vi.fn> } | undefined) {
  const channels = opsChannel
    ? new Map([["ops", { name: "ops-queue", type: 0, send: opsChannel.send }]])
    : new Map();
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    commandName: "evidence",
    guildId: "guild-1",
    guild: { channels: { fetch: vi.fn().mockResolvedValue(channels) } },
    user: { id: "submitter-1" },
    options: {
      getSubcommand: () => "submit",
      getString: (name: string) => {
        const values: Record<string, string> = {
          metric: "technical_development_output",
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
