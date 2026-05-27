import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleInteraction } from "../handlers";

const dbMocks = vi.hoisted(() => ({
  addReview: vi.fn(),
  createTicket: vi.fn(),
  directorOverrideEvidence: vi.fn(),
  getCapabilitiesForRoles: vi.fn(),
  getEvidenceStatusForParticipant: vi.fn().mockResolvedValue(null),
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
    dbMocks.createTicket.mockResolvedValue({ id: "ticket-1", shortId: "TKT-0001" });
  });

  // ── Director override ────────────────────────────────────────────────────

  it("does not report success for nonexistent evidence override", async () => {
    dbMocks.directorOverrideEvidence.mockRejectedValueOnce(new Error("Evidence not found"));
    const interaction = makeDirectorOverrideInteraction();

    await handleInteraction(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringMatching(/not found/i));
    expect(JSON.stringify(interaction.editReply.mock.calls)).not.toContain("is now validated");
  });

  // ── Review button — B4 modal latency hardening ───────────────────────────

  it("review button click shows modal immediately without DB capability lookup", async () => {
    const interaction = makeReviewButtonInteraction();

    await handleInteraction(interaction as never);

    expect(interaction.showModal).toHaveBeenCalledOnce();
    expect(dbMocks.getCapabilitiesForRoles).not.toHaveBeenCalled();
  });

  it("review button click does not issue a denial reply based on DB role lookup", async () => {
    const interaction = makeReviewButtonInteraction();

    await handleInteraction(interaction as never);

    expect(interaction.reply).not.toHaveBeenCalled();
    expect(interaction.showModal).toHaveBeenCalledOnce();
  });

  it("malformed review button custom ID fails ephemerally without DB capability lookup", async () => {
    const interaction = { ...makeReviewButtonInteraction(), customId: "review:approve:" };

    await handleInteraction(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
    expect(interaction.showModal).not.toHaveBeenCalled();
    expect(dbMocks.getCapabilitiesForRoles).not.toHaveBeenCalled();
  });

  // ── Review modal — mutation-time authorization boundary ──────────────────

  it("unauthorized modal submission calls deferReply ephemeral, returns denial, never calls addReview", async () => {
    dbMocks.getCapabilitiesForRoles.mockResolvedValueOnce([]);
    const interaction = makeReviewModalInteraction("No");

    await handleInteraction(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringMatching(/not authorized/i));
    expect(dbMocks.addReview).not.toHaveBeenCalled();
  });

  it("authorized modal submission calls addReview", async () => {
    dbMocks.getCapabilitiesForRoles.mockResolvedValueOnce(["can_validate_evidence"]);
    dbMocks.addReview.mockResolvedValueOnce({ quorumReached: false });
    const interaction = makeReviewModalInteraction("No");

    await handleInteraction(interaction as never);

    expect(dbMocks.addReview).toHaveBeenCalledOnce();
  });

  it("returns a truthful denial when approval is rejected by the domain service", async () => {
    dbMocks.getCapabilitiesForRoles.mockResolvedValueOnce(["can_validate_evidence"]);
    dbMocks.addReview.mockRejectedValueOnce(new Error("Reviewer cannot approve evidence they submitted."));
    const interaction = makeReviewModalInteraction("No");

    await handleInteraction(interaction as never);

    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringMatching(/cannot approve evidence/i));
  });

  // ── Evidence submission — B3 queued-ack ─────────────────────────────────

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

    const editReplyCalls = interaction.editReply.mock.calls as Array<[{ content?: string }]>;
    expect(editReplyCalls.some(([reply]) => reply.content?.includes("queued for private review"))).toBe(true);
  });

  // -- Ticket command capability gates ----------------------------------------------------

  it.each([
    ["enlistment", "can_manage_enlistment"],
    ["contract", "can_manage_contracts"],
    ["intel", "can_manage_intel"],
    ["clearance", "can_manage_clearance"],
  ])("denies /ticket %s without %s", async (subcommand) => {
    dbMocks.getCapabilitiesForRoles.mockResolvedValueOnce([]);
    const interaction = makeTicketInteraction(subcommand);

    await handleInteraction(interaction as never);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringMatching(/not authorized/i));
    expect(dbMocks.createTicket).not.toHaveBeenCalled();
  });

  it("allows /ticket contract with can_manage_contracts", async () => {
    dbMocks.getCapabilitiesForRoles.mockResolvedValueOnce(["can_manage_contracts"]);
    const interaction = makeTicketInteraction("contract");

    await handleInteraction(interaction as never);

    expect(dbMocks.createTicket).toHaveBeenCalledWith(expect.objectContaining({
      guildId: "guild-1",
      type: "contract",
    }), expect.stringContaining("ticket:create:guild-1"));
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

function makeTicketInteraction(subcommand: string) {
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    commandName: "ticket",
    id: `interaction-${subcommand}`,
    guildId: "guild-1",
    user: { id: "requester-1" },
    member: { roles: { cache: new Map([["role-1", {}]]) } },
    options: {
      getSubcommand: () => subcommand,
      getString: (name: string) => {
        const values: Record<string, string> = {
          title: "Contract Work",
          target: "Target One",
          level: "Officer",
        };
        return values[name] ?? null;
      },
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
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
