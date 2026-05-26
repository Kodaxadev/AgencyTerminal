import { workerHeartbeats } from "../schema/drizzle-schema";
import { db } from "./client";

export interface RecordWorkerHeartbeatInput {
  workerName: string;
  guildId?: string;
  metadata?: Record<string, unknown>;
  now?: Date;
}

export async function recordWorkerHeartbeat(input: RecordWorkerHeartbeatInput): Promise<void> {
  const lastSeenAt = input.now ?? new Date();
  const metadata = input.metadata ?? {};
  const values = {
    workerName: input.workerName,
    guildId: input.guildId,
    lastSeenAt,
    metadata,
  };

  await db.insert(workerHeartbeats).values(values).onConflictDoUpdate({
    target: workerHeartbeats.workerName,
    set: {
      guildId: input.guildId,
      lastSeenAt,
      metadata,
    },
  });
}
