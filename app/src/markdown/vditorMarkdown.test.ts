import { describe, expect, it } from "vitest";
import { createDocumentMarkdownOptions } from "./vditorMarkdown";

describe("Vditor Markdown options", () => {
  it("enables mark syntax with the document link base", () => {
    expect(createDocumentMarkdownOptions()).toEqual({
      linkBase: "https://document.lwmd/",
      mark: true,
    });
  });

  it("returns an independent options object for each renderer", () => {
    const editorOptions = createDocumentMarkdownOptions();
    const printOptions = createDocumentMarkdownOptions();
    expect(editorOptions).not.toBe(printOptions);
    expect(editorOptions).toEqual(printOptions);
  });
});
