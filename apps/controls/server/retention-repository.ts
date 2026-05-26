import {
  auditLog,
  evidenceAttachmentCopies,
  retentionPolicies,
  ticketTranscripts,
} from "../../../packages/db/schema/drizzle-schema";
import { db } from "../../../packages/db/src/client";
import { and, eq, lte, sql } from "../../../packages/db/src/query";
import type {
  RetentionClass,
  RetentionDryRunDto,
  RetentionPolicyDto,
  RetentionPolicyInput,
  RetentionRunDto,
} from "../src/contracts";
import {
  RETENTION_CLASSES,
  buildRetentionDryRun,
  buildRetentionPolicyDtos,
  buildRetentionRunReport,
  normalizeRetentionPolicyInput,
} from "./retention-service";

export async function listRetentionPolicies(guildId: string): Promise<RetentionPolicyDto[]> {
  const rows = await db.select().from(retentionPolicies).where(eq(retentionPolicies.guildId, guildId));
  return buildRetentionPolicyDtos(guildId, rows);
}

export async function saveRetentionPolicy(
  input: RetentionPolicyInput & { guildId: string },
  actorDiscordId: string,
): Promise<RetentionPolicyDto> {
  const normalized = normalizeRetentionPolicyInput(input);
  const values = {
    guildId: input.guildId,
    class: normalized.class,
    retainDays: normalized.retainDays ?? null,
    action: normalized.action,
    sensitivity: normalized.sensitivity,
    enabled: normalized.enabled,
    updatedAt: new Date(),
  };
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(retentionPolicies).values(values).onConflictDoUpdate({
      target: [retentionPolicies.guildId, retentionPolicies.class],
      set: values,
    }).returning();
    await tx.insert(auditLog).values({
      guildId: input.guildId,
      actorDiscordId,
      action: "controls_retention_policy_saved",
      subjectType: "retention_policy",
      subjectId: row.id,
      payload: {},
      sensitivity: "officer_only",
    });
    return buildRetentionPolicyDtos(input.guildId, [row]).find((policy) => policy.class === row.class)!;
  });
}

export async function dryRunRetention(guildId: string): Promise<RetentionDryRunDto> {
  const now = new Date();
  const [policies, counts] = await Promise.all([
    listRetentionPolicies(guildId),
    countRetentionEligibleRows(guildId, now),
  ]);
  return buildRetentionDryRun(policies.map((policy) => ({
    class: policy.class,
    action: policy.enabled ? policy.action : "retain",
    eligibleCount: policy.enabled ? counts[policy.class] : 0,
    protected: policy.protected,
  })), now);
}

export async function runRetention(
  guildId: string,
  dryRunToken: string,
  actorDiscordId: string,
  confirmation: string,
): Promise<RetentionRunDto> {
  const dryRun = await dryRunRetention(guildId);
  const report = buildRetentionRunReport({ dryRun, dryRunToken, confirmation, ranAt: new Date() });
  await writeRetentionAudit(guildId, actorDiscordId, "controls_retention_run_reported", guildId, {
    token: report.token,
    totalEligible: report.totalEligible,
    destructiveCount: report.destructiveCount,
    executed: report.executed,
  });
  return report;
}

async function countRetentionEligibleRows(guildId: string, now: Date): Promise<Record<RetentionClass, number>> {
  const counts = Object.fromEntries(RETENTION_CLASSES.map((retentionClass) => [retentionClass, 0])) as Record<RetentionClass, number>;
  const [transcripts, attachments] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(ticketTranscripts)
      .where(and(eq(ticketTranscripts.guildId, guildId), lte(ticketTranscripts.deleteAfter, now))),
    db.select({ count: sql<number>`count(*)::int` }).from(evidenceAttachmentCopies)
      .where(and(eq(evidenceAttachmentCopies.guildId, guildId), lte(evidenceAttachmentCopies.deleteAfter, now))),
  ]);
  counts.ticket_transcript = Number(transcripts[0]?.count ?? 0);
  counts.evidence_attachment_copy = Number(attachments[0]?.count ?? 0);
  return counts;
}

async function writeRetentionAudit(
  guildId: string,
  actorDiscordId: string,
  action: string,
  subjectId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(auditLog).values({
    guildId,
    actorDiscordId,
    action,
    subjectType: "retention_policy",
    subjectId,
    payload,
    sensitivity: "officer_only",
  });
}
