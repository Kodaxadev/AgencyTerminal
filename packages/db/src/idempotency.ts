import { eq } from "drizzle-orm";
import { db } from "./client";
import { idempotencyKeys } from "../schema/drizzle-schema";

type DbExecutor = Pick<typeof db, "insert" | "select" | "update">;

export interface IdempotencyClaim {
  acquired: boolean;
  result: Record<string, unknown> | null;
}

export async function claimIdempotencyKey(
  input: {
    key: string;
    guildId: string;
    scope: string;
    actorDiscordId?: string;
  },
  client: DbExecutor = db,
): Promise<IdempotencyClaim> {
  const inserted = await client
    .insert(idempotencyKeys)
    .values({
      key: input.key,
      guildId: input.guildId,
      scope: input.scope,
      actorDiscordId: input.actorDiscordId,
      result: {},
    })
    .onConflictDoNothing()
    .returning({ key: idempotencyKeys.key });

  if (inserted.length > 0) {
    return { acquired: true, result: null };
  }

  const existing = await client
    .select({ result: idempotencyKeys.result })
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, input.key))
    .limit(1);

  return {
    acquired: false,
    result: (existing[0]?.result as Record<string, unknown> | undefined) ?? null,
  };
}

export async function completeIdempotencyKey(
  key: string,
  result: Record<string, unknown>,
  client: DbExecutor = db,
): Promise<void> {
  await client
    .update(idempotencyKeys)
    .set({ result })
    .where(eq(idempotencyKeys.key, key));
}
