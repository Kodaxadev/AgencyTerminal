import type { IncomingMessage, ServerResponse } from "node:http";
import type { ControlsUser } from "../src/contracts";
import {
  buildMutationAction,
  getMutationRateLimit,
  isUnsafeMethod,
} from "./request-guards";
import { writeJson } from "./http-utils";
import type { RateLimitInput, RateLimitResult } from "./rate-limit-repository";

export interface MutationRateLimitRepository {
  consumeRateLimit(input: RateLimitInput): Promise<RateLimitResult>;
}

export async function handleMutationRateLimit(input: {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  env: NodeJS.ProcessEnv;
  repository: MutationRateLimitRepository;
  session: {
    guildId: string;
    user: ControlsUser;
  };
}): Promise<boolean> {
  if (!isUnsafeMethod(input.req.method)) return false;

  const settings = getMutationRateLimit(input.env);
  const result = await input.repository.consumeRateLimit({
    guildId: input.session.guildId,
    actorDiscordId: input.session.user.id,
    action: buildMutationAction(input.req.method, input.url),
    limitCount: settings.limitCount,
    windowSeconds: settings.windowSeconds,
  });

  if (result.allowed) return false;
  input.res.setHeader("retry-after", String(result.retryAfterSeconds));
  writeJson(input.res, 429, { error: "Mutation rate limit exceeded" });
  return true;
}
