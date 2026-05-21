import { db } from "./client";
import {
  evidence,
  evidenceReviews,
  evidenceLinks,
  agentScoreEvents,
  auditLog,
  ticketEvents,
} from "../schema/drizzle-schema";
import { eq, sql, and } from "drizzle-orm";

export interface SubmitEvidenceInput {
  guildId: string;
  ticketId?: string;
  submittedByDiscordId: string;
  subjectDiscordId: string;
  metricCategory: string;
  title: string;
  description?: string;
  sensitivity?: "public" | "member" | "officer_only" | "director_only";
  linkUrl?: string;
  linkSourceType?: string;
  eventOccurredAt?: Date;
}

export interface SubmitEvidenceResult {
  id: string;
  shortId: string | null;
}

/**
 * Submit evidence to the ledger with optional link and idempotency.
 */
export async function submitEvidence(
  input: SubmitEvidenceInput,
  idempotencyKey: string
): Promise<SubmitEvidenceResult> {
  // Idempotency check
  const existing = await db
    .select({ id: ticketEvents.id })
    .from(ticketEvents)
    .where(
      and(
        sql`${ticketEvents.eventPayload} @> ${JSON.stringify({ idempotencyKey })}`,
        eq(ticketEvents.eventType, "evidence_submitted")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Return existing — find the evidence record
    const ev = await db
      .select({ id: evidence.id, shortId: evidence.shortId })
      .from(evidence)
      .where(eq(evidence.submittedByDiscordId, input.submittedByDiscordId))
      .orderBy(evidence.createdAt)
      .limit(1);

    if (ev.length > 0) return ev[0]!;
  }

  const [ev] = await db
    .insert(evidence)
    .values({
      guildId: input.guildId,
      ticketId: input.ticketId,
      submittedByDiscordId: input.submittedByDiscordId,
      subjectDiscordId: input.subjectDiscordId,
      metricCategory: input.metricCategory as any,
      status: "under_review",
      sensitivity: input.sensitivity ?? "member",
      title: input.title,
      description: input.description ?? "",
      validationRequiredApprovals: 2,
    })
    .returning({ id: evidence.id, shortId: evidence.shortId });

  if (!ev) throw new Error("Failed to create evidence record");

  // Attach link if provided
  if (input.linkUrl) {
    await db.insert(evidenceLinks).values({
      evidenceId: ev.id,
      url: input.linkUrl,
      sourceType: input.linkSourceType ?? "manual",
    });
  }

  // Record event for idempotency tracking
  await db.insert(ticketEvents).values({
    ticketId: input.ticketId ?? ev.id,
    actorDiscordId: input.submittedByDiscordId,
    eventType: "evidence_submitted",
    eventPayload: { idempotencyKey, evidenceId: ev.id } as Record<string, unknown>,
  });

  return ev;
}

export interface AddReviewInput {
  evidenceId: string;
  reviewerDiscordId: string;
  decision: "approve" | "object" | "needs_more_evidence";
  rationale: string;
  guildId: string;
  conflictDisclosed?: boolean;
  conflictReason?: string;
  qualityTier?: "A" | "B" | "C" | "D" | "F";
}

export interface AddReviewResult {
  id: string;
  quorumReached: boolean;
}

/**
 * Add a review to an evidence record. Returns whether quorum was reached.
 */
export async function addReview(
  input: AddReviewInput,
  idempotencyKey: string
): Promise<AddReviewResult> {
  // Idempotency: one review per reviewer per evidence
  const existing = await db
    .select({ id: evidenceReviews.id })
    .from(evidenceReviews)
    .where(
      sql`${evidenceReviews.evidenceId} = ${input.evidenceId} AND ${evidenceReviews.reviewerDiscordId} = ${input.reviewerDiscordId}`
    )
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0]!.id, quorumReached: false };
  }

  const [review] = await db
    .insert(evidenceReviews)
    .values({
      evidenceId: input.evidenceId,
      reviewerDiscordId: input.reviewerDiscordId,
      decision: input.decision as any,
      rationale: input.rationale,
      conflictDisclosed: input.conflictDisclosed ? "true" : "false",
      conflictReason: input.conflictReason,
      qualityTier: input.qualityTier,
    })
    .returning({ id: evidenceReviews.id });

  if (!review) throw new Error("Failed to create review");

  // Count approvals for this evidence
  const approvals = await db
    .select({ count: sql<number>`count(*)` })
    .from(evidenceReviews)
    .where(
      and(
        eq(evidenceReviews.evidenceId, input.evidenceId),
        eq(evidenceReviews.decision, "approve" as any)
      )
    );

  const approvalCount = Number(approvals[0]!.count);

  // Get the evidence record to check required approvals
  const ev = await db
    .select({
      requiredApprovals: evidence.validationRequiredApprovals,
      status: evidence.status,
      guildId: evidence.guildId,
    })
    .from(evidence)
    .where(eq(evidence.id, input.evidenceId))
    .limit(1);

  if (ev.length === 0) throw new Error("Evidence not found");

  const quorumReached = approvalCount >= ev[0]!.requiredApprovals;

  if (quorumReached && ev[0]!.status === "under_review") {
    await db
      .update(evidence)
      .set({ status: "validated", validatedAt: new Date() })
      .where(eq(evidence.id, input.evidenceId));
  }

  return { id: review.id, quorumReached };
}

