export interface EvidenceIdempotencyResult {
  id: string;
  shortId: string | null;
  validationRequiredApprovals: number;
}

export function getEvidenceEventTicketId(
  ticketId: string | undefined,
  _evidenceId: string,
): string | null {
  return ticketId ?? null;
}

export function getEvidenceIdempotencyResult(
  payload: Record<string, unknown>,
): EvidenceIdempotencyResult | null {
  if (typeof payload.evidenceId !== "string") return null;
  if (typeof payload.validationRequiredApprovals !== "number") return null;

  return {
    id: payload.evidenceId,
    shortId: typeof payload.evidenceShortId === "string" ? payload.evidenceShortId : null,
    validationRequiredApprovals: payload.validationRequiredApprovals,
  };
}

export function shouldPersistTicketChannelId(channelId: string): boolean {
  return channelId.length > 0 && !channelId.startsWith("pending:");
}

export function validateMigration007SchemaShape(input: {
  evidenceColumns: string[];
  reviewColumns: string[];
  capabilities: string[];
}): string[] {
  const errors: string[] = [];
  const requiredEvidence = [
    "eventOccurredAt",
    "submittedMode",
    "backfillReason",
    "backfilledBy",
    "qualityTier",
  ];

  for (const column of requiredEvidence) {
    if (!input.evidenceColumns.includes(column)) {
      errors.push(`missing evidence.${column}`);
    }
  }

  if (!input.reviewColumns.includes("conflictDisclosed")) {
    errors.push("missing evidenceReviews.conflictDisclosed");
  }

  if (input.reviewColumns.includes("qualityTier")) {
    errors.push("evidenceReviews.qualityTier should be on evidence");
  }

  for (const capability of ["can_backfill_evidence", "can_review_appeals"]) {
    if (!input.capabilities.includes(capability)) {
      errors.push(`missing capability.${capability}`);
    }
  }

  return errors;
}
