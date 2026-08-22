import { describe, expect, it } from "vitest";
import { getMarkdownOutline } from "./outline";

describe("Markdown outline", () => {
  it("extracts headings and ignores fenced code", () => {
    const markdown = "# 简墨\n\n```md\n## 不是标题\n```\n\n### 使用";
    expect(getMarkdownOutline(markdown)).toEqual([
      { level: 1, line: 1, text: "简墨" },
      { level: 3, line: 7, text: "使用" },
    ]);
  });

  it("cleans links and emphasis from heading labels", () => {
    expect(
      getMarkdownOutline("## [链接](https://example.com) **强调**")[0]?.text,
    ).toBe("链接 强调");
  });
});
