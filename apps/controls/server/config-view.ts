import type { GuildConfigDto } from "../src/contracts";

export interface GuildConfigRow {
  guildId: string;
  name: string;
  adminChannelId?: string | null;
  auditChannelId?: string | null;
  opsQueueChannelId?: string | null;
  archiveChannelId?: string | null;
  doctrineChangesChannelId?: string | null;
  staleReviewHours: number;
}

export function buildGuildConfigValues(input: GuildConfigDto, updatedAt: Date) {
  return {
    guildId: input.guildId,
    name: input.name,
    adminChannelId: input.adminChannelId,
    auditChannelId: input.auditChannelId,
    opsQueueChannelId: input.opsQueueChannelId,
    archiveChannelId: input.archiveChannelId,
    doctrineChangesChannelId: input.doctrineChangesChannelId,
    staleReviewHours: input.staleReviewHours,
    updatedAt,
  };
}

export function toGuildConfigDto(row: GuildConfigRow): GuildConfigDto {
  return {
    guildId: row.guildId,
    name: row.name,
    adminChannelId: row.adminChannelId ?? undefined,
    auditChannelId: row.auditChannelId ?? undefined,
    opsQueueChannelId: row.opsQueueChannelId ?? undefined,
    archiveChannelId: row.archiveChannelId ?? undefined,
    doctrineChangesChannelId: row.doctrineChangesChannelId ?? undefined,
    staleReviewHours: row.staleReviewHours,
  };
}
