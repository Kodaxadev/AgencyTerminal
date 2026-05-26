import { controlsSessions } from "../../../../packages/db/schema/drizzle-schema";
import { db } from "../../../../packages/db/src/client";
import { and, eq, lte } from "../../../../packages/db/src/query";
import type { Capability, ControlsUser } from "../../src/contracts";
import type { ControlsSession, SessionStore } from "./session";
import { decryptSessionToken, encryptSessionToken, getSessionTokenSecret } from "./token-crypto";

export class PostgresSessionStore implements SessionStore {
  async create(input: Omit<ControlsSession, "id"> & { id?: string }): Promise<ControlsSession> {
    const session = { ...input, id: input.id ?? crypto.randomUUID() };
    await db.insert(controlsSessions).values(toRow(session)).onConflictDoUpdate({
      target: controlsSessions.id,
      set: toRow(session),
    });
    return session;
  }

  async get(sessionId: string): Promise<ControlsSession | null> {
    await deleteExpiredSessions(Date.now());
    const rows = await db.select().from(controlsSessions).where(eq(controlsSessions.id, sessionId)).limit(1);
    const row = rows[0];
    return row ? fromRow(row) : null;
  }

  async update(
    sessionId: string,
    patch: Partial<Omit<ControlsSession, "id">>,
  ): Promise<ControlsSession | null> {
    const current = await this.get(sessionId);
    if (!current) return null;
    const next = { ...current, ...patch };
    await db.update(controlsSessions)
      .set({ ...toRow(next), updatedAt: new Date() })
      .where(eq(controlsSessions.id, sessionId));
    return next;
  }

  async delete(sessionId: string): Promise<void> {
    await db.delete(controlsSessions).where(eq(controlsSessions.id, sessionId));
  }
}

function toRow(session: ControlsSession): typeof controlsSessions.$inferInsert {
  const secret = getSessionTokenSecret(process.env);
  return {
    id: session.id,
    guildId: session.guildId,
    user: session.user,
    discordRoleIds: session.discordRoleIds,
    capabilities: session.capabilities,
    accessToken: encryptSessionToken(session.accessToken, secret),
    refreshToken: encryptSessionToken(session.refreshToken, secret),
    tokenExpiresAt: new Date(session.tokenExpiresAt),
    expiresAt: new Date(session.expiresAt),
    updatedAt: new Date(session.validatedAt),
  };
}

function fromRow(row: typeof controlsSessions.$inferSelect): ControlsSession {
  const secret = getSessionTokenSecret(process.env);
  return {
    id: row.id,
    guildId: row.guildId,
    user: row.user as ControlsUser,
    discordRoleIds: toStringArray(row.discordRoleIds),
    capabilities: toStringArray(row.capabilities) as Capability[],
    accessToken: decryptSessionToken(row.accessToken, secret),
    refreshToken: decryptSessionToken(row.refreshToken, secret),
    tokenExpiresAt: row.tokenExpiresAt.getTime(),
    validatedAt: row.updatedAt.getTime(),
    expiresAt: row.expiresAt.getTime(),
  };
}

async function deleteExpiredSessions(now: number): Promise<void> {
  await db.delete(controlsSessions).where(and(lte(controlsSessions.expiresAt, new Date(now))));
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
