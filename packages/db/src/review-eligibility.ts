export interface ReviewEligibilityEvidence {
  submittedByDiscordId: string;
  subjectDiscordId: string | null;
}

export interface ReviewEligibilityInput {
  reviewerDiscordId: string;
  decision: "approve" | "object" | "needs_more_evidence";
  conflictDisclosed?: boolean;
}

export function getReviewRejectionReason(
  input: ReviewEligibilityInput,
  evidence: ReviewEligibilityEvidence,
): string | null {
  if (input.decision !== "approve") return null;
  if (input.reviewerDiscordId === evidence.submittedByDiscordId) {
    return "Reviewer cannot approve evidence they submitted.";
  }
  if (evidence.subjectDiscordId && input.reviewerDiscordId === evidence.subjectDiscordId) {
    return "Reviewer cannot approve evidence where they are the credit subject.";
  }
  if (input.conflictDisclosed) {
    return "Reviewer cannot approve evidence after disclosing a conflict of interest.";
  }
  return null;
}
