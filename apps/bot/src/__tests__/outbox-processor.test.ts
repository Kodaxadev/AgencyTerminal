import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChannelType } from "discord.js";
import { processOutbox } from "../outbox-processor";

const dbMocks = vi.hoisted(() => ({
  claimDueOutbox: vi.fn(),
  findStaleEvidence: vi.fn(),
  markEvidenceStale: vi.fn(),
  markOutboxFailed: vi.fn(),
  markOutboxSent: vi.fn(),
  persistTicketChannelId: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@agency-terminal/db", () => dbMocks);

describe("outbox processor channel fetch reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.findStaleEvidence.mockResolvedValue([]);
  });

  it("uses fetched channels to reconcile ticket channels when cache is empty", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([ticketCreatedMessage()]);
    const existingChannel = { id: "channel-existing", topic: "Contract | TKT-1 [agency-ticket:ticket-1]" };
    const create = vi.fn();
    const client = makeClient({
      cachedChannels: [],
      fetchedChannels: [existingChannel],
      create,
    });

    await processOutbox(client, "guild-1", 1);

    expect(create).not.toHaveBeenCalled();
    expect(dbMocks.persistTicketChannelId).toHaveBeenCalledWith("ticket-1", "channel-existing");
    expect(dbMocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: "discord_channel_reconciled",
      subjectId: "ticket-1",
    }));
  });

  it("uses fetched channels to find ops queue when cache is empty", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([]);
    dbMocks.findStaleEvidence.mockResolvedValue([
      { id: "ev-1", shortId: "EVD-1", title: "Evidence", metricCategory: "fleet_participation" },
    ]);
    const send = vi.fn().mockResolvedValue({});
    const messages = { fetch: vi.fn().mockResolvedValue(new Map()) };
    const opsChannel = { id: "ops-1", name: "ops-queue", type: ChannelType.GuildText, send, messages };
    const client = makeClient({
      cachedChannels: [],
      fetchedChannels: [opsChannel],
      create: vi.fn(),
    });

    await processOutbox(client, "guild-1", 1);

    const [payload] = send.mock.calls[0] as [{ content: string }];
    expect(payload.content).toContain("stale-alert:ev-1");
    expect(dbMocks.markEvidenceStale).toHaveBeenCalledWith("ev-1");
  });

  it("does not crash outbox processing when stale evidence scan fails", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([ticketCreatedMessage()]);
    dbMocks.findStaleEvidence.mockRejectedValue(new Error("Database connection failed"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const existingChannel = { id: "channel-existing", topic: "Contract | TKT-1 [agency-ticket:ticket-1]" };
    const create = vi.fn();
    const client = makeClient({
      cachedChannels: [],
      fetchedChannels: [existingChannel],
      create,
    });

    const result = await processOutbox(client, "guild-1", 1);

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);
    expect(result.staleAlerts).toBe(0);
    expect(dbMocks.persistTicketChannelId).toHaveBeenCalledWith("ticket-1", "channel-existing");
    consoleErrorSpy.mockRestore();
  });

  it("emits structured error log when stale evidence scan fails", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([]);
    dbMocks.findStaleEvidence.mockRejectedValue(new Error("Database connection failed"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = makeClient({
      cachedChannels: [],
      fetchedChannels: [],
      create: vi.fn(),
    });

    await processOutbox(client, "guild-1", 1);

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const firstCall = consoleErrorSpy.mock.calls[0];
    const logMessage = firstCall[0] as string;
    const parsedLog = JSON.parse(logMessage) as { level: string; event: string; guildId: string; error: { name: string; message: string; stack?: string } };
    expect(parsedLog.level).toBe("error");
    expect(parsedLog.event).toBe("stale_evidence_scan_failed");
    expect(parsedLog.guildId).toBe("guild-1");
    expect(parsedLog.error).toBeDefined();
    expect(parsedLog.error.name).toBe("Error");
    expect(parsedLog.error.message).toBe("Database connection failed");
    expect(parsedLog.error.stack).toBeDefined();
    consoleErrorSpy.mockRestore();
  });
});

function ticketCreatedMessage() {
  return {
    id: "outbox-1",
    guildId: "guild-1",
    eventType: "ticket_created",
    payload: {
      ticketId: "ticket-1",
      ticketShortId: "TKT-1",
      ticketType: "contract",
      creatorDiscordId: "user-1",
      title: "Contract",
    },
    attempts: 0,
    maxAttempts: 5,
  };
}

function makeClient(input: {
  cachedChannels: Array<Record<string, unknown>>;
  fetchedChannels: Array<Record<string, unknown>>;
  create: ReturnType<typeof vi.fn>;
}) {
  return {
    guilds: {
      fetch: vi.fn().mockResolvedValue({
        roles: { everyone: { id: "guild-everyone" } },
        channels: {
          cache: new Map(input.cachedChannels.map((channel) => [channel.id, channel])),
          fetch: vi.fn().mockResolvedValue(new Map(input.fetchedChannels.map((channel) => [channel.id, channel]))),
          create: input.create,
        },
      }),
    },
  } as never;
}
