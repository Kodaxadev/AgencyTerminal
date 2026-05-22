import type { MetricCategory } from "@agency-terminal/core";
import { getQuorumRequirement } from "@agency-terminal/core";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "./client";
import {
  agentScoreEvents,
  auditLog,
  evidence,
  evidenceLinks,
  evidenceReviews,
  ticketEvents,
} from "../schema/drizzle-schema";
import { claimIdempotencyKey, completeIdempotencyKey } from "./idempotency";
import { getEvidenceEventTicketId, getEvidenceIdempotencyResult } from "./integrity";
import { getReviewRejectionReason } from "./review-eligibility";
import { enqueueOutbox } from "./outbox";

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
  submittedMode?: "live_bot" | "manual_backfill" | "imported";
  backfillReason?: string;
  backfilledBy?: string;
}

export interface SubmitEvidenceResult {
  id: string;
  shortId: string | null;
  validationRequiredApprovals: number;
}

export async function submitEvidence(
  input: SubmitEvidenceInput,
  idempotencyKey: string,
): Promise<SubmitEvidenceResult> {
  return db.transaction(async (tx) => {
    const claim = await claimIdempotencyKey({
      key: idempotencyKey,
      guildId: input.guildId,
      scope: "evidence:submit",
      actorDiscordId: input.submittedByDiscordId,
    }, tx);

    if (!claim.acquired) {
      const result = claim.result ? getEvidenceIdempotencyResult(claim.result) : null;
      if (result) return result;
      throw new Error("Duplicate evidence submission is already processing");
    }

    const requiredApprovals = getQuorumRequirement(input.metricCategory as MetricCategory);

    const [ev] = await tx
      .insert(evidence)
      .values({
        guildId: input.guildId,
        ticketId: input.ticketId,
        submittedByDiscordId: input.submittedByDiscordId,
        subjectDiscordId: input.subjectDiscordId,
        metricCategory: input.metricCategory as typeof evidence.$inferInsert.metricCategory,
        status: "under_review",
        sensitivity: input.sensitivity ?? "member",
        title: input.title,
        description: input.description ?? "",
        validationRequiredApprovals: requiredApprovals,
        eventOccurredAt: input.eventOccurredAt,
        submittedMode: input.submittedMode ?? "live_bot",
        backfillReason: input.backfillReason,
        backfilledBy: input.backfilledBy,
      })
      .returning({ id: evidence.id, shortId: evidence.shortId, validationRequiredApprovals: evidence.validationRequiredApprovals });

    if (!ev) throw new Error("Failed to create evidence record");

    if (input.linkUrl) {
      await tx.insert(evidenceLinks).values({
        evidenceId: ev.id,
        url: input.linkUrl,
        sourceType: input.linkSourceType ?? "manual",
      });
    }

    const ticketId = getEvidenceEventTicketId(input.ticketId, ev.id);
    if (ticketId) {
      await tx.insert(ticketEvents).values({
        ticketId,
        actorDiscordId: input.submittedByDiscordId,
        eventType: "evidence_submitted",
        eventPayload: { idempotencyKey, evidenceId: ev.id } as Record<string, unknown>,
      });
    }

    await tx.insert(auditLog).values({
      guildId: input.guildId,
      actorDiscordId: input.submittedByDiscordId,
      action: "evidence_submitted",
      subjectType: "evidence",
      subjectId: ev.id,
      sensitivity: (input.sensitivity ?? "officer_only") as typeof auditLog.$inferInsert.sensitivity,
      payload: {
        idempotencyKey,
        metric: input.metricCategory,
        title: input.title,
        ticketId: input.ticketId ?? null,
      } as Record<string, unknown>,
    });

    await completeIdempotencyKey(idempotencyKey, {
      evidenceId: ev.id,
      evidenceShortId: ev.shortId,
      validationRequiredApprovals: ev.validationRequiredApprovals,
    }, tx);

    await enqueueOutbox({
      guildId: input.guildId,
      eventType: "evidence_review_projection",
      idempotencyKey: `evidence:review-projection:${input.guildId}:${ev.id}`,
      payload: { evidenceId: ev.id, evidenceShortId: ev.shortId, submittedByDiscordId: input.submittedByDiscordId, subjectDiscordId: input.subjectDiscordId, metricCategory: input.metricCategory, sensitivity: input.sensitivity ?? "member", title: input.title, description: input.description ?? "", validationRequiredApprovals: ev.validationRequiredApprovals, submittedMode: input.submittedMode ?? "live_bot" },
    }, tx);

    return { id: ev.id, shortId: ev.shortId, validationRequiredApprovals: ev.validationRequiredApprovals };
  });
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

export async function addReview(
  input: AddReviewInput,
  idempotencyKey: string,
): Promise<AddReviewResult> {
  const outcome = await db.transaction(async (tx): Promise<AddReviewResult | { rejectedReason: string }> => {
    const claim = await claimIdempotencyKey({
      key: idempotencyKey,
      guildId: input.guildId,
      scope: "evidence:review",
      actorDiscordId: input.reviewerDiscordId,
    }, tx);

    if (!claim.acquired) {
      if (typeof claim.result?.rejectedReason === "string") {
        throw new Error(claim.result.rejectedReason);
      }
      const result = getReviewIdempotencyResult(claim.result);
      if (result) return result;
      throw new Error("Duplicate review submission is already processing");
    }

    const ev = await tx
      .select({
        requiredApprovals: evidence.validationRequiredApprovals,
        status: evidence.status,
        submittedByDiscordId: evidence.submittedByDiscordId,
        subjectDiscordId: evidence.subjectDiscordId,
      })
      .from(evidence)
      .where(eq(evidence.id, input.evidenceId))
      .limit(1);

    if (ev.length === 0) throw new Error("Evidence not found");

    const evidenceRecord = ev[0];
    const rejectionReason = getReviewRejectionReason(input, evidenceRecord);
    if (rejectionReason) {
      await tx.insert(auditLog).values({
        guildId: input.guildId,
        actorDiscordId: input.reviewerDiscordId,
        action: "evidence_review_rejected",
        subjectType: "evidence",
        subjectId: input.evidenceId,
        sensitivity: "officer_only",
        payload: {
          decision: input.decision,
          reason: rejectionReason,
          conflictDisclosed: input.conflictDisclosed ?? false,
          idempotencyKey,
        } as Record<string, unknown>,
      });
      await completeIdempotencyKey(idempotencyKey, { rejectedReason: rejectionReason }, tx);
      return { rejectedReason: rejectionReason };
    }

    const [review] = await tx
      .insert(evidenceReviews)
      .values({
        evidenceId: input.evidenceId,
        reviewerDiscordId: input.reviewerDiscordId,
        decision: input.decision,
        rationale: input.rationale,
        conflictDisclosed: input.conflictDisclosed ?? false,
        conflictReason: input.conflictReason,
      })
      .returning({ id: evidenceReviews.id });

    if (!review) throw new Error("Failed to create review");

    const approvals = await tx
      .select({ count: sql<number>`count(*)` })
      .from(evidenceReviews)
      .where(
        and(
          eq(evidenceReviews.evidenceId, input.evidenceId),
          eq(evidenceReviews.decision, "approve"),
          eq(evidenceReviews.conflictDisclosed, false),
          sql`${evidenceReviews.reviewerDiscordId} <> ${evidenceRecord.submittedByDiscordId}`,
          evidenceRecord.subjectDiscordId
            ? sql`${evidenceReviews.reviewerDiscordId} <> ${evidenceRecord.subjectDiscordId}`
            : sql`true`,
        ),
      );

    const quorumReached = Number(approvals[0]?.count ?? 0) >= evidenceRecord.requiredApprovals;
    if (quorumReached && evidenceRecord.status === "under_review") {
      await tx
        .update(evidence)
        .set({
          status: "validated",
          validatedAt: new Date(),
          qualityTier: input.qualityTier,
        })
        .where(eq(evidence.id, input.evidenceId));
    }

    await tx.insert(auditLog).values({
      guildId: input.guildId,
      actorDiscordId: input.reviewerDiscordId,
      action: "evidence_reviewed",
      subjectType: "evidence",
      subjectId: input.evidenceId,
      sensitivity: "officer_only",
      payload: {
        decision: input.decision,
        quorumReached,
        idempotencyKey,
      } as Record<string, unknown>,
    });

    const result = { id: review.id, quorumReached };
    await completeIdempotencyKey(idempotencyKey, result, tx);
    return result;
  });

  if ("rejectedReason" in outcome) throw new Error(outcome.rejectedReason);
  return outcome;
}

export interface CreditScoreInput {
  evidenceId: string;
  guildId: string;
  agentDiscordId: string;
  metricCategory: string;
  pointsApproved: number;
  creditedBy: string;
}

export async function creditScore(
  input: CreditScoreInput,
  idempotencyKey: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const claim = await claimIdempotencyKey({
      key: idempotencyKey,
      guildId: input.guildId,
      scope: "score:credit",
      actorDiscordId: input.creditedBy,
    }, tx);
    if (!claim.acquired) return;

    await tx.insert(agentScoreEvents).values({
      guildId: input.guildId,
      evidenceId: input.evidenceId,
      agentDiscordId: input.agentDiscordId,
      metricCategory: input.metricCategory as typeof agentScoreEvents.$inferInsert.metricCategory,
      pointSource: "configured_table",
      pointsApproved: input.pointsApproved,
      pointsTableVersion: 1,
      creditedBy: input.creditedBy,
      status: "credited",
    });

    await tx
      .update(evidence)
      .set({ status: "credited", creditedAt: new Date() })
      .where(eq(evidence.id, input.evidenceId));

    await completeIdempotencyKey(idempotencyKey, { credited: true }, tx);
  });
}

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
    sensitivity: input.sensitivity ?? "officer_only",
    payload: input.payload ?? {},
    discordMessageId: input.discordMessageId,
  });
}

