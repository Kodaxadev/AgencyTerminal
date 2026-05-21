// Score event interfaces — type unions are defined inline to avoid circular imports.

export type MetricCategory =
  | "pvp_kill_value"
  | "fleet_participation"
  | "contracts_completed"
  | "intelligence_acquisitions"
  | "technical_development_output"
  | "asset_contributions"
  | "exploration"
  | "lore_discovery";

export type PointSource = "configured_table" | "director_override" | "manual_adjustment";
export type ScoreStatus = "credited" | "reversed";
export type ScoreCorrectionType = "restore_reversed_score" | "adjust_score_after_review";

export interface ScoreEvent {
  id: string;
  guildId: string;
  evidenceId: string;
  agentDiscordId: string;
  characterName?: string;
  walletAddress?: string;
  metricCategory: MetricCategory;
  pointSource: PointSource;
  pointsApproved: number;
  pointsTableVersion: number;
  creditedBy: string;
  creditedAt: Date;
  status: ScoreStatus;
  reversalReason?: string;
}

export interface ScoreReversal {
  id: string;
  scoreEventId: string;
  requestedBy: string;
  corroboratedBy: string;
  reason: string;
  evidenceUrl?: string;
  auditMessageId?: string;
  createdAt: Date;
}

export interface ScoreCorrection {
  id: string;
  scoreEventId: string;
  reversalId?: string;
  correctionType: ScoreCorrectionType;
  requestedBy: string;
  reason: string;
  newPoints?: number;
  createdAt: Date;
}