export interface CreditScoreInput {
  evidenceId: string;
  guildId: string;
  agentDiscordId: string;
  metricCategory: string;
  pointsApproved: number;
  creditedBy: string;
}

/**
 * Record a score credit event. Idempotent per evidence+agent pair.
 */
export async function creditScore(
  input: CreditScoreInput,
  idempotencyKey: string
): Promise<void> {
  // Idempotency check
  const existing = await db
    .select({ id: agentScoreEvents.id })
    .from(agentScoreEvents)
    .where(
      sql`${agentScoreEvents.evidenceId} = ${input.evidenceId} AND ${agentScoreEvents.agentDiscordId} = ${input.agentDiscordId}`
    )
    .limit(1);

  if (existing.length > 0) return; // Already credited

  await db.insert(agentScoreEvents).values({
    guildId: input.guildId,
    evidenceId: input.evidenceId,
    agentDiscordId: input.agentDiscordId,
    metricCategory: input.metricCategory as any,
    pointSource: "configured_table" as any,
    pointsApproved: input.pointsApproved,
    pointsTableVersion: 1,
    creditedBy: input.creditedBy,
    status: "credited" as any,
  });

  // Mark evidence as credited
  await db
    .update(evidence)
    .set({ status: "credited", creditedAt: new Date() })
    .where(eq(evidence.id, input.evidenceId));
}

/**
 * Write an audit log entry.
 */
export async function writeAuditLog(input: {
  guildId: string;
  actorDiscordId?: string;
  action: string;
  subjectType: string;
  subjectId: string;
  sensitivity?: "public" | "member" | "officer_only" | "director_only";
  payload?: Record<string, unknown>;
  discordMessageId?: string;
}): Promise<void> {
  await db.insert(auditLog).values({
    guildId: input.guildId,
    actorDiscordId: input.actorDiscordId,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    sensitivity: input.sensitivity ?? "officer_only" as any,
    payload: (input.payload ?? {}) as Record<string, unknown>,
    discordMessageId: input.discordMessageId,
  });
}

/**
 * Find evidence that has gone stale (past staleAfter without notification).
 */
export async function findStaleEvidence(
  guildId: string,
  now = new Date()
): Promise<Array<{ id: string; shortId: string | null; title: string; metricCategory: string }>> {
  const rows = await db
    .select({
      id: evidence.id,
      shortId: evidence.shortId,
      title: evidence.title,
      metricCategory: evidence.metricCategory,
    })
    .from(evidence)
    .where(
      sql`${evidence.guildId} = ${guildId} AND ${evidence.status} = 'under_review' AND ${evidence.staleAfter} <= ${now} AND ${evidence.staleNotifiedAt} IS NULL`
    );

  return rows as Array<{ id: string; shortId: string | null; title: string; metricCategory: string }>;
}

/**
 * Mark evidence as stale and notify.
 */
export async function markEvidenceStale(evidenceId: string): Promise<void> {
  await db
    .update(evidence)
    .set({ status: "stale_review" as any, staleNotifiedAt: new Date() })
    .where(eq(evidence.id, evidenceId));
}

/**
 * Director override: force-validate stale evidence.
 */
export async function directorOverrideEvidence(
  evidenceId: string,
  directorDiscordId: string,
  reason: string
): Promise<void> {
  await db
    .update(evidence)
    .set({ status: "validated" as any, validatedAt: new Date() })
    .where(eq(evidence.id, evidenceId));
}
