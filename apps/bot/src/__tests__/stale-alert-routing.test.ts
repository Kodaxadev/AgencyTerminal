import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelType } from "discord.js";
import { processOutbox } from "../outbox-processor";

const dbMocks = vi.hoisted(() => ({
  claimDueOutbox: vi.fn(),
  findStaleEvidence: vi.fn(),
  getRoleIdsForCapabilities: vi.fn(),
  markEvidenceStale: vi.fn(),
  markOutboxFailed: vi.fn(),
  markOutboxSent: vi.fn(),
  persistTicketChannelId: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@agency-terminal/db", () => dbMocks);

const originalEnv = vi.hoisted(() => ({ ...process.env }));

describe("stale-alert private channel routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.claimDueOutbox.mockResolvedValue([]);
    dbMocks.findStaleEvidence.mockResolvedValue([]);
    dbMocks.getRoleIdsForCapabilities.mockResolvedValue(["reviewer-role-1"]);
    process.env = { ...originalEnv, AGENCY_OPS_QUEUE_CHANNEL_ID: "ops-channel-1" };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("routes stale alerts to the configured channel ID, not a channel named ops-queue", async () => {
    dbMocks.findStaleEvidence.mockResolvedValue([staleEv()]);
    const opsChannel = makePrivateOpsChannel({ id: "ops-channel-1", name: "definitely-not-ops-queue" });
    const client = makeClientForStale(opsChannel);

    await processOutbox(client, "guild-1", 1);

    expect(opsChannel.send).toHaveBeenCalledOnce();
    expect(dbMocks.markEvidenceStale).toHaveBeenCalledWith("ev-stale-1");
  });

  it("missing AGENCY_OPS_QUEUE_CHANNEL_ID fails closed and does not mark stale", async () => {
    process.env = { ...originalEnv };
    dbMocks.findStaleEvidence.mockResolvedValue([staleEv()]);
    const create = vi.fn();
    const client = makeClientForStale(null, create);

    await processOutbox(client, "guild-1", 1);

    expect(create).not.toHaveBeenCalled();
    expect(dbMocks.markEvidenceStale).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"ops_queue_setup_failed"'));
  });

  it("configured channel not found fails closed without private setup", async () => {
    dbMocks.findStaleEvidence.mockResolvedValue([staleEv()]);
    const create = vi.fn();
    const client = makeClientForStale(null, create);

    await processOutbox(client, "guild-1", 1);

    expect(create).not.toHaveBeenCalled();
    expect(dbMocks.markEvidenceStale).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"channel_not_found"'));
  });

  it("configured channel viewable by @everyone fails closed without private setup", async () => {
    dbMocks.findStaleEvidence.mockResolvedValue([staleEv()]);
    const publicChannel = makePrivateOpsChannel({
      id: "ops-channel-1",
      permissionOverwrites: { resolve: vi.fn().mockReturnValue(null) },
    });
    const create = vi.fn();
    const client = makeClientForStale(publicChannel, create);

    await processOutbox(client, "guild-1", 1);

    expect(publicChannel.send).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(dbMocks.markEvidenceStale).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"public_channel"'));
  });

  it("ops queue setup failure does not send and does not mark stale", async () => {
    process.env = { ...originalEnv, NODE_ENV: "development", AGENCY_ALLOW_OPS_QUEUE_SETUP: "true" };
    dbMocks.findStaleEvidence.mockResolvedValue([staleEv()]);
    const create = vi.fn().mockRejectedValue(new Error("Missing Access"));
    const client = makeClientForStale(null, create);

    await processOutbox(client, "guild-1", 1);

    expect(dbMocks.markEvidenceStale).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"ops_queue_setup_failed"'));
  });

  it("Discord send failure logs stale_alert_send_failed, does not mark stale", async () => {
    dbMocks.findStaleEvidence.mockResolvedValue([staleEv()]);
    const opsChannel = makePrivateOpsChannel({ id: "ops-channel-1" });
    opsChannel.send = vi.fn().mockRejectedValue(new Error("Discord API down"));
    const client = makeClientForStale(opsChannel);

    await processOutbox(client, "guild-1", 1);

    expect(dbMocks.markEvidenceStale).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"discord_send_failed"'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"stale_alert_send_failed"'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"Discord API down"'));
  });

  it("configured private channel posts exactly one stale alert and marks evidence stale", async () => {
    dbMocks.findStaleEvidence.mockResolvedValue([staleEv()]);
    const opsChannel = makePrivateOpsChannel({ id: "ops-channel-1" });
    const client = makeClientForStale(opsChannel);

    await processOutbox(client, "guild-1", 1);

    expect(opsChannel.send).toHaveBeenCalledOnce();
    const [payload] = (opsChannel.send as ReturnType<typeof vi.fn>).mock.calls[0] as [{ content: string }];
    expect(payload.content).toContain("stale-alert:ev-stale-1");
    expect(dbMocks.markEvidenceStale).toHaveBeenCalledWith("ev-stale-1");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("already-posted stale alert is not re-sent but evidence is still marked stale", async () => {
    dbMocks.findStaleEvidence.mockResolvedValue([staleEv()]);
    const opsChannel = makePrivateOpsChannel({
      id: "ops-channel-1",
      messages: {
        fetch: vi.fn().mockResolvedValue(
          new Map([["msg-1", { content: "[stale-alert:ev-stale-1]" }]]),
        ),
      },
    });
    const client = makeClientForStale(opsChannel);

    await processOutbox(client, "guild-1", 1);

    expect(opsChannel.send).not.toHaveBeenCalled();
    expect(dbMocks.markEvidenceStale).toHaveBeenCalledWith("ev-stale-1");
    expect(console.error).not.toHaveBeenCalled();
  });
});

function staleEv() {
  return { id: "ev-stale-1", shortId: "EVD-STALE-1", title: "Stale Evidence", metricCategory: "fleet_participation" };
}

function makePrivateOpsChannel(overrides: Record<string, unknown> = {}) {
  const denyHas = vi.fn().mockReturnValue(true);
  const permissionsFor = vi.fn().mockReturnValue({ has: vi.fn().mockReturnValue(true) });
  const edit = vi.fn().mockResolvedValue({});
  return {
    id: "ops-channel-1",
    type: ChannelType.GuildText,
    name: "ops-queue",
    guild: { roles: { everyone: { id: "guild-everyone" } } },
    send: vi.fn().mockResolvedValue({}),
    messages: { fetch: vi.fn().mockResolvedValue(new Map()) },
    permissionsFor,
    permissionOverwrites: {
      edit,
      resolve: vi.fn().mockReturnValue({ deny: { has: denyHas } }),
    },
    ...overrides,
  } as unknown as Record<string, unknown>;
}

function makeClientForStale(
  opsChannel: Record<string, unknown> | null,
  create = vi.fn(),
) {
  const channelMap = opsChannel
    ? new Map([[opsChannel.id as string, opsChannel]])
    : new Map<string, unknown>();
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
