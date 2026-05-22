import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.fn();
const update = vi.fn();
const insert = vi.fn();
const set = vi.fn();
const where = vi.fn();
const returning = vi.fn();
const values = vi.fn();

vi.mock("../client", () => ({
  db: { transaction },
}));

describe("directorOverrideEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    returning.mockResolvedValue([{ id: "ev-1" }]);
    where.mockReturnValue({ returning });
    update.mockReturnValue({ set });
    set.mockReturnValue({ where });
    values.mockResolvedValue(undefined);
    insert.mockReturnValue({ values });
    transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      return callback({ update, insert });
    });
  });

  it("updates evidence and writes the audit log inside one transaction", async () => {
    const { directorOverrideEvidence } = await import("../evidence");

    await directorOverrideEvidence("ev-1", "director-1", "Timeout quorum correction", "guild-1");

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      guildId: "guild-1",
      actorDiscordId: "director-1",
      action: "director_override",
      subjectId: "ev-1",
    }));
  });

  it("does not write audit when the evidence update fails", async () => {
    returning.mockRejectedValueOnce(new Error("update failed"));
    const { directorOverrideEvidence } = await import("../evidence");

    await expect(
      directorOverrideEvidence("ev-1", "director-1", "Timeout quorum correction", "guild-1"),
    ).rejects.toThrow("update failed");

    expect(insert).not.toHaveBeenCalled();
  });

  it("does not write audit when evidence does not exist", async () => {
    returning.mockResolvedValueOnce([]);
    const { directorOverrideEvidence } = await import("../evidence");

    await expect(
      directorOverrideEvidence("missing-ev", "director-1", "Timeout quorum correction", "guild-1"),
    ).rejects.toThrow(/not found/i);

    expect(insert).not.toHaveBeenCalled();
  });
});
