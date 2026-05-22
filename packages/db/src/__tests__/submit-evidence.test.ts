import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auditActions: [] as string[],
  completeIdempotencyKey: vi.fn(),
  insertedEvidence: [] as Array<{ metricCategory: string; validationRequiredApprovals: number }>,
}));

const tx = vi.hoisted(() => ({
  insert: vi.fn((_table: unknown) => ({
    values: (payload: Record<string, unknown>) => {
      if (typeof payload.action === "string") {
        state.auditActions.push(payload.action);
        return undefined;
      }
      if (typeof payload.metricCategory === "string") {
        state.insertedEvidence.push({
          metricCategory: payload.metricCategory,
          validationRequiredApprovals: payload.validationRequiredApprovals as number,
        });
      }
      return {
        returning: () => Promise.resolve([{
          id: "ev-inserted",
          shortId: "EVD-0099",
          validationRequiredApprovals: payload.validationRequiredApprovals,
        }]),
      };
    },
  })),
  update: vi.fn(() => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  })),
}));

vi.mock("../client", () => ({
  db: {
    transaction: async (
      callback: (client: typeof tx) => Promise<unknown>,
    ) => callback(tx),
  },
}));

vi.mock("../idempotency", () => ({
  claimIdempotencyKey: vi.fn(() => Promise.resolve({ acquired: true, result: null })),
  completeIdempotencyKey: state.completeIdempotencyKey,
}));

vi.mock("../integrity", () => ({
  getEvidenceEventTicketId: vi.fn(() => null),
  getEvidenceIdempotencyResult: vi.fn(() => null),
}));

vi.mock("../review-eligibility", () => ({
  getReviewRejectionReason: vi.fn(() => null),
}));

describe("submitEvidence persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.auditActions = [];
    state.completeIdempotencyKey.mockClear();
    state.insertedEvidence = [];
    vi.resetModules();
  });

  it("persists validationRequiredApprovals 1 for technical_development_output", async () => {
    const { submitEvidence } = await import("../evidence");

    const result = await submitEvidence({
      guildId: "guild-1",
      submittedByDiscordId: "user-1",
      subjectDiscordId: "subject-1",
      metricCategory: "technical_development_output",
      title: "Dev output evidence",
    }, "evidence:submit:guild-1:tech-1");

    expect(state.insertedEvidence).toHaveLength(1);
    expect(state.insertedEvidence[0]).toEqual({
      metricCategory: "technical_development_output",
      validationRequiredApprovals: 1,
    });
    expect(result.validationRequiredApprovals).toBe(1);
  });

  it("persists validationRequiredApprovals 2 for pvp_kill_value", async () => {
    const { submitEvidence } = await import("../evidence");

    const result = await submitEvidence({
      guildId: "guild-1",
      submittedByDiscordId: "user-1",
      subjectDiscordId: "subject-1",
      metricCategory: "pvp_kill_value",
      title: "PvP kill evidence",
    }, "evidence:submit:guild-1:pvp-1");

    expect(state.insertedEvidence).toHaveLength(1);
    expect(state.insertedEvidence[0]).toEqual({
      metricCategory: "pvp_kill_value",
      validationRequiredApprovals: 2,
    });
    expect(result.validationRequiredApprovals).toBe(2);
  });

  it("writes the persisted validationRequiredApprovals to the idempotency payload", async () => {
    const { submitEvidence } = await import("../evidence");

    await submitEvidence({
      guildId: "guild-1",
      submittedByDiscordId: "user-1",
      subjectDiscordId: "subject-1",
      metricCategory: "pvp_kill_value",
      title: "PvP kill",
    }, "evidence:submit:guild-1:idem-1");

    expect(state.completeIdempotencyKey).toHaveBeenCalledWith(
      "evidence:submit:guild-1:idem-1",
      expect.objectContaining({
        validationRequiredApprovals: 2,
      }),
      expect.anything(),
    );
  });
});
