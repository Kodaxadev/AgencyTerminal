import { describe, expect, it } from "vitest";
import { toConfigInput } from "../http-utils";

describe("controls http utils", () => {
  it("preserves admin channel ID in config PATCH input", () => {
    const input = toConfigInput({ adminChannelId: "admin-1", name: "Agency" }, {
      guildId: "guild-1",
      name: "Old Agency",
      staleReviewHours: 48,
    }, "guild-1");

    expect(input.adminChannelId).toBe("admin-1");
    expect(input.name).toBe("Agency");
  });
});
