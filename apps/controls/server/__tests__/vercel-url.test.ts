import { describe, expect, it } from "vitest";
import { rewriteVercelApiUrl } from "../vercel-url";

describe("Vercel API URL rewrite", () => {
  it("restores the original API path from the Vercel rewrite query", () => {
    expect(rewriteVercelApiUrl("/api/index?path=auth/status")).toBe("/api/auth/status");
    expect(rewriteVercelApiUrl("/api/index?path=deployment/register-commands")).toBe("/api/deployment/register-commands");
  });

  it("preserves remaining query parameters", () => {
    expect(rewriteVercelApiUrl("/api/index?path=auth/discord/callback&code=abc&state=xyz"))
      .toBe("/api/auth/discord/callback?code=abc&state=xyz");
  });
});
