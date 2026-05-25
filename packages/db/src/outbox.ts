import { db } from "./client";
import { discordOutbox, tickets } from "../schema/drizzle-schema";
import { eq, lte, and, or, sql } from "drizzle-orm";

// ---------- Discord Outbox ----------

export type OutboxEventType =
  | "ticket_created"
  | "evidence_submitted"
  | "evidence_validated"
  | "score_credited"
  | "score_reversed"
  | "stale_alert"
  | "audit_log"
  | "evidence_review_projection";

export interface EnqueueOutboxInput {
  guildId: string;
  eventType: OutboxEventType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  nextAttemptAt?: Date;
}

type DbExecutor = Pick<typeof db, "insert" | "select" | "update" | "execute">;
export const DEFAULT_OUTBOX_PROCESSING_LEASE_MS = 5 * 60 * 1000;

export interface RecoverAbandonedOutboxClaimsInput {
  leaseMs?: number;
  now?: Date;
  client?: Pick<typeof db, "execute">;
}

export interface RecoverAbandonedOutboxClaimsResult {
  recovered: number;
  leaseMs: number;
  cutoff: Date;
}

/**
 * Enqueue a message in the Discord outbox for async delivery.
 * Idempotent — returns existing entry if idempotency key matches.
 */
export async function enqueueOutbox(
  input: EnqueueOutboxInput,
  client: DbExecutor = db,
): Promise<{ id: string; alreadyExists: boolean }> {
  const existing = await client
    .select({ id: discordOutbox.id })
    .from(discordOutbox)
    .where(eq(discordOutbox.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existing.length > 0) {
    return { id: existing[0].id, alreadyExists: true };
  }

  const [row] = await client
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
          eq(discordOutbox.status, "pending"),
          eq(discordOutbox.status, "failed")
        ),
        lte(discordOutbox.nextAttemptAt, new Date())
      )
    )
    .limit(limit);

  return rows as unknown as Array<{
    id: string;
    guildId: string;
    eventType: string;
    payload: Record<string, unknown>;
    attempts: number;
    maxAttempts: number;
  }>;
}

export async function claimDueOutbox(limit = 20): Promise<
  Array<{
    id: string;
    guildId: string;
    eventType: string;
    payload: Record<string, unknown>;
    attempts: number;
    maxAttempts: number;
  }>
> {
  const rows = await db.execute(sql`
    with due as (
      select id
      from discord_outbox
      where status in ('pending', 'failed')
        and next_attempt_at <= now()
      order by next_attempt_at asc, created_at asc
      limit ${limit}
      for update skip locked
    )
    update discord_outbox
    set status = 'processing',
        updated_at = now()
    where id in (select id from due)
    returning id,
      guild_id as "guildId",
      event_type as "eventType",
      payload,
      attempts,
      max_attempts as "maxAttempts"
  `);

  return rows as unknown as Array<{
    id: string;
    guildId: string;
    eventType: string;
    payload: Record<string, unknown>;
    attempts: number;
    maxAttempts: number;
  }>;
}

export async function recoverAbandonedOutboxClaims(
  input: RecoverAbandonedOutboxClaimsInput = {},
): Promise<RecoverAbandonedOutboxClaimsResult> {
  const leaseMs = input.leaseMs ?? DEFAULT_OUTBOX_PROCESSING_LEASE_MS;
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - leaseMs);
  const client = input.client ?? db;
  const reason = "abandoned_processing_claim_recovered";

  const rows = await client.execute(sql`
    update discord_outbox
    set status = 'failed',
        last_error = ${reason},
        next_attempt_at = ${now},
        updated_at = ${now}
    where status = 'processing'
      and updated_at <= ${cutoff}
    returning id
  `);

  return {
    recovered: Array.isArray(rows) ? rows.length : 0,
    leaseMs,
    cutoff,
  };
}

/**
 * Mark an outbox message as sent.
 */
export async function markOutboxSent(id: string): Promise<void> {
  await db
    .update(discordOutbox)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(discordOutbox.id, id));
}

export async function persistTicketChannelId(
  ticketId: string,
  channelId: string,
): Promise<void> {
  await db
    .update(tickets)
    .set({ channelId, updatedAt: new Date() })
    .where(eq(tickets.id, ticketId));
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

  const failedRow = row[0];
  if (!failedRow) return;

  const { attempts, maxAttempts } = failedRow;
  const nextAttempts = attempts + 1;

  if (nextAttempts >= maxAttempts) {
    await db
      .update(discordOutbox)
      .set({
        status: "dead",
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
        status: "failed",
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
