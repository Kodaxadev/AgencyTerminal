import type { HealthCheckDto } from "../src/contracts";

const WORKER_HEARTBEAT_WARN_MS = 5 * 60 * 1000;

export interface WorkerHeartbeatRow {
  workerName: string;
  guildId?: string | null;
  lastSeenAt: Date;
  metadata: unknown;
}

export interface OperationalHealthInput {
  guildId: string;
  now: Date;
  outboxPending: number;
  outboxDead: number;
  workerHeartbeats: WorkerHeartbeatRow[];
  env: NodeJS.ProcessEnv;
}

export function buildOperationalHealthChecks(input: OperationalHealthInput): HealthCheckDto[] {
  return [
    buildOutboxCheck(input),
    buildWorkerHeartbeatCheck(input),
    buildOpsQueueSetupPolicyCheck(input),
    buildGuildMembersIntentCheck(input),
  ];
}

function buildOutboxCheck(input: OperationalHealthInput): HealthCheckDto {
  const status = input.outboxDead > 0 ? "fail" : input.outboxPending > 0 ? "warn" : "ok";
  return {
    id: "discord_outbox",
    label: "Discord outbox",
    status,
    lastCheckedAt: input.now.toISOString(),
    detail: `${input.outboxPending} pending / ${input.outboxDead} dead`,
    remediation: input.outboxDead > 0 ? "Inspect dead outbox records before retrying Discord projections." : undefined,
  };
}

function buildWorkerHeartbeatCheck(input: OperationalHealthInput): HealthCheckDto {
  const heartbeat = input.workerHeartbeats.find((row) => row.workerName === "outbox_processor");
  if (!heartbeat) {
    return {
      id: "worker_outbox_processor",
      label: "Outbox worker heartbeat",
      status: "warn",
      lastCheckedAt: input.now.toISOString(),
      detail: "No heartbeat recorded",
      remediation: "Confirm the bot worker is running.",
    };
  }

  const ageMs = input.now.getTime() - heartbeat.lastSeenAt.getTime();
  const ageMinutes = Math.max(0, Math.round(ageMs / 60_000));
  return {
    id: "worker_outbox_processor",
    label: "Outbox worker heartbeat",
    status: ageMs > WORKER_HEARTBEAT_WARN_MS ? "warn" : "ok",
    lastCheckedAt: input.now.toISOString(),
    detail: `Last seen ${ageMinutes}m ago`,
    remediation: ageMs > WORKER_HEARTBEAT_WARN_MS ? "Check the bot worker logs and deployment status." : undefined,
  };
}

function buildOpsQueueSetupPolicyCheck(input: OperationalHealthInput): HealthCheckDto {
  const enabled = input.env.AGENCY_ALLOW_OPS_QUEUE_SETUP === "true";
  return {
    id: "ops_queue_setup_policy",
    label: "Ops queue self-setup policy",
    status: enabled ? "warn" : "ok",
    lastCheckedAt: input.now.toISOString(),
    detail: enabled ? "Enabled; keep this off in production." : "Disabled",
  };
}

function buildGuildMembersIntentCheck(input: OperationalHealthInput): HealthCheckDto {
  const enabled = input.env.DISCORD_ENABLE_GUILD_MEMBERS_INTENT === "true";
  return {
    id: "guild_members_intent",
    label: "GuildMembers intent",
    status: enabled ? "ok" : "warn",
    lastCheckedAt: input.now.toISOString(),
    detail: enabled ? "Opt-in enabled" : "Disabled until leader enables the privileged intent for join automation.",
  };
}
