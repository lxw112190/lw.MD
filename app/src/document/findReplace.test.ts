import { describe, expect, it } from "vitest";
import {
  findTextMatches,
  replaceAllText,
  replaceTextMatch,
} from "./findReplace";

describe("find and replace", () => {
  it("finds literal text and ignores case when requested", () => {
    expect(findTextMatches("简墨 lw.MD LW.md", "lw.md", false)).toEqual([
      { start: 3, end: 8 },
      { start: 9, end: 14 },
    ]);
  });

  it("treats regular expression characters as plain text", () => {
    expect(findTextMatches("a+b a.b a+b", "a+b", true)).toEqual([
      { start: 0, end: 3 },
      { start: 8, end: 11 },
    ]);
  });

  it("replaces one selected match literally", () => {
    const match = findTextMatches("一个 一个", "一个", true)[1];
    expect(replaceTextMatch("一个 一个", match, "$&两个")).toBe("一个 $&两个");
  });

  it("replaces all non-overlapping matches", () => {
    expect(replaceAllText("aaaa", "aa", "b", true)).toEqual({
      content: "bb",
      count: 2,
    });
  });

  it("does nothing for an empty query", () => {
    expect(replaceAllText("内容", "", "替换", false)).toEqual({
      content: "内容",
      count: 0,
    });
  });
});
