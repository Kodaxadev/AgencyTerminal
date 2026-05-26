const DISCORD_API_BASE = "https://discord.com/api/v10";

type CommandOptionType = 1 | 3 | 6;

interface CommandChoice {
  name: string;
  value: string;
}

interface CommandOption {
  type: CommandOptionType;
  name: string;
  description: string;
  required?: boolean;
  choices?: CommandChoice[];
  options?: CommandOption[];
}

interface ApplicationCommand {
  type: 1;
  name: string;
  description: string;
  options?: CommandOption[];
}

interface CommandRegistrationResponse {
  ok: boolean;
  status: number;
}

const stringOption = (
  name: string,
  description: string,
  required: boolean,
  choices?: CommandChoice[],
): CommandOption => ({
  type: 3,
  name,
  description,
  required,
  ...(choices ? { choices } : {}),
});

const userOption = (name: string, description: string, required: boolean): CommandOption => ({
  type: 6,
  name,
  description,
  required,
});

const subcommand = (name: string, description: string, options: CommandOption[] = []): CommandOption => ({
  type: 1,
  name,
  description,
  ...(options.length > 0 ? { options } : {}),
});

export const commands: ApplicationCommand[] = [
  {
    type: 1,
    name: "evidence",
    description: "Submit performance evidence for review",
    options: [
      subcommand("submit", "Submit new evidence", [
        stringOption("metric", "Metric category", true, [
          { name: "PvP Kill Value", value: "pvp_kill_value" },
          { name: "Fleet Participation", value: "fleet_participation" },
          { name: "Contracts Completed", value: "contracts_completed" },
          { name: "Intel Acquisitions", value: "intelligence_acquisitions" },
          { name: "Tech/Dev Output", value: "technical_development_output" },
          { name: "Asset Contributions", value: "asset_contributions" },
          { name: "Exploration", value: "exploration" },
          { name: "Lore Discovery", value: "lore_discovery" },
        ]),
        stringOption("title", "Evidence title", true),
        stringOption("description", "Evidence description", false),
        userOption("subject", "Who should receive credit?", false),
        stringOption("link", "Evidence link", false),
      ]),
      subcommand("status", "Check evidence status", [
        stringOption("id", "Evidence ID", true),
      ]),
    ],
  },
  {
    type: 1,
    name: "ticket",
    description: "Create a workflow ticket",
    options: [
      subcommand("enlistment", "Start enlistment process"),
      subcommand("contract", "Open a contract ticket", [
        stringOption("title", "Contract title", true),
        stringOption("target", "Target name/tribe", false),
      ]),
      subcommand("intel", "Submit an intel report", [
        stringOption("title", "Intel title", true),
      ]),
      subcommand("clearance", "Request clearance", [
        stringOption("level", "Clearance level", true),
      ]),
      subcommand("doctrine", "Submit a doctrine challenge", [
        stringOption("title", "Challenge title", true),
      ]),
      subcommand("general", "Open a general ticket", [
        stringOption("title", "Ticket title", true),
      ]),
    ],
  },
  {
    type: 1,
    name: "director",
    description: "Director override commands",
    options: [
      subcommand("override", "Force-validate stale evidence", [
        stringOption("evidence_id", "Evidence ID", true),
        stringOption("reason", "Override reason", true),
      ]),
    ],
  },
];

export function commandNames(): string[] {
  return commands.map((command) => command.name);
}

export async function registerCommands(clientId: string, guildId: string, token: string): Promise<void> {
  const response = await fetch(`${DISCORD_API_BASE}/applications/${clientId}/guilds/${guildId}/commands`, {
    method: "PUT",
    headers: {
      authorization: `Bot ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
  }) as CommandRegistrationResponse;
  if (!response.ok) {
    throw new Error(`Discord command registration failed: ${response.status}`);
  }
}
