import type { Capability } from "../../apps/controls/src/contracts";

export const SEAT_USER_PREFIX = "matrix-seat-";

export interface Seat {
  name: string;
  userId: string;
  capabilities: Capability[];
}

export const SEATS: Seat[] = [
  { name: "recruiter",          userId: `${SEAT_USER_PREFIX}recruiter`,          capabilities: ["can_manage_enlistment"] },
  { name: "contracts",          userId: `${SEAT_USER_PREFIX}contracts`,          capabilities: ["can_manage_contracts"] },
  { name: "intel",              userId: `${SEAT_USER_PREFIX}intel`,              capabilities: ["can_manage_intel"] },
  { name: "clearance",          userId: `${SEAT_USER_PREFIX}clearance`,          capabilities: ["can_manage_clearance"] },
  { name: "validator",          userId: `${SEAT_USER_PREFIX}validator`,          capabilities: ["can_validate_evidence"] },
  { name: "auditor",            userId: `${SEAT_USER_PREFIX}auditor`,            capabilities: ["can_view_audit"] },
  { name: "viewer-all-tickets", userId: `${SEAT_USER_PREFIX}viewer-all-tickets`, capabilities: ["can_view_all_tickets"] },
  { name: "config-admin",       userId: `${SEAT_USER_PREFIX}config-admin`,       capabilities: ["can_manage_config"] },
  { name: "intel-director",     userId: `${SEAT_USER_PREFIX}intel-director`,     capabilities: ["can_manage_intel", "can_view_sensitive_intel"] },
  { name: "contract-director",  userId: `${SEAT_USER_PREFIX}contract-director`,  capabilities: ["can_manage_contracts", "can_view_sensitive_contracts"] },
];
