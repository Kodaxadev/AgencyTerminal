import { describe, expect, it } from "vitest";
import {
  assertPrivateChannelConfig,
  buildDenyEveryoneOverwrite,
  canHandleOverride,
  canHandleReview,
  findExistingTicketChannel,
  getDbUnavailableReply,
  getEvidenceLinkReply,
  getQuorumReachedReply,
  getStaleAlertContent,
  getTicketChannelTopic,
  hasExistingStaleAlert,
  shouldMarkStaleAlertNotified,
} from "../safety";

describe("bot safety helpers", () => {
  it("fails closed on unavailable DB instead of claiming creation succeeded", () => {
    expect(getDbUnavailableReply("ticket")).not.toMatch(/created|submitted|simulated|DEV MODE/i);
    expect(getDbUnavailableReply("evidence")).not.toMatch(/created|submitted|simulated|DEV MODE/i);
  });

  it("does not expose submitted evidence URLs in Discord response content", () => {
    const reply = getEvidenceLinkReply("https://sensitive.example/evidence.png");

    expect(reply.ephemeral).toBe(true);
    expect(reply.content).not.toContain("https://sensitive.example/evidence.png");
  });

  it("blocks review actions without mapped evidence validation capability", () => {
    expect(canHandleReview(["can_manage_contracts"])).toBe(false);
    expect(canHandleReview(["can_validate_evidence"])).toBe(true);
  });

  it("blocks director override actions without mapped quorum override capability", () => {
    expect(canHandleOverride(["can_validate_evidence"])).toBe(false);
    expect(canHandleOverride(["can_override_quorum"])).toBe(true);
  });

  it("uses truthful quorum copy without claiming score processing started", () => {
    const reply = getQuorumReachedReply("EVD-0001");

    expect(reply).toContain("validated");
    expect(reply).toContain("pending");
    expect(reply).not.toMatch(/Score credit processing/i);
  });

  it("does not mass-mention stale operational alerts", () => {
    expect(getStaleAlertContent()).not.toContain("@everyone");
  });

  it("marks stale alert notification complete only after a successful post", () => {
    expect(shouldMarkStaleAlertNotified("sent")).toBe(true);
    expect(shouldMarkStaleAlertNotified("missing_ops_channel")).toBe(false);
    expect(shouldMarkStaleAlertNotified("send_failed")).toBe(false);
  });

  it("marks ticket channels with deterministic ticket metadata", () => {
    expect(getTicketChannelTopic("Contract", "TKT-1", "ticket-uuid")).toContain("agency-ticket:ticket-uuid");
  });

  it("detects existing ticket channels before retry creates duplicates", () => {
    const existing = findExistingTicketChannel([
      { id: "channel-1", topic: "Contract | TKT-1 [agency-ticket:ticket-uuid]" },
      { id: "channel-2", topic: "Other" },
    ], "ticket-uuid");

    expect(existing?.id).toBe("channel-1");
  });

  it("detects already-posted stale alerts before retry posts duplicates", () => {
    expect(getStaleAlertContent("ev-1")).toContain("stale-alert:ev-1");
    expect(hasExistingStaleAlert([{ content: "Stale evidence alert [stale-alert:ev-1]" }], "ev-1")).toBe(true);
  });

  it("uses the guild everyone role id for private channel denial", () => {
    const overwrite = buildDenyEveryoneOverwrite("guild-everyone-role");

    expect(overwrite.id).toBe("guild-everyone-role");
    expect(overwrite.id).not.toBe("everyone");
  });

  it("fails safely when private channel config cannot deny @everyone", () => {
    expect(() => assertPrivateChannelConfig("")).toThrow(/everyone role/i);
  });
});
