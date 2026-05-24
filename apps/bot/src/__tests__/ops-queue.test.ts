import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelType } from "discord.js";
import { resolveOpsQueueChannel } from "../ops-queue";

const dbMocks = vi.hoisted(() => ({
  getRoleIdsForCapabilities: vi.fn(),
}));

vi.mock("@agency-terminal/db", () => dbMocks);

const originalEnv = vi.hoisted(() => ({ ...process.env }));

describe("ops queue provisioning boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getRoleIdsForCapabilities.mockResolvedValue(["reviewer-role-1", "override-role-1"]);
    process.env = { ...originalEnv, NODE_ENV: "production" };
    delete process.env.AGENCY_ALLOW_OPS_QUEUE_SETUP;
    delete process.env.AGENCY_OPS_QUEUE_CHANNEL_ID;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("production mode with no configured channel ID fails closed and creates no channel", async () => {
    const create = vi.fn();
    const client = makeClient([], create);

    await expect(resolveOpsQueueChannel(client, "guild-1")).rejects.toThrow(/AGENCY_OPS_QUEUE_CHANNEL_ID/);

    expect(create).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"event":"configured_ops_queue_rejected"'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"reason":"missing_channel_id"'));
  });

  it("production mode with public configured channel fails closed and creates no alternate channel", async () => {
    process.env.AGENCY_OPS_QUEUE_CHANNEL_ID = "ops-channel-1";
    const publicChannel = makeOpsChannel({
      permissionOverwrites: { resolve: vi.fn().mockReturnValue(null), edit: vi.fn() },
    });
    const create = vi.fn();
    const client = makeClient([publicChannel], create);

    await expect(resolveOpsQueueChannel(client, "guild-1")).rejects.toThrow(/private usable ops queue/);

    expect(publicChannel.send).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"reason":"public_channel"'));
  });

  it("development setup mode may create one private queue with mapped role access", async () => {
    process.env.NODE_ENV = "development";
    process.env.AGENCY_ALLOW_OPS_QUEUE_SETUP = "true";
    const createdChannel = makeOpsChannel({ id: "created-ops" });
    const create = vi.fn().mockResolvedValue(createdChannel);
    const client = makeClient([], create);

    const resolved = await resolveOpsQueueChannel(client, "guild-1");

    expect(resolved).toBe(createdChannel);
    expect(create).toHaveBeenCalledOnce();
    const [payload] = create.mock.calls[0] as [{ permissionOverwrites: Array<{ id: string }> }];
    expect(payload.permissionOverwrites.map((overwrite) => overwrite.id)).toEqual([
      "guild-everyone",
      "bot-user-1",
      "reviewer-role-1",
      "override-role-1",
    ]);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"event":"ops_queue_created"'));
  });

  it("development setup mode repairs access for already-mapped roles only", async () => {
    process.env.NODE_ENV = "development";
    process.env.AGENCY_ALLOW_OPS_QUEUE_SETUP = "true";
    process.env.AGENCY_OPS_QUEUE_CHANNEL_ID = "ops-channel-1";
    const edit = vi.fn().mockResolvedValue({});
    const channel = makeOpsChannel({
      permissionOverwrites: {
        edit,
        resolve: vi.fn().mockReturnValue({ deny: { has: vi.fn().mockReturnValue(true) } }),
      },
      permissionsFor: vi.fn((actorId: string) => ({
        has: vi.fn().mockReturnValue(actorId === "bot-user-1"),
      })),
    });
    const client = makeClient([channel], vi.fn());

    const resolved = await resolveOpsQueueChannel(client, "guild-1");

    expect(resolved).toBe(channel);
    const editedIds = edit.mock.calls.map(([actorId]) => String(actorId));
    expect(editedIds).toEqual(["reviewer-role-1", "override-role-1"]);
    expect(editedIds).not.toContain("unmapped-role-1");
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"event":"ops_queue_permission_repaired"'));
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"affectedRoleId":"reviewer-role-1"'));
  });

  it("production mode does not repair missing access", async () => {
    process.env.AGENCY_OPS_QUEUE_CHANNEL_ID = "ops-channel-1";
    const edit = vi.fn();
    const channel = makeOpsChannel({
      permissionOverwrites: {
        edit,
        resolve: vi.fn().mockReturnValue({ deny: { has: vi.fn().mockReturnValue(true) } }),
      },
      permissionsFor: vi.fn().mockReturnValue({ has: vi.fn().mockReturnValue(false) }),
    });
    const create = vi.fn();
    const client = makeClient([channel], create);

    await expect(resolveOpsQueueChannel(client, "guild-1")).rejects.toThrow(/missing required/);

    expect(edit).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"reason":"missing_required_access"'));
  });

  it("setup failure emits structured diagnostics without sensitive fields", async () => {
    process.env.NODE_ENV = "development";
    process.env.AGENCY_ALLOW_OPS_QUEUE_SETUP = "true";
    const create = vi.fn().mockRejectedValue(new Error("Missing Access"));
    const client = makeClient([], create);

    await expect(resolveOpsQueueChannel(client, "guild-1")).rejects.toThrow(/Missing Access/);

    const logs = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls.flat().join("\n");
    expect(logs).toContain('"event":"ops_queue_setup_failed"');
    expect(logs).not.toMatch(/evidence|description|https?:\/\//i);
  });
});

function makeOpsChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: "ops-channel-1",
    type: ChannelType.GuildText,
    name: "ops-queue",
    guild: { roles: { everyone: { id: "guild-everyone" } } },
    send: vi.fn(),
    permissionOverwrites: {
      edit: vi.fn().mockResolvedValue({}),
      resolve: vi.fn().mockReturnValue({ deny: { has: vi.fn().mockReturnValue(true) } }),
    },
    permissionsFor: vi.fn().mockReturnValue({ has: vi.fn().mockReturnValue(true) }),
    ...overrides,
  } as unknown as Record<string, unknown>;
}

function makeClient(channels: Array<Record<string, unknown>>, create: ReturnType<typeof vi.fn>) {
  const channelMap = new Map(channels.map((channel) => [channel.id, channel]));
  return {
    user: { id: "bot-user-1" },
    guilds: {
      fetch: vi.fn().mockResolvedValue({
        roles: { everyone: { id: "guild-everyone" } },
        channels: {
          fetch: vi.fn().mockImplementation((id?: string) => {
            if (id) return Promise.resolve(channelMap.get(id) ?? null);
            return Promise.resolve(channelMap);
          }),
          create,
        },
      }),
    },
  } as never;
}
