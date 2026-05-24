import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auditActions: [] as string[],
  completeIdempotencyKey: vi.fn(),
  insertedEvidence: [] as Array<{ metricCategory: string; validationRequiredApprovals: number }>,
  insertedOutbox: [] as Array<{ eventType: string; idempotencyKey: string; payload: Record<string, unknown> }>,
}));

const tx = vi.hoisted(() => ({
  insert: vi.fn((_table: unknown) => ({
    values: (payload: Record<string, unknown>) => {
      if (typeof payload.action === "string") {
        state.auditActions.push(payload.action);
        return undefined;
      }
      if (typeof payload.eventType === "string" && typeof payload.idempotencyKey === "string") {
        state.insertedOutbox.push({
          eventType: payload.eventType,
          idempotencyKey: payload.idempotencyKey,
          payload: payload.payload as Record<string, unknown>,
        });
        return { returning: () => Promise.resolve([{ id: "outbox-1" }]) };
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
  select: vi.fn(() => ({
    from: () => ({
      where: () => ({ limit: () => Promise.resolve([]) }),
    }),
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
    state.insertedOutbox = [];
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

  it("enqueues one evidence_review_projection outbox event on successful submission", async () => {
    const { submitEvidence } = await import("../evidence");

    await submitEvidence({
      guildId: "guild-1",
      submittedByDiscordId: "user-1",
      subjectDiscordId: "subject-1",
      metricCategory: "technical_development_output",
      title: "Dev work",
    }, "evidence:submit:guild-1:outbox-1");

    const projectionEvents = state.insertedOutbox.filter(
      (e) => e.eventType === "evidence_review_projection",
    );
    expect(projectionEvents).toHaveLength(1);
  });

  it("uses the committed evidence ID in the outbox idempotency key", async () => {
    const { submitEvidence } = await import("../evidence");

    await submitEvidence({
      guildId: "guild-1",
      submittedByDiscordId: "user-1",
      subjectDiscordId: "subject-1",
      metricCategory: "pvp_kill_value",
      title: "PvP kill",
    }, "evidence:submit:guild-1:outbox-key-1");

    const projectionEvents = state.insertedOutbox.filter(
      (e) => e.eventType === "evidence_review_projection",
    );
    expect(projectionEvents[0].idempotencyKey).toBe("evidence:review-projection:guild-1:ev-inserted");
  });

  it("carries the persisted canonical quorum value in the outbox payload", async () => {
    const { submitEvidence } = await import("../evidence");

    await submitEvidence({
      guildId: "guild-1",
      submittedByDiscordId: "user-1",
      subjectDiscordId: "subject-1",
      metricCategory: "pvp_kill_value",
      title: "PvP kill",
    }, "evidence:submit:guild-1:outbox-quorum-1");

    const projectionEvents = state.insertedOutbox.filter(
      (e) => e.eventType === "evidence_review_projection",
    );
    expect(projectionEvents[0].payload.validationRequiredApprovals).toBe(2);
  });

  it("does not include raw evidence link URL in the outbox payload", async () => {
    const { submitEvidence } = await import("../evidence");

    await submitEvidence({
      guildId: "guild-1",
      submittedByDiscordId: "user-1",
      subjectDiscordId: "subject-1",
      metricCategory: "technical_development_output",
      title: "Dev work with link",
      linkUrl: "https://example.invalid/repo/pull/42",
      linkSourceType: "manual",
    }, "evidence:submit:guild-1:outbox-nourl-1");

    const projectionEvents = state.insertedOutbox.filter(
      (e) => e.eventType === "evidence_review_projection",
    );
    expect(projectionEvents[0].payload).not.toHaveProperty("linkUrl");
    expect(projectionEvents[0].payload).not.toHaveProperty("linkSourceType");
  });
});
