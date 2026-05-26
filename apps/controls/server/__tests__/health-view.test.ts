import { describe, expect, it } from "vitest";
import { buildOperationalHealthChecks } from "../health-view";

describe("controls operational health view", () => {
  it("reports split outbox pending/dead counts", () => {
    const checks = buildOperationalHealthChecks({
      guildId: "guild-1",
      now: new Date("2026-05-25T18:00:00.000Z"),
      outboxPending: 3,
      outboxDead: 1,
      workerHeartbeats: [],
      env: {},
    });

    expect(checks).toContainEqual(expect.objectContaining({
      id: "discord_outbox",
      status: "fail",
      detail: "3 pending / 1 dead",
    }));
  });

  it("warns when the outbox worker heartbeat is stale", () => {
    const checks = buildOperationalHealthChecks({
      guildId: "guild-1",
      now: new Date("2026-05-25T18:10:00.000Z"),
      outboxPending: 0,
      outboxDead: 0,
      workerHeartbeats: [{
        workerName: "outbox_processor",
        guildId: "guild-1",
        lastSeenAt: new Date("2026-05-25T18:00:00.000Z"),
        metadata: {},
      }],
      env: {},
    });

    expect(checks).toContainEqual(expect.objectContaining({
      id: "worker_outbox_processor",
      status: "warn",
    }));
  });

  it("shows guarded ops-queue and guild-members policies as read-only checks", () => {
    const checks = buildOperationalHealthChecks({
      guildId: "guild-1",
      now: new Date("2026-05-25T18:00:00.000Z"),
      outboxPending: 0,
      outboxDead: 0,
      workerHeartbeats: [],
      env: { AGENCY_ALLOW_OPS_QUEUE_SETUP: "true" },
    });

    expect(checks).toContainEqual(expect.objectContaining({
      id: "ops_queue_setup_policy",
      status: "warn",
    }));
    expect(checks).toContainEqual(expect.objectContaining({
      id: "guild_members_intent",
      status: "warn",
    }));
  });
});
