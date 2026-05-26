import { describe, expect, it, vi } from "vitest";
import { getDeploymentStatus, registerGuildCommandsAction } from "../deployment";

describe("controls deployment actions", () => {
  it("requires typed confirmation before registering Discord commands", async () => {
    const registerCommands = vi.fn();

    await expect(registerGuildCommandsAction({
      confirmation: "YES",
      env: {
        DISCORD_CLIENT_ID: "client-1",
        DISCORD_TOKEN: "token-1",
      },
      guildId: "guild-1",
      registerCommands,
    })).rejects.toThrow("REGISTER");

    expect(registerCommands).not.toHaveBeenCalled();
  });

  it("fails closed when Discord deployment env values are missing", async () => {
    const registerCommands = vi.fn();

    await expect(registerGuildCommandsAction({
      confirmation: "REGISTER",
      env: { DISCORD_CLIENT_ID: "client-1" },
      registerCommands,
    })).rejects.toThrow("Missing Discord deployment env");

    expect(registerCommands).not.toHaveBeenCalled();
  });

  it("registers commands only after confirmation and env validation", async () => {
    const registerCommands = vi.fn().mockResolvedValue(undefined);

    await registerGuildCommandsAction({
      confirmation: "REGISTER",
      env: {
        DISCORD_CLIENT_ID: "client-1",
        DISCORD_TOKEN: "token-1",
      },
      guildId: "session-guild-1",
      registerCommands,
    });

    expect(registerCommands).toHaveBeenCalledWith("client-1", "session-guild-1", "token-1");
  });

  it("builds a bot install URL without exposing the bot token", () => {
    const status = getDeploymentStatus({
      DISCORD_CLIENT_ID: "client-1",
      DISCORD_GUILD_ID: "guild-1",
      DISCORD_TOKEN: "token-1",
    });

    expect(status.inviteUrl).toContain("client_id=client-1");
    expect(status.inviteUrl).toContain("scope=bot+applications.commands");
    expect(JSON.stringify(status)).not.toContain("token-1");
  });
});
