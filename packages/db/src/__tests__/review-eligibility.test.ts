import { describe, expect, it } from "vitest";
import { getReviewRejectionReason } from "../review-eligibility";

const evidence = {
  submittedByDiscordId: "submitter-1",
  subjectDiscordId: "subject-1",
};

describe("review eligibility", () => {
  it("rejects submitter approval before quorum can change", () => {
    expect(getReviewRejectionReason({
      reviewerDiscordId: "submitter-1",
      decision: "approve",
    }, evidence)).toMatch(/submitted/i);
  });

  it("rejects credit-subject approval before quorum can change", () => {
    expect(getReviewRejectionReason({
      reviewerDiscordId: "subject-1",
      decision: "approve",
    }, evidence)).toMatch(/credit subject/i);
  });

  it("rejects disclosed-conflict approval before quorum can change", () => {
    expect(getReviewRejectionReason({
      reviewerDiscordId: "reviewer-1",
      decision: "approve",
      conflictDisclosed: true,
    }, evidence)).toMatch(/conflict/i);
  });

  it("allows independent clean approvals to count toward quorum", () => {
    expect(getReviewRejectionReason({
      reviewerDiscordId: "reviewer-1",
      decision: "approve",
      conflictDisclosed: false,
    }, evidence)).toBeNull();
  });

  it("does not block non-approval review decisions from conflicted reviewers", () => {
    expect(getReviewRejectionReason({
      reviewerDiscordId: "submitter-1",
      decision: "needs_more_evidence",
      conflictDisclosed: true,
    }, evidence)).toBeNull();
  });
});
