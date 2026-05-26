import { describe, expect, it } from "vitest";
import { GatewayIntentBits } from "discord.js";
import { buildGatewayIntents } from "../intents";

describe("Discord gateway intents", () => {
  it("keeps GuildMembers disabled by default", () => {
    expect(buildGatewayIntents({})).not.toContain(GatewayIntentBits.GuildMembers);
  });

  it("adds GuildMembers only when explicitly opted in", () => {
    expect(buildGatewayIntents({ DISCORD_ENABLE_GUILD_MEMBERS_INTENT: "true" }))
      .toContain(GatewayIntentBits.GuildMembers);
  });
});
