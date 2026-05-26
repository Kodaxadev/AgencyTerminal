import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { MAX_JSON_BODY_BYTES, controlsEnabled, readJsonObject, toConfigInput } from "../http-utils";

describe("controls http utils", () => {
  it("keeps controls disabled unless explicitly enabled", () => {
    expect(controlsEnabled({})).toBe(false);
    expect(controlsEnabled({ CONTROLS_ENABLED: "false" })).toBe(false);
    expect(controlsEnabled({ CONTROLS_ENABLED: "true" })).toBe(true);
  });

  it("preserves admin channel ID in config PATCH input", () => {
    const input = toConfigInput({ adminChannelId: "admin-1", name: "Agency" }, {
      guildId: "guild-1",
      name: "Old Agency",
      staleReviewHours: 48,
    }, "guild-1");

    expect(input.adminChannelId).toBe("admin-1");
    expect(input.name).toBe("Agency");
  });

  it("preserves omitted channel IDs in partial config PATCH input", () => {
    const input = toConfigInput({ name: "Agency" }, {
      guildId: "guild-1",
      name: "Old Agency",
      adminChannelId: "admin-1",
      auditChannelId: "audit-1",
      opsQueueChannelId: "ops-1",
      archiveChannelId: "archive-1",
      doctrineChangesChannelId: "doctrine-1",
      staleReviewHours: 48,
    }, "guild-1");

    expect(input).toMatchObject({
      adminChannelId: "admin-1",
      auditChannelId: "audit-1",
      opsQueueChannelId: "ops-1",
      archiveChannelId: "archive-1",
      doctrineChangesChannelId: "doctrine-1",
      staleReviewHours: 48,
    });
  });

  it("rejects oversized JSON request bodies", async () => {
    await expect(readJsonObject(makeRequest("x".repeat(MAX_JSON_BODY_BYTES + 1))))
      .rejects.toThrow("JSON body too large");
  });
});

function makeRequest(body: string): Parameters<typeof readJsonObject>[0] {
  const req = Readable.from([body]);
  Object.assign(req, { headers: {} });
  return req as Parameters<typeof readJsonObject>[0];
}
