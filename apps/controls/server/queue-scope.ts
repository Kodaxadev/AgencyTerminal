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

export function canViewSensitivity(sensitivity: SensitivityLevel, capabilities: Capability[]): boolean {
  if (sensitivity !== "director_only") return true;
  return capabilities.some((capability) => (
    capability === "can_manage_config" ||
    capability === "can_view_sensitive_intel" ||
    capability === "can_view_sensitive_contracts"
  ));
}
