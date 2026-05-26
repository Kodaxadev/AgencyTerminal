import { describe, expect, it } from "vitest";
import { commandNames, commands } from "../slash-commands";

describe("shared slash command definitions", () => {
  it("exports the guild command set used by bot and controls deployment", () => {
    expect(commandNames()).toEqual(["evidence", "ticket", "director"]);
    expect(commands).toHaveLength(3);
  });
});
