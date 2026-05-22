import { PermissionsBitField } from "discord.js";

export type ReviewCapability = "can_validate_evidence";

export function getDbUnavailableReply(action: "ticket" | "evidence" | "review"): string {
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
