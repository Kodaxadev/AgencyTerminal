import { describe, expect, it } from "vitest";
import {
  assertPrivateChannelConfig,
  buildDenyEveryoneOverwrite,
  canHandleReview,
  getDbUnavailableReply,
  getEvidenceLinkReply,
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

  it("uses the guild everyone role id for private channel denial", () => {
    const overwrite = buildDenyEveryoneOverwrite("guild-everyone-role");

    expect(overwrite.id).toBe("guild-everyone-role");
    expect(overwrite.id).not.toBe("everyone");
  });

  it("fails safely when private channel config cannot deny @everyone", () => {
    expect(() => assertPrivateChannelConfig("")).toThrow(/everyone role/i);
  });
});