export async function findStaleEvidence(
  guildId: string,
  now = new Date(),
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
      and(
        eq(evidence.guildId, guildId),
        eq(evidence.status, "under_review"),
        lte(evidence.staleAfter, now),
        isNull(evidence.staleNotifiedAt),
      ),
    );

  return rows;
}

export async function markEvidenceStale(evidenceId: string): Promise<void> {
  await db
    .update(evidence)
    .set({ status: "stale_review", staleNotifiedAt: new Date() })
    .where(eq(evidence.id, evidenceId));
}

export async function directorOverrideEvidence(
  evidenceId: string,
  directorDiscordId: string,
  reason: string,
  guildId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(evidence)
      .set({ status: "validated", validatedAt: new Date() })
      .where(eq(evidence.id, evidenceId))
      .returning({ id: evidence.id });

    if (updated.length === 0) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }

    await tx.insert(auditLog).values({
      guildId,
      actorDiscordId: directorDiscordId,
      action: "director_override",
      subjectType: "evidence",
      subjectId: evidenceId,
      sensitivity: "director_only",
      payload: { reason } as Record<string, unknown>,
    });
  });
}

function getReviewIdempotencyResult(payload: Record<string, unknown> | null): AddReviewResult | null {
  if (!payload || typeof payload.id !== "string" || typeof payload.quorumReached !== "boolean") {
    return null;
  }
  return { id: payload.id, quorumReached: payload.quorumReached };
}
