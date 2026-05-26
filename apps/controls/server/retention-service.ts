import { createHash } from "node:crypto";
import type {
  RetentionAction,
  RetentionClass,
  RetentionClassCountDto,
  RetentionDryRunDto,
  RetentionPolicyDto,
  RetentionPolicyInput,
  RetentionRunDto,
  SensitivityLevel,
} from "../src/contracts";

export const RETENTION_CLASSES: RetentionClass[] = [
  "ticket_channel",
  "ticket_transcript",
  "evidence_record",
  "evidence_attachment_copy",
  "audit_log",
  "score_event",
  "score_reversal",
  "intel_sensitive",
  "contract_terms",
  "doctrine_challenge",
];

export const PROTECTED_RETENTION_CLASSES: RetentionClass[] = [
  "evidence_record",
  "audit_log",
  "score_event",
  "score_reversal",
];

const RETENTION_ACTIONS: RetentionAction[] = ["retain", "archive", "delete", "redact"];
const SENSITIVITY_LEVELS: SensitivityLevel[] = ["public", "member", "officer_only", "director_only"];

export interface RetentionPolicyRow {
  id?: string;
  guildId: string;
  class: RetentionClass;
  retainDays?: number | null;
  action: string;
  sensitivity: SensitivityLevel;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RetentionDryRunInputRow {
  class: RetentionClass;
  action: RetentionAction;
  eligibleCount: number;
  protected?: boolean;
}

export interface NormalizedRetentionPolicyInput {
  class: RetentionClass;
  retainDays?: number;
  action: RetentionAction;
  sensitivity: SensitivityLevel;
  enabled: boolean;
}

export function normalizeRetentionPolicyInput(input: RetentionPolicyInput): NormalizedRetentionPolicyInput {
  const retentionClass = requireOneOf(input.class, RETENTION_CLASSES, "retention class");
  const action = requireOneOf(input.action, RETENTION_ACTIONS, "retention action");
  const sensitivity = requireOneOf(input.sensitivity, SENSITIVITY_LEVELS, "sensitivity");
  if (typeof input.enabled !== "boolean") throw new Error("enabled must be boolean");
  if (input.retainDays === null || input.retainDays === undefined) {
    return { class: retentionClass, action, sensitivity, enabled: input.enabled };
  }
  if (!Number.isInteger(input.retainDays) || input.retainDays < 0) {
    throw new Error("retainDays must be zero or greater");
  }
  return { class: retentionClass, retainDays: input.retainDays, action, sensitivity, enabled: input.enabled };
}

export function buildRetentionPolicyDtos(guildId: string, rows: RetentionPolicyRow[]): RetentionPolicyDto[] {
  const byClass = new Map(rows.map((row) => [row.class, row]));
  return RETENTION_CLASSES.map((retentionClass) => {
    const row = byClass.get(retentionClass);
    return {
      id: row?.id,
      guildId,
      class: retentionClass,
      retainDays: row?.retainDays ?? undefined,
      action: (row?.action as RetentionAction | undefined) ?? "retain",
      sensitivity: row?.sensitivity ?? "officer_only",
      enabled: row?.enabled ?? true,
      protected: PROTECTED_RETENTION_CLASSES.includes(retentionClass),
      createdAt: row?.createdAt?.toISOString(),
      updatedAt: row?.updatedAt?.toISOString(),
    };
  });
}

export function buildRetentionDryRun(rows: RetentionDryRunInputRow[], now: Date): RetentionDryRunDto {
  const normalizedRows = rows.map((row) => ({
    class: row.class,
    action: row.action,
    eligibleCount: row.eligibleCount,
    protected: row.protected ?? PROTECTED_RETENTION_CLASSES.includes(row.class),
  }));
  return {
    token: buildDryRunToken(normalizedRows),
    generatedAt: now.toISOString(),
    rows: normalizedRows,
    totalEligible: normalizedRows.reduce((total, row) => total + row.eligibleCount, 0),
    destructiveCount: normalizedRows.reduce((total, row) => total + (isDestructive(row) ? row.eligibleCount : 0), 0),
  };
}

export function buildRetentionRunReport(input: {
  dryRun: RetentionDryRunDto;
  dryRunToken: string;
  confirmation: string;
  ranAt: Date;
}): RetentionRunDto {
  if (input.confirmation !== "RETENTION") throw new Error("Type RETENTION to continue");
  if (input.dryRunToken !== input.dryRun.token) throw new Error("Run requires the latest dry-run token");
  return {
    token: input.dryRun.token,
    ranAt: input.ranAt.toISOString(),
    executed: false,
    message: "Retention execution is report-only until archive storage is enabled.",
    rows: input.dryRun.rows,
    totalEligible: input.dryRun.totalEligible,
    destructiveCount: input.dryRun.destructiveCount,
  };
}

function requireOneOf<T extends string>(value: unknown, allowed: T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${label}`);
  return value as T;
}

function isDestructive(row: RetentionClassCountDto): boolean {
  return !row.protected && (row.action === "delete" || row.action === "redact");
}

function buildDryRunToken(rows: RetentionClassCountDto[]): string {
  return `retention:${createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16)}`;
}
