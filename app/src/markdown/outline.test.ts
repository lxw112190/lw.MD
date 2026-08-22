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

  it("matches fenced code by marker type and opening length", () => {
    const markdown = [
      "````md",
      "## 不是标题",
      "```",
      "### 仍然不是标题",
      "~~~~",
      "# 也不是标题",
      "````",
      "# 真正标题",
    ].join("\n");
    expect(getMarkdownOutline(markdown)).toEqual([
      { level: 1, line: 8, text: "真正标题" },
    ]);
  });

  it("extracts Setext headings", () => {
    expect(getMarkdownOutline("一级标题\n===\n\n二级标题\n---")).toEqual([
      { level: 1, line: 1, text: "一级标题" },
      { level: 2, line: 4, text: "二级标题" },
    ]);
  });
});
