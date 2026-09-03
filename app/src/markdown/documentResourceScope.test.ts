import { describe, expect, it } from "vitest";
import { createDocumentResourceScope } from "./documentResourceScope";

describe("document resource scope", () => {
  it("creates a non-empty scope and changes it for each binding", () => {
    const first = createDocumentResourceScope();
    const second = createDocumentResourceScope();

    expect(first.length).toBeGreaterThan(0);
    expect(second.length).toBeGreaterThan(0);
    expect(first).not.toBe(second);
  });
});
