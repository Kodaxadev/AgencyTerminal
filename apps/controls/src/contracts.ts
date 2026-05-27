export const CAPABILITIES = [
  "can_view_all_tickets",
  "can_validate_evidence",
  "can_override_quorum",
  "can_reverse_score",
  "can_manage_clearance",
  "can_manage_contracts",
  "can_manage_intel",
  "can_manage_config",
  "can_manage_enlistment",
  "can_view_audit",
  "can_view_sensitive_contracts",
  "can_view_sensitive_intel",
  "can_backfill_evidence",
  "can_review_appeals",
] as const;

export type Capability = typeof CAPABILITIES[number];

export interface RoleCapabilityMapping {
  discordRoleId: string;
  capability: Capability;
}

export interface ControlsUser {
  id: string;
  username: string;
  globalName?: string;
  avatarUrl?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  controlsEnabled: boolean;
  user?: ControlsUser;
  guildId?: string;
  capabilities: Capability[];
}

export type HealthStatus = "ok" | "warn" | "fail";

export interface HealthCheckDto {
  id: string;
  label: string;
  status: HealthStatus;
  lastCheckedAt: string;
  detail?: string;
  remediation?: string;
}

export interface GuildConfigDto {
  guildId: string;
  name: string;
  adminChannelId?: string;
  auditChannelId?: string;
  opsQueueChannelId?: string;
  archiveChannelId?: string;
  doctrineChangesChannelId?: string;
  staleReviewHours: number;
}

export interface RoleMappingDto {
  id: string;
  guildId: string;
  capability: Capability;
  discordRoleId: string;
  createdAt: string;
}

export interface MetricConfigDto {
  id: string;
  category: string;
  basePoints: number;
  visibility: string;
  enabled: boolean;
  version: number;
}

export interface AuditLogDto {
  id: string;
  actorDiscordId?: string;
  action: string;
  subjectType: string;
  subjectId: string;
  sensitivity: string;
  createdAt: string;
}

export interface EvidenceQueueItemDto {
  id: string;
  shortId?: string;
  title: string;
  metricCategory: string;
  status: string;
  sensitivity: string;
  submittedByDiscordId: string;
  subjectDiscordId?: string;
  createdAt: string;
}

export interface TicketQueueItemDto {
  id: string;
  shortId?: string;
  channelId: string;
  type: string;
  status: string;
  lifecycleStatus: string;
  priority: string;
  sensitivity: string;
  title: string;
  createdAt: string;
}

export type RetentionClass =
  | "ticket_channel"
  | "ticket_transcript"
  | "evidence_record"
  | "evidence_attachment_copy"
  | "audit_log"
  | "score_event"
  | "score_reversal"
  | "intel_sensitive"
  | "contract_terms"
  | "doctrine_challenge";

export type RetentionAction = "retain" | "archive" | "delete" | "redact";
export type SensitivityLevel = "public" | "member" | "officer_only" | "director_only";

export interface RetentionPolicyDto {
  id?: string;
  guildId: string;
  class: RetentionClass;
  retainDays?: number;
  action: RetentionAction;
  sensitivity: SensitivityLevel;
  enabled: boolean;
  protected: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RetentionPolicyInput {
  class: string;
  retainDays?: number | null;
  action: string;
  sensitivity: string;
  enabled: boolean;
  confirmation?: string;
}

export interface RetentionClassCountDto {
  class: RetentionClass;
  action: RetentionAction;
  eligibleCount: number;
  protected: boolean;
}

export interface RetentionDryRunDto {
  token: string;
  generatedAt: string;
  rows: RetentionClassCountDto[];
  totalEligible: number;
  destructiveCount: number;
}

export interface RetentionRunDto {
  token: string;
  ranAt: string;
  executed: boolean;
  message: string;
  rows: RetentionClassCountDto[];
  totalEligible: number;
  destructiveCount: number;
}

export type ExportType = "ledger" | "agents" | "audit" | "tickets" | "retention";

export interface ExportDescriptorDto {
  type: ExportType;
  label: string;
  sensitivity: SensitivityLevel;
  requiresConfirmation: boolean;
  requiredCapabilities: Capability[];
}

export interface ExportPayloadDto {
  type: ExportType;
  guildId: string;
  generatedAt: string;
  sensitivity: SensitivityLevel;
  recordCount: number;
  rows: unknown[];
}

export interface ExportRequestDto {
  type: string;
  confirmation?: string;
}

export interface OverviewDto {
  statusCode: 200 | 206 | 503;
  statusLabel: string;
  guild: GuildConfigDto;
  health: HealthCheckDto[];
  counts: {
    openTickets: number;
    staleEvidence: number;
    pendingQuorum: number;
    failedDiscordProjections: number;
    outboxPending: number;
    outboxDead: number;
  };
}

export interface DeploymentStatusDto {
  inviteUrl?: string;
  requiredEnv: Array<{ key: string; present: boolean }>;
  actions: Array<{ id: string; label: string; confirmation: string }>;
}
