import { describe, expect, it } from "vitest";
import {
  createUntitledDocument,
  markDocumentSaved,
  updateDocumentContent,
} from "./documentModel";

describe("document model", () => {
  it("derives dirty state from saved content", () => {
    const edited = updateDocumentContent(createUntitledDocument(), "# 简墨");
    expect(edited.dirty).toBe(true);
    expect(markDocumentSaved(edited).dirty).toBe(false);
  });
});
