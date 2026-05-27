import { evidence, evidenceReviews } from "../schema/drizzle-schema";
import { db } from "./client";
import { and, eq } from "./query";

export interface EvidenceStatusLookupInput {
  guildId: string;
  evidenceIdOrShortId: string;
  requestingDiscordId: string;
}

export interface EvidenceStatusResult {
  id: string;
  shortId: string | null;
  status: string;
  metricCategory: string;
  validationRequiredApprovals: number;
  eligibleApprovals: number;
  createdAt: Date;
  validatedAt: Date | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID_PATTERN = /^[A-Z]{2,6}-[0-9]{1,12}$/;

/**
 * Returns evidence status only when the requesting Discord user is the
 * submitter or the subject of the record. Returns null for not-found,
 * unauthorized, wrong-guild and malformed-input cases — callers must show
 * the same neutral message for every null result.
 *
 * The result intentionally omits description, links, reviewer identities,
 * review rationales, conflict details and audit payloads.
 */
export async function getEvidenceStatusForParticipant(
  input: EvidenceStatusLookupInput,
): Promise<EvidenceStatusResult | null> {
  const guildId = input.guildId.trim();
  const requestingDiscordId = input.requestingDiscordId.trim();
  const lookup = input.evidenceIdOrShortId.trim();
  if (!guildId || !requestingDiscordId || !lookup) return null;

  const predicate = buildLookupPredicate(guildId, lookup);
  if (!predicate) return null;

  const rows = await db
    .select({
      id: evidence.id,
      shortId: evidence.shortId,
      status: evidence.status,
      metricCategory: evidence.metricCategory,
      validationRequiredApprovals: evidence.validationRequiredApprovals,
      createdAt: evidence.createdAt,
      validatedAt: evidence.validatedAt,
      submittedByDiscordId: evidence.submittedByDiscordId,
      subjectDiscordId: evidence.subjectDiscordId,
    })
    .from(evidence)
    .where(predicate)
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const authorized =
    row.submittedByDiscordId === requestingDiscordId ||
    (row.subjectDiscordId !== null && row.subjectDiscordId === requestingDiscordId);
  if (!authorized) return null;

  const eligibleApprovals = await countEligibleApprovals(row.id, {
    submittedByDiscordId: row.submittedByDiscordId,
    subjectDiscordId: row.subjectDiscordId,
  });

  return {
    id: row.id,
    shortId: row.shortId ?? null,
    status: row.status,
    metricCategory: row.metricCategory,
    validationRequiredApprovals: row.validationRequiredApprovals,
    eligibleApprovals,
    createdAt: row.createdAt,
    validatedAt: row.validatedAt ?? null,
  };
}

function buildLookupPredicate(guildId: string, lookup: string) {
  if (UUID_PATTERN.test(lookup)) {
    return and(eq(evidence.guildId, guildId), eq(evidence.id, lookup));
  }
  if (SHORT_ID_PATTERN.test(lookup)) {
    return and(eq(evidence.guildId, guildId), eq(evidence.shortId, lookup));
  }
  return null;
}

async function countEligibleApprovals(
  evidenceId: string,
  evidenceParticipants: { submittedByDiscordId: string; subjectDiscordId: string | null },
): Promise<number> {
  const reviews = await db
    .select({
      reviewerDiscordId: evidenceReviews.reviewerDiscordId,
      decision: evidenceReviews.decision,
      conflictDisclosed: evidenceReviews.conflictDisclosed,
    })
    .from(evidenceReviews)
    .where(eq(evidenceReviews.evidenceId, evidenceId));

  return reviews.filter((review) => isEligibleApproval(review, evidenceParticipants)).length;
}

function isEligibleApproval(
  review: { reviewerDiscordId: string; decision: string; conflictDisclosed: boolean },
  participants: { submittedByDiscordId: string; subjectDiscordId: string | null },
): boolean {
  if (review.decision !== "approve") return false;
  if (review.conflictDisclosed) return false;
  if (review.reviewerDiscordId === participants.submittedByDiscordId) return false;
  if (
    participants.subjectDiscordId !== null &&
    review.reviewerDiscordId === participants.subjectDiscordId
  ) return false;
  return true;
}
