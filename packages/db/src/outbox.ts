import { db } from "./client";
import { discordOutbox } from "../schema/drizzle-schema";
import { eq, lte, and, or, inArray } from "drizzle-orm";

// ---------- Discord Outbox ----------

export type OutboxEventType =
  | "ticket_created"
  | "evidence_submitted"
  | "evidence_validated"
  | "score_credited"
  | "score_reversed"
  | "stale_alert"
  | "audit_log";

export interface EnqueueOutboxInput {
  guildId: string;
  eventType: OutboxEventType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  nextAttemptAt?: Date;
}

/**
 * Enqueue a message in the Discord outbox for async delivery.
 * Idempotent — returns existing entry if idempotency key matches.
 */
export async function enqueueOutbox(
  input: EnqueueOutboxInput
): Promise<{ id: string; alreadyExists: boolean }> {
  const existing = await db
    .select({ id: discordOutbox.id })
    .from(discordOutbox)
    .where(eq(discordOutbox.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0]!.id, alreadyExists: true };
  }

  const [row] = await db
    .insert(discordOutbox)
    .values({
      guildId: input.guildId,
      eventType: input.eventType,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      maxAttempts: input.maxAttempts ?? 5,
      nextAttemptAt: input.nextAttemptAt ?? new Date(),
    })
    .returning({ id: discordOutbox.id });

  if (!row) throw new Error("Failed to enqueue outbox message");

  return { id: row.id, alreadyExists: false };
}

/**
 * Fetch due outbox messages for processing.
 */
export async function fetchDueOutbox(limit = 20): Promise<
  Array<{
    id: string;
    guildId: string;
    eventType: string;
    payload: Record<string, unknown>;
    attempts: number;
    maxAttempts: number;
  }>
> {
  const rows = await db
    .select({
      id: discordOutbox.id,
      guildId: discordOutbox.guildId,
      eventType: discordOutbox.eventType,
      payload: discordOutbox.payload,
      attempts: discordOutbox.attempts,
      maxAttempts: discordOutbox.maxAttempts,
    })
    .from(discordOutbox)
    .where(
      and(
        or(
          eq(discordOutbox.status, "pending" as any),
          eq(discordOutbox.status, "failed" as any)
        ),
        lte(discordOutbox.nextAttemptAt, new Date())
      )
    )
    .limit(limit);

  return rows as Array<{
    id: string;
    guildId: string;
    eventType: string;
    payload: Record<string, unknown>;
    attempts: number;
    maxAttempts: number;
  }>;
}

/**
 * Mark an outbox message as sent.
 */
export async function markOutboxSent(id: string): Promise<void> {
  await db
    .update(discordOutbox)
    .set({ status: "sent" as any, updatedAt: new Date() })
    .where(eq(discordOutbox.id, id));
}

/**
 * Mark an outbox message as failed with retry scheduling.
 */
export async function markOutboxFailed(
  id: string,
  error: string
): Promise<void> {
  const row = await db
    .select({ attempts: discordOutbox.attempts, maxAttempts: discordOutbox.maxAttempts })
    .from(discordOutbox)
    .where(eq(discordOutbox.id, id))
    .limit(1);

  if (row.length === 0) return;

  const { attempts, maxAttempts } = row[0]!;
  const nextAttempts = attempts + 1;

  if (nextAttempts >= maxAttempts) {
    await db
      .update(discordOutbox)
      .set({
        status: "dead" as any,
        lastError: error,
        attempts: nextAttempts,
        updatedAt: new Date(),
      })
      .where(eq(discordOutbox.id, id));
  } else {
    // Exponential backoff: 500ms * 2^attempt + jitter
    const delayMs = Math.min(30_000, 500 * 2 ** attempts) + Math.random() * 250;
    const nextAttemptAt = new Date(Date.now() + delayMs);

    await db
      .update(discordOutbox)
      .set({
        status: "failed" as any,
        lastError: error,
        attempts: nextAttempts,
        nextAttemptAt,
        updatedAt: new Date(),
      })
      .where(eq(discordOutbox.id, id));
  }
}

// ---------- Private Channel Provisioning ----------

export interface CreateTicketChannelInput {
  guildId: string;
  ticketShortId: string;
  ticketType: string;
  creatorDiscordId: string;
  title: string;
  adminChannelId: string; // Channel where bot has manage permissions
}

/**
 * Create a private Discord channel for a ticket.
 * Returns the channel ID. Caller is responsible for Discord API permissions.
 */
export async function createTicketChannel(
  input: CreateTicketChannelInput
): Promise<string> {
  // In Phase 2.3 we record the intent. Actual Discord API call
  // happens in the bot layer (requires bot token + permissions).
  // This function enqueues the outbox event for the bot worker.
  const idempotencyKey = `channel:create:${input.guildId}:${input.ticketShortId}`;

  await enqueueOutbox({
    guildId: input.guildId,
    eventType: "ticket_created",
    idempotencyKey,
    payload: {
      ticketShortId: input.ticketShortId,
      ticketType: input.ticketType,
      creatorDiscordId: input.creatorDiscordId,
      title: input.title,
      adminChannelId: input.adminChannelId,
    },
  });

  // Return a placeholder channel ID — the bot worker replaces this
  // with the actual Discord channel ID when it processes the outbox.
  return `pending:${input.ticketShortId}`;
}
