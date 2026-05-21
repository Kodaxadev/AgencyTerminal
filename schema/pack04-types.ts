// Agency Terminal Pack 04 type additions.

export type EvidenceSubjectRole = "primary" | "supporting" | "witness_only";

export type EvidenceWitnessType =
  | "participant"
  | "observer"
  | "officer"
  | "external_source";

export type SubmittedMode = "live_bot" | "manual_backfill" | "imported";

export type AppealStatus =
  | "requested"
  | "under_review"
  | "granted"
  | "denied"
  | "final";

export type AppealGround =
  | "new_evidence"
  | "procedural_error"
  | "wrong_subject"
  | "wrong_metric"
  | "wrong_points"
  | "duplicate_error"
  | "reversal_error";

export type EvidenceQualityTier = "A" | "B" | "C" | "D" | "F";

export type EvidenceSubject = {
  id: string;
  evidenceId: string;
  subjectDiscordId: string;
  role: EvidenceSubjectRole;
  pointMultiplier: number;
  note?: string;
  createdAt: string;
};

export type EvidenceWitness = {
  id: string;
  evidenceId: string;
  witnessDiscordId?: string;
  witnessType: EvidenceWitnessType;
  statement?: string;
  externalReference?: string;
  createdAt: string;
};

export type EvidenceAppeal = {
  id: string;
  evidenceId: string;
  requestedBy: string;
  status: AppealStatus;
  ground: AppealGround;
  explanation: string;
  requestedOutcome: string;
  reviewerDiscordId?: string;
  outcomeReason?: string;
  final: boolean;
  createdAt: string;
  decidedAt?: string;
};

export type EvidenceSubmissionModeFields = {
  eventOccurredAt?: string;
  submittedMode: SubmittedMode;
  backfillReason?: string;
  backfilledBy?: string;
};

export type EvidenceReviewConflictFields = {
  conflictDisclosed: boolean;
  conflictReason?: string;
};

export type ScoreCreditTarget = {
  evidenceId: string;
  subjectDiscordId: string;
  metricCategory: string;
  pointMultiplier: number;
  calculatedPoints: number;
};
