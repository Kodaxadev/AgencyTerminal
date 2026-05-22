export interface EvidenceIdempotencyResult {
  id: string;
  shortId: string | null;
}

export function getEvidenceEventTicketId(
  ticketId: string | undefined,
  _evidenceId: string,
): string | null {
  return ticketId ?? null;
}

export function getEvidenceIdempotencyResult(
  payload: Record<string, unknown>,
): EvidenceIdempotencyResult | null {
  if (typeof payload.evidenceId !== "string") return null;

  return {
    id: payload.evidenceId,
    shortId: typeof payload.evidenceShortId === "string" ? payload.evidenceShortId : null,
  };
}

export function shouldPersistTicketChannelId(channelId: string): boolean {
  return channelId.length > 0 && !channelId.startsWith("pending:");
}
