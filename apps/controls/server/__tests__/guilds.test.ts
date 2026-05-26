import { describe, expect, it, vi } from "vitest";
import {
  getBootstrapIdsForGuild,
  parseControlsGuilds,
  resolveControlsGuild,
} from "../auth/guilds";

describe("controls guild resolver", () => {
  it("keeps legacy single-guild env behavior when CONTROLS_GUILDS is unset", () => {
    expect(parseControlsGuilds({ DISCORD_GUILD_ID: "agency-guild" })).toEqual([
      { key: "agency", guildId: "agency-guild" },
    ]);
    expect(getBootstrapIdsForGuild({
      DISCORD_GUILD_ID: "agency-guild",
      CONTROLS_BOOTSTRAP_DISCORD_IDS: "leader-1,dev-1",
    }, "agency")).toEqual(["leader-1", "dev-1"]);
  });

  it("uses scoped bootstrap ids in dual-guild mode", () => {
    const env = {
      CONTROLS_GUILDS: "dev:dev-guild,agency:agency-guild",
      CONTROLS_BOOTSTRAP_DISCORD_IDS: "legacy-user",
      CONTROLS_BOOTSTRAP_DISCORD_IDS_DEV: "dev-user",
      CONTROLS_BOOTSTRAP_DISCORD_IDS_AGENCY: "leader-user",
    };

    expect(parseControlsGuilds(env)).toEqual([
      { key: "dev", guildId: "dev-guild" },
      { key: "agency", guildId: "agency-guild" },
    ]);
    expect(getBootstrapIdsForGuild(env, "dev")).toEqual(["dev-user"]);
    expect(getBootstrapIdsForGuild(env, "agency")).toEqual(["leader-user"]);
  });

  it("resolves the first configured guild where the user has capabilities", async () => {
    const fetchMember = vi.fn((guildId: string) => {
      if (guildId === "dev-guild") return { roles: [] };
      if (guildId === "agency-guild") return { roles: ["agency-admin"] };
      throw new Error("not a member");
    });
    const listRoleMappings = vi.fn((guildId: string) => guildId === "agency-guild"
      ? [{ discordRoleId: "agency-admin", capability: "can_manage_config" as const }]
      : []);

    const resolved = await resolveControlsGuild({
      env: { CONTROLS_GUILDS: "dev:dev-guild,agency:agency-guild" },
      user: { id: "leader-user", username: "leader" },
      fetchMember,
      listRoleMappings,
    });

    expect(resolved?.config).toEqual({ key: "agency", guildId: "agency-guild" });
    expect(fetchMember).toHaveBeenCalledWith("dev-guild");
    expect(fetchMember).toHaveBeenCalledWith("agency-guild");
  });
});
