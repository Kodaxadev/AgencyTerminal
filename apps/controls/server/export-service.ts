import type {
  Capability,
  ExportDescriptorDto,
  ExportPayloadDto,
  ExportType,
  SensitivityLevel,
} from "../src/contracts";

const EXPORT_DESCRIPTORS: ExportDescriptorDto[] = [
  {
    type: "ledger",
    label: "Ledger export",
    sensitivity: "director_only",
    requiresConfirmation: true,
    requiredCapabilities: ["can_view_audit", "can_validate_evidence", "can_manage_config"],
  },
  {
    type: "agents",
    label: "Agent export",
    sensitivity: "officer_only",
    requiresConfirmation: false,
    requiredCapabilities: ["can_view_audit", "can_manage_config"],
  },
  {
    type: "audit",
    label: "Audit export",
    sensitivity: "director_only",
    requiresConfirmation: true,
    requiredCapabilities: ["can_view_audit", "can_manage_config"],
  },
  {
    type: "tickets",
    label: "Ticket export",
    sensitivity: "director_only",
    requiresConfirmation: false,
    requiredCapabilities: ["can_view_all_tickets", "can_manage_config"],
  },
  {
    type: "retention",
    label: "Retention report",
    sensitivity: "officer_only",
    requiresConfirmation: false,
    requiredCapabilities: ["can_manage_config"],
  },
];
const REDACTED = "[REDACTED]";
const REDACTED_FIELDS = new Set([
  "backfillReason",
  "characterName",
  "clientAffiliation",
  "clientName",
  "conflictReason",
  "description",
  "eventPayload",
  "evidenceUrl",
  "explanation",
  "externalReference",
  "objective",
  "outcomeReason",
  "parsedSummary",
  "paymentTerms",
  "payload",
  "rationale",
  "reason",
  "requestedOutcome",
  "reversalReason",
  "smartObjectId",
  "sourceUrl",
  "statement",
  "storageUrl",
  "summary",
  "systemName",
  "targetName",
  "targetTribe",
  "tribeName",
  "url",
  "walletAddress",
]);

export function listExportDescriptors(): ExportDescriptorDto[] {
  return EXPORT_DESCRIPTORS.map((descriptor) => ({
    ...descriptor,
    requiredCapabilities: [...descriptor.requiredCapabilities],
  }));
}

export function listAuthorizedExportDescriptors(capabilities: Capability[]): ExportDescriptorDto[] {
  return listExportDescriptors().filter((descriptor) => (
    descriptor.requiredCapabilities.some((capability) => capabilities.includes(capability))
  ));
}

export function requireExportCapability(type: ExportType, capabilities: Capability[]): void {
  const descriptor = getExportDescriptor(type);
  if (!descriptor.requiredCapabilities.some((capability) => capabilities.includes(capability))) {
    throw new Error("Missing required controls capability");
  }
}

export function normalizeExportType(value: unknown): ExportType {
  if (typeof value !== "string") throw new Error("Invalid export type");
  const descriptor = EXPORT_DESCRIPTORS.find((item) => item.type === value);
  if (!descriptor) throw new Error("Invalid export type");
  return descriptor.type;
}

export function requireExportConfirmation(type: ExportType, confirmation: string | undefined): void {
  const descriptor = getExportDescriptor(type);
  if (descriptor.requiresConfirmation && confirmation !== "EXPORT") {
    throw new Error("Type EXPORT to continue");
  }
}

export function buildExportPayload(
  type: ExportType,
  guildId: string,
  rows: unknown[],
  generatedAt: Date,
): ExportPayloadDto {
  const descriptor = getExportDescriptor(type);
  return {
    type,
    guildId,
    generatedAt: generatedAt.toISOString(),
    sensitivity: descriptor.sensitivity,
    recordCount: rows.length,
    rows: rows.map(redactExportRow),
  };
}

function getExportDescriptor(type: ExportType): {
  sensitivity: SensitivityLevel;
  requiresConfirmation: boolean;
  requiredCapabilities: Capability[];
} {
  const descriptor = EXPORT_DESCRIPTORS.find((item) => item.type === type);
  if (!descriptor) throw new Error("Invalid export type");
  return descriptor;
}

function redactExportRow(row: unknown): unknown {
  if (!isRecord(row)) return row;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    REDACTED_FIELDS.has(key) ? redactValue(value) : value,
  ]));
}

function redactValue(value: unknown): unknown {
  return value === null || value === undefined || value === "" ? value : REDACTED;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
