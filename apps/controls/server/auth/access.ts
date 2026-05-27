import type { Capability, RoleCapabilityMapping } from "../../src/contracts";

const BOOTSTRAP_CAPABILITIES: Capability[] = [
  "can_manage_config",
  "can_view_audit",
  "can_validate_evidence",
  "can_manage_contracts",
  "can_manage_intel",
  "can_manage_clearance",
  "can_override_quorum",
  "can_reverse_score",
  "can_backfill_evidence",
  "can_review_appeals",
  "can_view_all_tickets",
  "can_view_sensitive_contracts",
  "can_view_sensitive_intel",
  "can_manage_enlistment",
];

const PAGE_REQUIREMENTS: Record<string, Capability[] | "any"> = {
  "/": "any",
  "/controls": "any",
  "/health": ["can_manage_config"],
  "/controls/health": ["can_manage_config"],
  "/config": ["can_manage_config"],
  "/controls/config": ["can_manage_config"],
  "/roles": ["can_manage_config"],
  "/controls/roles": ["can_manage_config"],
  "/metrics": ["can_manage_config"],
  "/controls/metrics": ["can_manage_config"],
  "/evidence": ["can_validate_evidence", "can_view_audit", "can_manage_config"],
  "/controls/evidence": ["can_validate_evidence", "can_view_audit", "can_manage_config"],
  "/contracts": ["can_manage_contracts"],
  "/controls/contracts": ["can_manage_contracts"],
  "/clearance": ["can_manage_clearance"],
  "/controls/clearance": ["can_manage_clearance"],
  "/tickets": ["can_view_all_tickets", "can_manage_enlistment", "can_view_audit", "can_manage_config"],
  "/controls/tickets": ["can_view_all_tickets", "can_manage_enlistment", "can_view_audit", "can_manage_config"],
  "/audit": ["can_view_audit", "can_manage_config"],
  "/controls/audit": ["can_view_audit", "can_manage_config"],
  "/retention": ["can_manage_config"],
  "/controls/retention": ["can_manage_config"],
  "/exports": ["can_manage_config", "can_view_audit", "can_view_all_tickets", "can_validate_evidence"],
  "/controls/exports": ["can_manage_config", "can_view_audit", "can_view_all_tickets", "can_validate_evidence"],
  "/deployment": ["can_manage_config"],
  "/controls/deployment": ["can_manage_config"],
};

export function getBootstrapCapabilities(
  discordUserId: string,
  bootstrapDiscordIds: string[],
): Capability[] {
  return bootstrapDiscordIds.includes(discordUserId) ? [...BOOTSTRAP_CAPABILITIES] : [];
}

export function resolveCapabilities(input: {
  discordUserId: string;
  discordRoleIds: string[];
  roleMappings: RoleCapabilityMapping[];
  bootstrapDiscordIds: string[];
}): Capability[] {
  const capabilities = new Set<Capability>(
    getBootstrapCapabilities(input.discordUserId, input.bootstrapDiscordIds),
  );
  const roleIds = new Set(input.discordRoleIds);

  for (const mapping of input.roleMappings) {
    if (roleIds.has(mapping.discordRoleId)) {
      capabilities.add(mapping.capability);
    }
  }

  return Array.from(capabilities);
}

export function hasRequiredCapability(pathname: string, capabilities: Capability[]): boolean {
  const requirement = PAGE_REQUIREMENTS[normalizePath(pathname)];
  if (!requirement) return false;
  if (requirement === "any") return capabilities.length > 0;
  return requirement.some((capability) => capabilities.includes(capability));
}

export function canAccessPath(pathname: string, capabilities: Capability[]): boolean {
  return hasRequiredCapability(pathname, capabilities);
}

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}
