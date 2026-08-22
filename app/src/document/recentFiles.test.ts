import { describe, expect, it } from "vitest";
import { addRecentFile, fileNameFromPath } from "./recentFiles";

describe("recent files", () => {
  it("moves a reopened path to the front without duplicates", () => {
    expect(
      addRecentFile(["C:\\Notes\\a.md", "C:\\Notes\\b.md"], "c:\\notes\\A.md"),
    ).toEqual(["c:\\notes\\A.md", "C:\\Notes\\b.md"]);
  });

  it("extracts Windows and POSIX file names", () => {
    expect(fileNameFromPath("C:\\Notes\\paper.md")).toBe("paper.md");
    expect(fileNameFromPath("/tmp/demo.md")).toBe("demo.md");
  });
});
