import { beforeEach, describe, expect, it, vi } from "vitest";
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

describe("outbox processor channel fetch reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.findStaleEvidence.mockResolvedValue([]);
    process.env = { ...originalEnv };
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

describe("evidence_review_projection outbox worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.findStaleEvidence.mockResolvedValue([]);
    dbMocks.getRoleIdsForCapabilities.mockResolvedValue(["reviewer-role-1"]);
    process.env = { ...originalEnv, AGENCY_OPS_QUEUE_CHANNEL_ID: "ops-channel-1" };
  });

  function makePrivateOpsChannel(overrides: Record<string, unknown> = {}) {
    const denyHas = vi.fn().mockReturnValue(true);
    const denyPermissions = { has: denyHas };
    const resolve = vi.fn().mockReturnValue({ deny: denyPermissions });
    const permissionsFor = vi.fn().mockReturnValue({ has: vi.fn().mockReturnValue(true) });
    const edit = vi.fn().mockResolvedValue({});
    return {
      id: "ops-channel-1",
      name: "ops-queue",
      type: 0,
      guild: { roles: { everyone: { id: "guild-everyone" } } },
      send: vi.fn().mockResolvedValue({}),
      messages: { fetch: vi.fn().mockResolvedValue(new Map()) },
      permissionsFor,
      permissionOverwrites: { edit, resolve },
      _denyHas: denyHas,
      _resolve: resolve,
      ...overrides,
    } as unknown as Record<string, unknown>;
  }


  const projectionMsg = {
    id: "outbox-ev-1",
    guildId: "guild-1",
    eventType: "evidence_review_projection",
    payload: {
      evidenceId: "ev-proof-1",
      evidenceShortId: "EVD-0042",
      submittedByDiscordId: "user-submitter",
      subjectDiscordId: "user-subject",
      metricCategory: "technical_development_output",
      sensitivity: "member",
      title: "Proof of work",
      description: "Implemented feature X",
      validationRequiredApprovals: 1,
      submittedMode: "live_bot",
    },
    attempts: 0,
    maxAttempts: 5,
  };

  it("recognizes and sends an evidence_review_projection event", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([projectionMsg]);
    const opsChannel = makePrivateOpsChannel();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    expect(opsChannel.send).toHaveBeenCalledOnce();
    expect(dbMocks.markOutboxSent).toHaveBeenCalledWith("outbox-ev-1");
  });

  it("includes [evidence-review:{evidenceId}] marker in the message", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([projectionMsg]);
    const opsChannel = makePrivateOpsChannel();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    const sendMock = opsChannel.send as ReturnType<typeof vi.fn>;
    const [payload] = sendMock.mock.calls[0] as [{ content: string }];
    expect(payload.content).toContain("[evidence-review:ev-proof-1]");
  });

  it("rendered embed uses evidenceShortId for display", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([projectionMsg]);
    const opsChannel = makePrivateOpsChannel();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    const sendMock = opsChannel.send as ReturnType<typeof vi.fn>;
    const [payload] = sendMock.mock.calls[0] as [{ embeds: Array<{ data: Record<string, unknown> }> }];
    expect(payload.embeds[0].data.title).toContain("EVD-0042");
  });

  it.each([
    { field: "validationRequiredApprovals", value: undefined, reason: "missing" },
    { field: "validationRequiredApprovals", value: 0, reason: "zero" },
    { field: "validationRequiredApprovals", value: -1, reason: "negative" },
    { field: "validationRequiredApprovals", value: 1.5, reason: "non-integer" },
    { field: "submittedByDiscordId", value: "", reason: "empty" },
    { field: "subjectDiscordId", value: undefined, reason: "missing" },
    { field: "metricCategory", value: "invalid_metric", reason: "invalid" },
    { field: "sensitivity", value: "top_secret", reason: "invalid" },
    { field: "submittedMode", value: "discord_dm", reason: "invalid" },
    { field: "title", value: undefined, reason: "missing" },
    { field: "description", value: null, reason: "null" },
  ])(`malformed payload ($field=$reason) causes markOutboxFailed, no send`, async ({ field, value }) => {
    const badPayload = { ...projectionMsg.payload, [field]: value };
    dbMocks.claimDueOutbox.mockResolvedValue([{ ...projectionMsg, payload: badPayload }]);
    const opsChannel = makePrivateOpsChannel();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    expect(dbMocks.markOutboxFailed).toHaveBeenCalled();
    expect(opsChannel.send).not.toHaveBeenCalled();
    expect(dbMocks.markOutboxSent).not.toHaveBeenCalled();
  });

  it("marker and review buttons still use UUID evidenceId", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([projectionMsg]);
    const opsChannel = makePrivateOpsChannel();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    const sendMock = opsChannel.send as ReturnType<typeof vi.fn>;
    const [payload] = sendMock.mock.calls[0] as [{ content: string; components: unknown[] }];
    expect(payload.content).toContain("[evidence-review:ev-proof-1]");
    const serialized = JSON.stringify(payload.components);
    expect(serialized).toContain("review:approve:ev-proof-1");
    expect(serialized).toContain("review:object:ev-proof-1");
  });

  it("displays non-EVD shortId in embed while marker and buttons use UUID", async () => {
    const casePayload = {
      ...projectionMsg.payload,
      evidenceId: "ev-proof-1",
      evidenceShortId: "CASE-0042",
    };
    dbMocks.claimDueOutbox.mockResolvedValue([{ ...projectionMsg, payload: casePayload }]);
    const opsChannel = makePrivateOpsChannel();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    const sendMock = opsChannel.send as ReturnType<typeof vi.fn>;
    const [payload] = sendMock.mock.calls[0] as [{ content: string; embeds: Array<{ data: Record<string, unknown> }>; components: unknown[] }];
    expect(payload.embeds[0].data.title).toContain("CASE-0042");
    expect(payload.content).toContain("[evidence-review:ev-proof-1]");
    const serialized = JSON.stringify(payload.components);
    expect(serialized).toContain("review:approve:ev-proof-1");
  });

  it("numeric evidenceShortId causes markOutboxFailed, no send", async () => {
    const badPayload = { ...projectionMsg.payload, evidenceShortId: 42 };
    dbMocks.claimDueOutbox.mockResolvedValue([{ ...projectionMsg, payload: badPayload }]);
    const opsChannel = makePrivateOpsChannel();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    expect(dbMocks.markOutboxFailed).toHaveBeenCalled();
    expect(opsChannel.send).not.toHaveBeenCalled();
    expect(dbMocks.markOutboxSent).not.toHaveBeenCalled();
  });

  it("object evidenceShortId causes markOutboxFailed, no send", async () => {
    const badPayload = { ...projectionMsg.payload, evidenceShortId: { foo: "bar" } };
    dbMocks.claimDueOutbox.mockResolvedValue([{ ...projectionMsg, payload: badPayload }]);
    const opsChannel = makePrivateOpsChannel();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    expect(dbMocks.markOutboxFailed).toHaveBeenCalled();
    expect(opsChannel.send).not.toHaveBeenCalled();
    expect(dbMocks.markOutboxSent).not.toHaveBeenCalled();
  });

  it("raw URL is absent from worker output", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([projectionMsg]);
    const opsChannel = makePrivateOpsChannel();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    const sendMock = opsChannel.send as ReturnType<typeof vi.fn>;
    const [payload] = sendMock.mock.calls[0] as [{ content: string; embeds: unknown[]; components: unknown[] }];
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("http");
  });

  it("uses configured private ops channel by ID", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([projectionMsg]);
    process.env.AGENCY_OPS_QUEUE_CHANNEL_ID = "custom-ops-999";
    const opsChannel = makePrivateOpsChannel({ id: "custom-ops-999" });
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    expect(opsChannel.send).toHaveBeenCalledOnce();
  });

  it("missing configured channel fails closed without posting evidence content", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([projectionMsg]);
    process.env = { ...originalEnv };
    const create = vi.fn();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [], create });

    await processOutbox(client, "guild-1", 1);

    expect(create).not.toHaveBeenCalled();
    expect(dbMocks.markOutboxFailed).toHaveBeenCalledWith("outbox-ev-1", expect.stringMatching(/AGENCY_OPS_QUEUE_CHANNEL_ID/i));
    expect(dbMocks.markOutboxSent).not.toHaveBeenCalled();
  });

  it("configured channel viewable by @everyone fails closed without alternate creation", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([projectionMsg]);
    const resolve = vi.fn().mockReturnValue(null);
    const opsChannel = makePrivateOpsChannel({
      permissionOverwrites: { resolve },
    });
    const create = vi.fn();
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create });

    await processOutbox(client, "guild-1", 1);

    expect(opsChannel.send).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(dbMocks.markOutboxFailed).toHaveBeenCalledWith("outbox-ev-1", expect.stringMatching(/private usable ops queue/i));
    expect(dbMocks.markOutboxSent).not.toHaveBeenCalled();
  });

  it("existing marker causes reconciliation without a duplicate send", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([projectionMsg]);
    const opsChannel = makePrivateOpsChannel({
      messages: {
        fetch: vi.fn().mockResolvedValue(
          new Map([["msg-1", { content: "Evidence review [evidence-review:ev-proof-1]" }]]),
        ),
      },
    });
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    expect(opsChannel.send).not.toHaveBeenCalled();
    expect(dbMocks.markOutboxSent).toHaveBeenCalledWith("outbox-ev-1");
  });

  it("Discord send failure causes retry/failure marking", async () => {
    dbMocks.claimDueOutbox.mockResolvedValue([projectionMsg]);
    const opsChannel = makePrivateOpsChannel({
      send: vi.fn().mockRejectedValue(new Error("Discord API 500")),
    });
    const client = makeClient({ cachedChannels: [], fetchedChannels: [opsChannel], create: vi.fn() });

    await processOutbox(client, "guild-1", 1);

    expect(dbMocks.markOutboxFailed).toHaveBeenCalledWith("outbox-ev-1", expect.stringMatching(/Discord API 500/i));
    expect(dbMocks.markOutboxSent).not.toHaveBeenCalled();
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
  const channelMap = new Map(input.fetchedChannels.map((channel) => [channel.id, channel]));
  const fetchFn = vi.fn().mockResolvedValue(channelMap);
  fetchFn.mockImplementation((id?: string) => {
    if (id) return Promise.resolve(channelMap.get(id) ?? null);
    return Promise.resolve(channelMap);
  });
  return {
    user: { id: "bot-user-1" },
    guilds: {
      fetch: vi.fn().mockResolvedValue({
        roles: { everyone: { id: "guild-everyone" } },
        channels: {
          cache: new Map(input.cachedChannels.map((channel) => [channel.id, channel])),
          fetch: fetchFn,
          create: input.create,
        },
      }),
    },
  } as never;
}
