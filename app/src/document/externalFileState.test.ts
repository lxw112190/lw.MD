import { describe, expect, it } from "vitest";
import { noExternalFileState } from "./externalFileState";

describe("external file state", () => {
  it("starts with no persistence risk", () => {
    expect(noExternalFileState()).toEqual({ kind: "none" });
  });
});
