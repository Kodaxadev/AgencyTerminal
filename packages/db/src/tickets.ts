import { db } from "./client";
import { tickets, ticketEvents, ticketParticipants, workflowInstances } from "../schema/drizzle-schema";
import { enqueueOutbox } from "./outbox";
import { claimIdempotencyKey, completeIdempotencyKey } from "./idempotency";

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

export async function createTicket(
  input: CreateTicketInput,
  idempotencyKey: string,
): Promise<CreateTicketResult> {
  return db.transaction(async (tx) => {
    const claim = await claimIdempotencyKey({
      key: idempotencyKey,
      guildId: input.guildId,
      scope: "ticket:create",
      actorDiscordId: input.creatorDiscordId,
    }, tx);

    if (!claim.acquired) {
      const result = getTicketIdempotencyResult(claim.result);
      if (result) return result;
      throw new Error("Duplicate ticket submission is already processing");
    }

    const [ticket] = await tx
      .insert(tickets)
      .values({
        guildId: input.guildId,
        channelId: input.channelId,
        creatorDiscordId: input.creatorDiscordId,
        type: input.type,
        status: getInitialTicketStatus(input.type),
        lifecycleStatus: "open",
        priority: input.priority ?? "medium",
        sensitivity: input.sensitivity ?? "member",
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

    if (!ticket) throw new Error("Failed to create ticket");

    const allParticipants = [input.creatorDiscordId, ...(input.participantIds ?? [])];
    for (const discordId of allParticipants) {
      await tx.insert(ticketParticipants).values({
        ticketId: ticket.id,
        discordId,
        role: discordId === input.creatorDiscordId ? "creator" : "participant",
      });
    }

    await tx.insert(workflowInstances).values({
      ticketId: ticket.id,
      workflowType: input.type,
      workflowStatus: getInitialWorkflowStatus(input.type),
    });

    await tx.insert(ticketEvents).values({
      ticketId: ticket.id,
      actorDiscordId: input.creatorDiscordId,
      eventType: "ticket_created",
      eventPayload: { idempotencyKey, type: input.type } as Record<string, unknown>,
    });

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
    }, tx);

    await completeIdempotencyKey(idempotencyKey, ticket, tx);
    return ticket;
  });
}

function getTicketIdempotencyResult(payload: Record<string, unknown> | null): CreateTicketResult | null {
  if (!payload || typeof payload.id !== "string" || typeof payload.channelId !== "string") return null;
  return {
    id: payload.id,
    shortId: typeof payload.shortId === "string" ? payload.shortId : null,
    channelId: payload.channelId,
  };
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
