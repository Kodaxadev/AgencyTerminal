import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import {
  buildMutationAction,
  getMutationRateLimit,
  requireTrustedMutationOrigin,
} from "../request-guards";

describe("controls request guards", () => {
  it("accepts same-origin unsafe mutations", () => {
    expect(() => requireTrustedMutationOrigin(makeRequest({
      method: "POST",
      origin: "https://atcc.kodaxa.dev",
    }), {
      NODE_ENV: "production",
      CONTROLS_PUBLIC_BASE_URL: "https://atcc.kodaxa.dev",
    })).not.toThrow();
  });

  it("rejects cross-origin unsafe mutations", () => {
    expect(() => requireTrustedMutationOrigin(makeRequest({
      method: "PATCH",
      origin: "https://attacker.example",
    }), {
      NODE_ENV: "production",
      CONTROLS_PUBLIC_BASE_URL: "https://atcc.kodaxa.dev",
    })).toThrow("Origin is not allowed");
  });

  it("rejects missing production origins for unsafe mutations", () => {
    expect(() => requireTrustedMutationOrigin(makeRequest({ method: "DELETE" }), {
      NODE_ENV: "production",
      CONTROLS_PUBLIC_BASE_URL: "https://atcc.kodaxa.dev",
    })).toThrow("Missing Origin");
  });

  it("keeps mutation throttle defaults conservative and configurable", () => {
    expect(getMutationRateLimit({})).toEqual({ limitCount: 20, windowSeconds: 60 });
    expect(getMutationRateLimit({
      CONTROLS_MUTATION_LIMIT_PER_MINUTE: "7",
    })).toEqual({ limitCount: 7, windowSeconds: 60 });
  });

  it("builds stable throttle action keys without query strings", () => {
    expect(buildMutationAction("POST", new URL("/api/roles?x=1", "https://atcc.kodaxa.dev"))).toBe("POST /api/roles");
  });
});

function makeRequest(input: {
  method: string;
  origin?: string;
  host?: string;
}): IncomingMessage {
  return {
    method: input.method,
    headers: {
      ...(input.origin ? { origin: input.origin } : {}),
      host: input.host ?? "atcc.kodaxa.dev",
    },
  } as IncomingMessage;
}
