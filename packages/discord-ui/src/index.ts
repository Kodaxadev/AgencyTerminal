// Agency Terminal Discord UI — Embed builders with terminal language.
// All embeds follow the SIG//AGENCY TERMINAL format.

import { EmbedBuilder as DEmbedBuilder } from "discord.js";
import type { HealthCheckStatus } from "@agency-terminal/core";

export function statusColor(status: HealthCheckStatus): number {
  switch (status) {
    case "ok":
      return 0x34d399;
    case "warn":
      return 0xfbbf24;
    case "fail":
      return 0xf87171;
  }
}

export function createStatusEmbed(
  title: string,
  code: number,
  label: string,
  body: string,
): DEmbedBuilder {
  return new DEmbedBuilder()
    .setTitle(`SIG//AGENCY TERMINAL`)
    .setDescription(
      `STATUS // CODE ${code} // ${label}\n\n${body}`,
    )
    .setColor(statusColor(code < 300 ? "ok" : code < 500 ? "warn" : "fail"))
    .setFooter({ text: title });
}

export function createAcceptedEmbed(detail: string): DEmbedBuilder {
  return new DEmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(`STATUS // CODE 200 // ACCEPTED\n\n${detail}`)
    .setColor(0x34d399);
}

export function createRejectedEmbed(detail: string): DEmbedBuilder {
  return new DEmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(`STATUS // CODE 403 // REJECTED\n\n${detail}`)
    .setColor(0xf87171);
}

export function createArchivedEmbed(detail: string): DEmbedBuilder {
  return new DEmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(`STATUS // CODE 204 // ARCHIVED\n\nNO FURTHER ACTION REQUIRED\n\n${detail}`)
    .setColor(0x71717a);
}

export function createStaleEmbed(detail: string): DEmbedBuilder {
  return new DEmbedBuilder()
    .setTitle("SIG//AGENCY TERMINAL")
    .setDescription(`STATUS // CODE 408 // REVIEW TIMEOUT\n\n[ STALE — NEEDS RESOLUTION ]\n\n${detail}`)
    .setColor(0xfbbf24);
}
