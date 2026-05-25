import { Client, GatewayIntentBits } from "discord.js";
import { closeDbPool } from "@agency-terminal/db";
import { registerCommands } from "./commands";
import { handleInteraction } from "./handlers";
import { startOutboxLoop } from "./outbox-loop";
import { installRuntimeLifecycle } from "./runtime-lifecycle";

const requiredEnv = [
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_GUILD_ID",
  "DATABASE_URL",
] as const;

function validateEnv(): void {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`SIG//AGENCY TERMINAL`);
    console.error(`STATUS // CODE 503 // MISSING ENVIRONMENT`);
    console.error(`Required: ${missing.join(", ")}`);
    process.exit(1);
  }
}

function startupSelfCheck(client: Client): void {
  const checks: { id: string; label: string; status: string }[] = [];

  checks.push({
    id: "discord_token",
    label: "Discord Token",
    status: process.env.DISCORD_TOKEN ? "ok" : "fail",
  });

  if (client.isReady()) {
    checks.push({
      id: "discord_gateway",
      label: "Discord Gateway",
      status: "ok",
    });
    checks.push({
      id: "guild_access",
      label: `Guild: ${client.guilds.cache.size} accessible`,
      status: "ok",
    });
  }

  checks.push({
    id: "database",
    label: "Database (pending connection)",
    status: "warn",
  });

  console.log("\nSIG//AGENCY TERMINAL — STARTUP SELF-CHECK");
  checks.forEach((c) => {
    const marker = c.status === "ok" ? "OK" : c.status === "warn" ? "WARN" : "FAIL";
    console.log(`  [${marker}] ${c.label}`);
  });
}

async function main() {
  validateEnv();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.on("interactionCreate", (interaction) => {
    void handleInteraction(interaction);
  });

  client.once("ready", () => {
    console.log(`SIG//AGENCY TERMINAL — ONLINE`);
    console.log(`Connected as ${client.user?.tag}`);
    startupSelfCheck(client);
    void registerCommands(
      process.env.DISCORD_CLIENT_ID!,
      process.env.DISCORD_GUILD_ID!,
      process.env.DISCORD_TOKEN!,
    );

    const outboxLoop = startOutboxLoop({
      client,
      guildId: process.env.DISCORD_GUILD_ID!,
    });
    installRuntimeLifecycle({
      loop: outboxLoop,
      client,
      closeDbPool,
    });
  });

  await client.login(process.env.DISCORD_TOKEN);
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
