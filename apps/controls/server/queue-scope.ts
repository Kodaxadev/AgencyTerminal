import { normalizePath } from "./auth/access";
import type { Capability, SensitivityLevel } from "../src/contracts";

export type QueueScopeKind = "intel_evidence" | "contract_tickets" | "clearance_tickets";

export interface QueueScope {
  kind: QueueScopeKind;
  requiredCapability: Capability;
}

const QUEUE_SCOPES: Record<string, QueueScope> = {
  "/api/evidence/intel": { kind: "intel_evidence", requiredCapability: "can_manage_intel" },
  "/api/contracts": { kind: "contract_tickets", requiredCapability: "can_manage_contracts" },
  "/api/clearance": { kind: "clearance_tickets", requiredCapability: "can_manage_clearance" },
};

export function getQueueScope(pathname: string, capabilities: Capability[]): QueueScope {
  const scope = QUEUE_SCOPES[normalizePath(pathname)];
  if (!scope) throw new Error("Unknown queue scope");
  if (!capabilities.includes(scope.requiredCapability)) {
    throw new Error(`Missing required capability: ${scope.requiredCapability}`);
  }
  return scope;
}

export type SensitivityDomain = QueueScopeKind;

export function canViewSensitivity(
  domain: SensitivityDomain,
  sensitivity: SensitivityLevel,
  capabilities: Capability[],
): boolean {
  if (sensitivity !== "director_only") return true;
  if (capabilities.includes("can_manage_config")) return true;
  if (domain === "intel_evidence") return capabilities.includes("can_view_sensitive_intel");
  if (domain === "contract_tickets") return capabilities.includes("can_view_sensitive_contracts");
  return false;
}

export function canSeeEvidenceDomain(metricCategory: string, capabilities: Capability[]): boolean {
  if (capabilities.includes("can_manage_config")) return true;
  if (capabilities.includes("can_view_audit")) return true;
  if (capabilities.includes("can_validate_evidence")) return true;
  if (metricCategory === "intelligence_acquisitions") {
    return capabilities.includes("can_manage_intel") || capabilities.includes("can_view_sensitive_intel");
  }
  if (metricCategory === "contracts_completed") {
    return capabilities.includes("can_manage_contracts") || capabilities.includes("can_view_sensitive_contracts");
  }
  return false;
}

export function canViewEvidenceRow(
  metricCategory: string,
  sensitivity: SensitivityLevel,
  capabilities: Capability[],
): boolean {
  if (!canSeeEvidenceDomain(metricCategory, capabilities)) return false;
  if (sensitivity !== "director_only") return true;
  if (capabilities.includes("can_manage_config")) return true;
  if (metricCategory === "intelligence_acquisitions") {
    return capabilities.includes("can_view_sensitive_intel");
  }
  return false;
}

export function canSeeTicketDomain(ticketType: string, capabilities: Capability[]): boolean {
  if (capabilities.includes("can_manage_config")) return true;
  if (capabilities.includes("can_view_audit")) return true;
  if (capabilities.includes("can_view_all_tickets")) return true;
  if (ticketType === "enlistment") return capabilities.includes("can_manage_enlistment");
  if (ticketType === "contract") {
    return capabilities.includes("can_manage_contracts") || capabilities.includes("can_view_sensitive_contracts");
  }
  if (ticketType === "intel") {
    return capabilities.includes("can_manage_intel") || capabilities.includes("can_view_sensitive_intel");
  }
  if (ticketType === "clearance") return capabilities.includes("can_manage_clearance");
  if (ticketType === "performance_evidence") return capabilities.includes("can_validate_evidence");
  if (ticketType === "doctrine_challenge") {
    return capabilities.includes("can_review_appeals") || capabilities.includes("can_validate_evidence");
  }
  return false;
}

export function canViewTicketRow(
  ticketType: string,
  sensitivity: SensitivityLevel,
  capabilities: Capability[],
): boolean {
  if (!canSeeTicketDomain(ticketType, capabilities)) return false;
  if (sensitivity !== "director_only") return true;
  if (capabilities.includes("can_manage_config")) return true;
  if (ticketType === "contract") return capabilities.includes("can_view_sensitive_contracts");
  if (ticketType === "intel") return capabilities.includes("can_view_sensitive_intel");
  return false;
}
