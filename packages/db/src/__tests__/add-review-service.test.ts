import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  auditActions: [] as string[],
  completeIdempotencyKey: vi.fn(),
  evidenceUpdates: 0,
  reviewInsertCount: 0,
  selectCount: 0,
  evidenceRow: {
    requiredApprovals: 1,
    status: "under_review",
    submittedByDiscordId: "submitter-1",
    subjectDiscordId: "subject-1",
  },
}));

const tx = vi.hoisted(() => ({
  insert: vi.fn((_table: unknown) => ({
    values: (payload: Record<string, unknown>) => {
      if (typeof payload.action === "string") {
        state.auditActions.push(payload.action);
        return undefined;
      }
      state.reviewInsertCount++;
      return { returning: () => Promise.resolve([{ id: "review-1" }]) };
    },
  })),
  select: vi.fn(() => {
    state.selectCount++;
    if (state.selectCount === 1) {
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([state.evidenceRow]),
          }),
        }),
      };
    }
    return {
      from: () => ({
        where: () => Promise.resolve([{ count: 1 }]),
      }),
    };
  }),
  update: vi.fn(() => ({
    set: () => ({
      where: () => {
        state.evidenceUpdates++;
        return Promise.resolve();
      },
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

describe("addReview service eligibility enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.auditActions = [];
    state.completeIdempotencyKey.mockClear();
    state.evidenceUpdates = 0;
    state.reviewInsertCount = 0;
    state.selectCount = 0;
    state.evidenceRow = {
      requiredApprovals: 1,
      status: "under_review",
      submittedByDiscordId: "submitter-1",
      subjectDiscordId: "subject-1",
    };
  });

  it("rejects submitter approval without inserting a review or validating evidence", async () => {
    const { addReview } = await import("../evidence");

    await expect(addReview({
      evidenceId: "ev-1",
      reviewerDiscordId: "submitter-1",
      decision: "approve",
      rationale: "self approval",
      guildId: "guild-1",
    }, "review-key-1")).rejects.toThrow(/submitted/i);

    expect(state.reviewInsertCount).toBe(0);
    expect(state.evidenceUpdates).toBe(0);
    expect(state.auditActions).toContain("evidence_review_rejected");
  });

  it("allows an independent clean approval to validate one-approval evidence", async () => {
    const { addReview } = await import("../evidence");

    const result = await addReview({
      evidenceId: "ev-1",
      reviewerDiscordId: "reviewer-1",
      decision: "approve",
      rationale: "independent review",
      guildId: "guild-1",
    }, "review-key-2");

    expect(result).toEqual({ id: "review-1", quorumReached: true });
    expect(state.reviewInsertCount).toBe(1);
    expect(state.evidenceUpdates).toBe(1);
    expect(state.auditActions).toContain("evidence_reviewed");
  });
});
