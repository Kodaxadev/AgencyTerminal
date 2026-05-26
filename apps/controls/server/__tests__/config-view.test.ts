import { describe, expect, it } from "vitest";
import { buildGuildConfigValues, toGuildConfigDto } from "../config-view";

describe("controls guild config view", () => {
  it("maps admin channel ID from database rows into the controls DTO", () => {
    const dto = toGuildConfigDto({
      guildId: "guild-1",
      name: "Agency",
      adminChannelId: "admin-channel-1",
      auditChannelId: "audit-channel-1",
      opsQueueChannelId: "ops-channel-1",
      archiveChannelId: null,
      doctrineChangesChannelId: null,
      staleReviewHours: 48,
    });

    expect(dto.adminChannelId).toBe("admin-channel-1");
    expect(dto.auditChannelId).toBe("audit-channel-1");
  });

  it("includes admin channel ID when building upsert values", () => {
    const values = buildGuildConfigValues({
      guildId: "guild-1",
      name: "Agency",
      adminChannelId: "admin-channel-1",
      staleReviewHours: 48,
    }, new Date("2026-05-25T18:00:00.000Z"));

    expect(values).toMatchObject({
      guildId: "guild-1",
      adminChannelId: "admin-channel-1",
      staleReviewHours: 48,
    });
  });
});
