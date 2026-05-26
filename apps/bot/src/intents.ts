import { GatewayIntentBits } from "discord.js";

export function buildGatewayIntents(env: NodeJS.ProcessEnv): GatewayIntentBits[] {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ];

  if (env.DISCORD_ENABLE_GUILD_MEMBERS_INTENT === "true") {
    intents.push(GatewayIntentBits.GuildMembers);
  }

  return intents;
}
