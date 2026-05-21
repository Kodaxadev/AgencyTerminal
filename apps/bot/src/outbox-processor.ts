import {
  ChannelType,
  Client,
  Guild,
  PermissionOverwrites,
  PermissionsBitField,
  TextChannel,
} from "discord.js";
import { fetchDueOutbox, markOutboxSent, markOutboxFailed } from "@agency-terminal/db";

function denyEveryone() {
  return { deny: new PermissionsBitField([PermissionsBitField.Flags.ViewChannel]), id: "everyone" as any };
}

function allowCreator(discordId: string) {
  return {
    allow: new PermissionsBitField([
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.ReadMessageHistory,
    ]),
    id: discordId,
  };
}

/**
 * Process due outbox messages by creating Discord channels for tickets.
 * Called on a timer (e.g. every 10 seconds).
 */
export async function processOutbox(
  client: Client,
  maxBatch = 20
): Promise<{ processed: number; errors: number }> {
  const messages = await fetchDueOutbox(maxBatch);
  let processed = 0;
  let errors = 0;

  for (const msg of messages) {
    try {
      if (msg.eventType === "ticket_created") {
        await handleTicketCreatedOutbox(client, msg);
      }
      await markOutboxSent(msg.id);
      processed++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await markOutboxFailed(msg.id, message);
      errors++;
    }
  }

  return { processed, errors };
}

async function handleTicketCreatedOutbox(
  client: Client,
  msg: {
    id: string;
    guildId: string;
    eventType: string;
    payload: Record<string, unknown>;
    attempts: number;
    maxAttempts: number;
  },
): Promise<void> {
  const guild = await client.guilds.fetch(msg.guildId);
  const p = msg.payload;

  const ticketShortId = (p.ticketShortId as string) ?? "unknown";
  const ticketType = (p.ticketType as string) ?? "general";
  const creatorId = p.creatorDiscordId as string;
  const title = (p.title as string) ?? "Ticket";

  const channelName = `${ticketType}-${ticketShortId}`.toLowerCase().replace(/_/g, "-");

  const overwrites = [denyEveryone(), allowCreator(creatorId)];

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites,
    topic: `${title} | ${ticketShortId}`,
    reason: `Ticket ${ticketShortId} created`,
  });

  // Send welcome message
  await (channel as TextChannel).send({
    content: `<@${creatorId}> — Your ticket **${ticketShortId}** has been created.`,
  });
}
