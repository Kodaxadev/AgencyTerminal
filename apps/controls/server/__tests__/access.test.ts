import { describe, expect, it } from "vitest";
import {
  canAccessPath,
  getBootstrapCapabilities,
  hasRequiredCapability,
  resolveCapabilities,
} from "../auth/access";
import type { Capability } from "../../src/contracts";

describe("controls access policy", () => {
  it("grants full operator capabilities only to configured bootstrap Discord IDs", () => {
    const allowed = getBootstrapCapabilities("leader-1", ["leader-1", "leader-2"]);
    const denied = getBootstrapCapabilities("member-1", ["leader-1"]);

    expect(allowed).toContain("can_manage_config");
    expect(allowed).toContain("can_view_audit");
    expect(allowed).toContain("can_validate_evidence");
    expect(denied).toEqual([]);
  });

  it("resolves capabilities from Discord role mappings without duplicates", () => {
    const capabilities = resolveCapabilities({
      discordUserId: "handler-1",
      discordRoleIds: ["role-handler", "role-audit", "role-handler"],
      roleMappings: [
        { discordRoleId: "role-handler", capability: "can_validate_evidence" },
        { discordRoleId: "role-audit", capability: "can_view_audit" },
        { discordRoleId: "role-other", capability: "can_manage_config" },
      ],
      bootstrapDiscordIds: [],
    });

    expect(capabilities).toEqual(["can_validate_evidence", "can_view_audit"]);
  });

  it("requires server-side page capabilities and fails closed for unknown routes", () => {
    const handlerCaps: Capability[] = ["can_validate_evidence"];
    const operatorCaps: Capability[] = ["can_manage_config"];

    expect(canAccessPath("/evidence", handlerCaps)).toBe(true);
    expect(canAccessPath("/config", handlerCaps)).toBe(false);
    expect(canAccessPath("/deployment", operatorCaps)).toBe(true);
    expect(canAccessPath("/unknown", operatorCaps)).toBe(false);
  });

  it("allows audit access to audit viewers or config managers", () => {
    expect(hasRequiredCapability("/audit", ["can_view_audit"])).toBe(true);
    expect(hasRequiredCapability("/audit", ["can_manage_config"])).toBe(true);
    expect(hasRequiredCapability("/audit", ["can_validate_evidence"])).toBe(false);
  });
});
