import { PermissionsBitField } from "discord.js";

export type ReviewCapability = "can_validate_evidence";
export type OverrideCapability = "can_override_quorum";
export type StaleAlertPostStatus = "sent" | "missing_ops_channel" | "send_failed";

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

export function getStaleAlertContent(): string {
  return "Stale evidence alert";
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
