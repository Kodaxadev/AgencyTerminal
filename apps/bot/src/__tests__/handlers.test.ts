import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleInteraction } from "../handlers";

const dbMocks = vi.hoisted(() => ({
  directorOverrideEvidence: vi.fn(),
  getCapabilitiesForRoles: vi.fn(),
}));

vi.mock("@agency-terminal/db", () => ({
  addReview: vi.fn(),
  createTicket: vi.fn(),
  directorOverrideEvidence: dbMocks.directorOverrideEvidence,
  getCapabilitiesForRoles: dbMocks.getCapabilitiesForRoles,
  submitEvidence: vi.fn(),
}));

vi.mock("@agency-terminal/discord-ui", () => ({
  createAcceptedEmbed: vi.fn((description: string) => ({ description })),
  createEvidenceSubmissionEmbed: vi.fn(() => ({})),
  createReviewButtons: vi.fn(() => []),
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
