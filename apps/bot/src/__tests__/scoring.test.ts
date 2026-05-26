import { beforeEach, describe, expect, it, vi } from "vitest";
import { processScoreCredits } from "../scoring";

const dbMocks = vi.hoisted(() => ({
  creditScore: vi.fn(),
  getLatestMetricConfig: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@agency-terminal/db", () => dbMocks);

vi.mock("@agency-terminal/discord-ui", () => ({
  createScoreCreditEmbed: vi.fn((event: unknown) => ({ event })),
}));

describe("processScoreCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.creditScore.mockResolvedValue(undefined);
    dbMocks.writeAuditLog.mockResolvedValue(undefined);
    dbMocks.getLatestMetricConfig.mockResolvedValue(null);
  });

  it("uses the latest guild metric config when crediting score", async () => {
    dbMocks.getLatestMetricConfig.mockResolvedValueOnce({
      category: "technical_development_output",
      basePoints: 25,
      visibility: "public",
      enabled: true,
      version: 3,
    });
    const interaction = makeButtonInteraction();

    await processScoreCredits(
      interaction as never,
      "evidence-1",
      "guild-1",
      "agent-1",
      "technical_development_output",
    );

    expect(dbMocks.getLatestMetricConfig).toHaveBeenCalledWith("guild-1", "technical_development_output");
    expect(dbMocks.creditScore).toHaveBeenCalledWith(expect.objectContaining({
      pointsApproved: 25,
      metricCategory: "technical_development_output",
    }), "score:credit:evidence-1:agent-1");
  });

  it("does not credit or announce score when the latest metric config is disabled", async () => {
    dbMocks.getLatestMetricConfig.mockResolvedValueOnce({
      category: "technical_development_output",
      basePoints: 25,
      visibility: "public",
      enabled: false,
      version: 4,
    });
    const interaction = makeButtonInteraction();

    await processScoreCredits(
      interaction as never,
      "evidence-1",
      "guild-1",
      "agent-1",
      "technical_development_output",
    );

    expect(dbMocks.creditScore).not.toHaveBeenCalled();
    expect(dbMocks.writeAuditLog).not.toHaveBeenCalled();
    expect(interaction.followUp).not.toHaveBeenCalled();
  });
});

function makeButtonInteraction() {
  return {
    followUp: vi.fn().mockResolvedValue(undefined),
  };
}
