import type { DeploymentStatusDto } from "../src/contracts";

const REQUIRED_DEPLOYMENT_ENV = [
  "DISCORD_CLIENT_ID",
  "DISCORD_TOKEN",
] as const;

type DeploymentEnv = Partial<Record<typeof REQUIRED_DEPLOYMENT_ENV[number] | "DISCORD_BOT_PERMISSIONS" | "DISCORD_GUILD_ID", string>>;

export function getDeploymentStatus(env: DeploymentEnv): DeploymentStatusDto {
  return {
    inviteUrl: env.DISCORD_CLIENT_ID ? buildBotInviteUrl(env.DISCORD_CLIENT_ID, env.DISCORD_BOT_PERMISSIONS) : undefined,
    requiredEnv: REQUIRED_DEPLOYMENT_ENV.map((key) => ({ key, present: Boolean(env[key]) })),
    actions: [
      {
        id: "register_commands",
        label: "Register guild slash commands",
        confirmation: "REGISTER",
      },
    ],
  };
}

export async function registerGuildCommandsAction(input: {
  confirmation: string;
  env: DeploymentEnv;
  guildId?: string;
  registerCommands: (clientId: string, guildId: string, token: string) => Promise<void>;
}): Promise<void> {
  if (input.confirmation !== "REGISTER") {
    throw new Error("Type REGISTER to register Discord commands");
  }

  const missing = REQUIRED_DEPLOYMENT_ENV.filter((key) => !input.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Discord deployment env: ${missing.join(", ")}`);
  }
  const guildId = input.guildId ?? input.env.DISCORD_GUILD_ID;
  if (!guildId) throw new Error("Missing Discord deployment guild");

  await input.registerCommands(
    input.env.DISCORD_CLIENT_ID!,
    guildId,
    input.env.DISCORD_TOKEN!,
  );
}

function buildBotInviteUrl(clientId: string, permissions = "0"): string {
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("permissions", permissions);
  url.searchParams.set("scope", "bot applications.commands");
  return url.toString();
}
