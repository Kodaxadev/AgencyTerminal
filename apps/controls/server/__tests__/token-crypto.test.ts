import { describe, expect, it } from "vitest";
import {
  decryptSessionToken,
  encryptSessionToken,
  getSessionTokenSecret,
} from "../auth/token-crypto";

describe("controls session token crypto", () => {
  it("encrypts persisted OAuth tokens without retaining raw text", () => {
    const encrypted = encryptSessionToken("discord-access-token", "test-secret");

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("discord-access-token");
    expect(decryptSessionToken(encrypted, "test-secret")).toBe("discord-access-token");
  });

  it("keeps legacy plaintext sessions readable until they expire", () => {
    expect(decryptSessionToken("legacy-token", "test-secret")).toBe("legacy-token");
  });

  it("prefers a dedicated token encryption secret over the session cookie secret", () => {
    expect(getSessionTokenSecret({
      CONTROLS_SESSION_SECRET: "session-secret",
      CONTROLS_TOKEN_ENCRYPTION_SECRET: "token-secret",
    })).toBe("token-secret");
  });
});
