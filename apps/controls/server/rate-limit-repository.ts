import { rateLimitBuckets } from "../../../packages/db/schema/drizzle-schema";
import { db } from "../../../packages/db/src/client";
import { sql } from "../../../packages/db/src/query";

export interface RateLimitInput {
  guildId: string;
  actorDiscordId: string;
  action: string;
  limitCount: number;
  windowSeconds: number;
  now?: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const now = input.now ?? new Date();
  const windowStart = getWindowStart(now, input.windowSeconds);
  const [row] = await db.insert(rateLimitBuckets).values({
    guildId: input.guildId,
    actorDiscordId: input.actorDiscordId,
    action: input.action,
    windowStart,
    windowSeconds: input.windowSeconds,
    count: 1,
    limitCount: input.limitCount,
  }).onConflictDoUpdate({
    target: [
      rateLimitBuckets.guildId,
      rateLimitBuckets.actorDiscordId,
      rateLimitBuckets.action,
      rateLimitBuckets.windowStart,
    ],
    set: {
      count: sql<number>`least(${rateLimitBuckets.count} + 1, ${input.limitCount} + 1)`,
      limitCount: input.limitCount,
      windowSeconds: input.windowSeconds,
    },
  }).returning({ count: rateLimitBuckets.count });

  const count = Number(row?.count ?? input.limitCount + 1);
  return {
    allowed: count <= input.limitCount,
    retryAfterSeconds: retryAfterSeconds(now, windowStart, input.windowSeconds),
  };
}

function getWindowStart(now: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

function retryAfterSeconds(now: Date, windowStart: Date, windowSeconds: number): number {
  const elapsed = Math.max(0, now.getTime() - windowStart.getTime());
  return Math.max(1, windowSeconds - Math.floor(elapsed / 1000));
}
