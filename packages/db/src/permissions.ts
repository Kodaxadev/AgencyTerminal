import { and, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { roleMappings } from "../schema/drizzle-schema";

export type Capability =
  | "can_view_all_tickets"
  | "can_validate_evidence"
  | "can_override_quorum"
  | "can_reverse_score"
  | "can_manage_clearance"
  | "can_manage_contracts"
  | "can_manage_intel"
  | "can_manage_config";

export async function getCapabilitiesForRoles(
  guildId: string,
  discordRoleIds: string[],
): Promise<Capability[]> {
  if (discordRoleIds.length === 0) return [];

  const rows = await db
    .select({ capability: roleMappings.capability })
    .from(roleMappings)
    .where(
      and(
        eq(roleMappings.guildId, guildId),
        inArray(roleMappings.discordRoleId, discordRoleIds),
      ),
    );

  return Array.from(new Set(rows.map((row) => row.capability as Capability)));
}
