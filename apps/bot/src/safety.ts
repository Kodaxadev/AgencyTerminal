import { PermissionsBitField } from "discord.js";

export type ReviewCapability = "can_validate_evidence";
export type OverrideCapability = "can_override_quorum";
export type StaleAlertPostStatus = "sent" | "missing_ops_channel" | "send_failed";
export interface ChannelLike {
  id: string;
  topic?: string | null;
}
export interface MessageLike {
  content?: string | null;
}

export function getDbUnavailableReply(action: "ticket" | "evidence" | "review" | "override"): string {
  return `Database unavailable. ${action} was not recorded; please retry after operations confirms recovery.`;
}

export function getEvidenceLinkReply(_url: string): { content: string; ephemeral: true } {
  return {
    content: "Evidence link received and stored with the evidence record.",
    ephemeral: true,
  };
}

export function canHandleReview(capabilities: string[]): boolean {
  return capabilities.includes("can_validate_evidence");
}

export function canHandleOverride(capabilities: string[]): boolean {
  return capabilities.includes("can_override_quorum");
}

export function getQuorumReachedReply(evidenceId: string): string {
  return `Evidence **${evidenceId}** is validated. Score credit remains pending a configured credit step.`;
}

export function getTicketChannelMarker(ticketId: string): string {
  return `[agency-ticket:${ticketId}]`;
}

export function getTicketChannelTopic(title: string, ticketShortId: string, ticketId?: string): string {
  return ticketId ? `${title} | ${ticketShortId} ${getTicketChannelMarker(ticketId)}` : `${title} | ${ticketShortId}`;
}

export function findExistingTicketChannel(channels: ChannelLike[], ticketId: string): ChannelLike | undefined {
  const marker = getTicketChannelMarker(ticketId);
  return channels.find((channel) => channel.topic?.includes(marker));
}

export function getStaleAlertMarker(evidenceId: string): string {
  return `[stale-alert:${evidenceId}]`;
}

export function getStaleAlertContent(evidenceId?: string): string {
  return evidenceId ? `Stale evidence alert ${getStaleAlertMarker(evidenceId)}` : "Stale evidence alert";
}

export function hasExistingStaleAlert(messages: MessageLike[], evidenceId: string): boolean {
  const marker = getStaleAlertMarker(evidenceId);
  return messages.some((message) => message.content?.includes(marker));
}

export function shouldMarkStaleAlertNotified(status: StaleAlertPostStatus): boolean {
  return status === "sent";
}

export function buildDenyEveryoneOverwrite(everyoneRoleId: string): {
  id: string;
  deny: PermissionsBitField;
} {
  assertPrivateChannelConfig(everyoneRoleId);
  return {
    id: everyoneRoleId,
    deny: new PermissionsBitField([PermissionsBitField.Flags.ViewChannel]),
  };
}

export function assertPrivateChannelConfig(everyoneRoleId: string): void {
  if (!everyoneRoleId) {
    throw new Error("Cannot create private channel without guild everyone role id");
  }
}
