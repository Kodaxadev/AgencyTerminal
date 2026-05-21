import { db } from "./client";
import { tickets, ticketEvents, ticketParticipants, workflowInstances } from "../schema/drizzle-schema";
import { eq, sql } from "drizzle-orm";
import { enqueueOutbox } from "./outbox";

export type TicketType =
  | "enlistment"
  | "contract"
  | "intel"
  | "clearance"
  | "doctrine_challenge"
  | "general";

export interface CreateTicketInput {
  guildId: string;
  channelId: string;
  creatorDiscordId: string;
  type: TicketType;
  title: string;
  summary?: string;
  priority?: "low" | "medium" | "high" | "critical";
  sensitivity?: "public" | "member" | "officer_only" | "director_only";
  characterName?: string;
  walletAddress?: string;
  tribeName?: string;
  systemName?: string;
  smartObjectId?: string;
  targetName?: string;
  targetTribe?: string;
  contractType?: string;
  participantIds?: string[];
}

export interface CreateTicketResult {
  id: string;
  shortId: string | null;
  channelId: string;
}

/**
 * Create a ticket with workflow instance and initial event.
 * Returns the ticket ID, short ID, and channel ID.
 */
export async function createTicket(
  input: CreateTicketInput,
  idempotencyKey: string
): Promise<CreateTicketResult> {
  // Check idempotency — if this key already produced a ticket, return it
  const existing = await db
    .select({ id: ticketEvents.id, ticketId: ticketEvents.ticketId })
    .from(ticketEvents)
    .where(sql`${ticketEvents.eventPayload} @> ${JSON.stringify({ idempotencyKey })}`)
    .limit(1);

  if (existing.length > 0 && existing[0]!.ticketId) {
    const ticket = await db
      .select({ id: tickets.id, shortId: tickets.shortId, channelId: tickets.channelId })
      .from(tickets)
      .where(eq(tickets.id, existing[0]!.ticketId))
      .limit(1);

    if (ticket.length > 0) {
      return ticket[0]!;
    }
  }

  const initialStatus = getInitialTicketStatus(input.type);
  const priority = input.priority ?? "medium";
  const sensitivity = input.sensitivity ?? "member";

  const [ticket] = await db
    .insert(tickets)
    .values({
      guildId: input.guildId,
      channelId: input.channelId,
      creatorDiscordId: input.creatorDiscordId,
      type: input.type,
      status: initialStatus,
      lifecycleStatus: "open",
      priority,
      sensitivity,
      title: input.title,
      summary: input.summary ?? "",
      characterName: input.characterName,
      walletAddress: input.walletAddress,
      tribeName: input.tribeName,
      systemName: input.systemName,
      smartObjectId: input.smartObjectId,
      targetName: input.targetName,
      targetTribe: input.targetTribe,
      contractType: input.contractType,
    })
    .returning({
      id: tickets.id,
      shortId: tickets.shortId,
      channelId: tickets.channelId,
    });

  if (!ticket) {
    throw new Error("Failed to create ticket");
  }

  // Add participants
  const allParticipants = [
    input.creatorDiscordId,
    ...(input.participantIds ?? []),
  ];

  for (const discordId of allParticipants) {
    await db.insert(ticketParticipants).values({
      ticketId: ticket.id,
      discordId,
      role: discordId === input.creatorDiscordId ? "creator" : "participant",
    });
  }

  // Create workflow instance
  await db.insert(workflowInstances).values({
    ticketId: ticket.id,
    workflowType: input.type,
    workflowStatus: getInitialWorkflowStatus(input.type),
  });

  // Record initial event
  await db.insert(ticketEvents).values({
    ticketId: ticket.id,
    actorDiscordId: input.creatorDiscordId,
    eventType: "ticket_created",
    eventPayload: {
      idempotencyKey,
      type: input.type,
    } as Record<string, unknown>,
  });

  // Enqueue outbox for private channel creation
  await enqueueOutbox({
    guildId: input.guildId,
    eventType: "ticket_created",
    idempotencyKey: `channel:create:${input.guildId}:${ticket.id}`,
    payload: {
      ticketId: ticket.id,
      ticketShortId: ticket.shortId,
      ticketType: input.type,
      creatorDiscordId: input.creatorDiscordId,
      title: input.title,
      channelId: ticket.channelId,
    },
  });

  return ticket;
}

function getInitialTicketStatus(_type: TicketType): "submitted" {
  return "submitted";
}

function getInitialWorkflowStatus(type: TicketType): string {
  switch (type) {
    case "enlistment":
      return "submitted";
    case "contract":
      return "intake";
    case "intel":
      return "received";
    case "clearance":
      return "requested";
    case "doctrine_challenge":
      return "submitted";
    case "general":
      return "submitted";
  }
}
