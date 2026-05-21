import { SlashCommandBuilder, REST, Routes } from "discord.js";

export const evidenceSubmit = new SlashCommandBuilder()
  .setName("evidence")
  .setDescription("Submit performance evidence for review")
  .addSubcommand((sub) =>
    sub
      .setName("submit")
      .setDescription("Submit new evidence")
      .addStringOption((opt) =>
        opt.setName("metric").setDescription("Metric category").setRequired(true)
          .addChoices(
            { name: "PvP Kill Value", value: "pvp_kill_value" },
            { name: "Fleet Participation", value: "fleet_participation" },
            { name: "Contracts Completed", value: "contracts_completed" },
            { name: "Intel Acquisitions", value: "intelligence_acquisitions" },
            { name: "Tech/Dev Output", value: "technical_development_output" },
            { name: "Asset Contributions", value: "asset_contributions" },
            { name: "Exploration", value: "exploration" },
            { name: "Lore Discovery", value: "lore_discovery" },
          ),
      )
      .addStringOption((opt) =>
        opt.setName("title").setDescription("Evidence title").setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName("description").setDescription("Evidence description").setRequired(false),
      )
      .addUserOption((opt) =>
        opt.setName("subject").setDescription("Who should receive credit? (default: yourself)").setRequired(false),
      )
      .addStringOption((opt) =>
        opt.setName("link").setDescription("Evidence link (killboard, screenshot, etc.)").setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("status")
      .setDescription("Check evidence status")
      .addStringOption((opt) =>
        opt.setName("id").setDescription("Evidence ID").setRequired(true),
      ),
  );

export const commands = [evidenceSubmit.toJSON()];

export async function registerCommands(clientId: string, guildId: string, token: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });
  console.log(`Registered ${commands.length} slash command(s).`);
}
