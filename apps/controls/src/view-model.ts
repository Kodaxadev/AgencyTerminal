import type { Capability } from "./contracts";

export type Tone = "ok" | "warn" | "fail";

export interface NavigationItem {
  href: string;
  label: string;
  capabilities: Capability[] | "any";
}

export const NAVIGATION: NavigationItem[] = [
  { href: "/", label: "Overview", capabilities: "any" },
  { href: "/health", label: "Health", capabilities: ["can_manage_config"] },
  { href: "/config", label: "Config", capabilities: ["can_manage_config"] },
  { href: "/roles", label: "Roles", capabilities: ["can_manage_config"] },
  { href: "/metrics", label: "Metrics", capabilities: ["can_manage_config"] },
  { href: "/evidence", label: "Evidence", capabilities: ["can_validate_evidence"] },
  { href: "/tickets", label: "Tickets", capabilities: ["can_view_all_tickets", "can_manage_enlistment"] },
  { href: "/audit", label: "Audit", capabilities: ["can_view_audit", "can_manage_config"] },
  { href: "/deployment", label: "Deployment", capabilities: ["can_manage_config"] },
];

export function visibleNavigation(capabilities: Capability[]): NavigationItem[] {
  return NAVIGATION.filter((item) => {
    if (item.capabilities === "any") return capabilities.length > 0;
    return item.capabilities.some((capability) => capabilities.includes(capability));
  });
}

export function getStatusTone(statusCode: number): Tone {
  if (statusCode === 200) return "ok";
  if (statusCode < 500) return "warn";
  return "fail";
}
