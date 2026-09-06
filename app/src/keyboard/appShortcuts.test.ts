import { describe, expect, it } from "vitest";
import { appShortcuts, matchesShortcut } from "./appShortcuts";

describe("app shortcuts", () => {
  it.each([
    ["newDocument", "n", false],
    ["open", "o", false],
    ["save", "s", false],
    ["saveAs", "s", true],
    ["find", "f", false],
    ["replace", "h", false],
    ["toggleEditorMode", "e", true],
  ] as const)("matches %s", (name, key, shift) => {
    expect(
      matchesShortcut(
        new KeyboardEvent("keydown", {
          key: key.toUpperCase(),
          ctrlKey: true,
          shiftKey: shift,
        }),
        appShortcuts[name],
      ),
    ).toBe(true);
  });

  it.each([
    ["save", "s", { altKey: true }],
    ["newDocument", "n", { shiftKey: true }],
    ["open", "o", { ctrlKey: false }],
  ] as const)(
    "rejects incomplete or alternate %s combinations",
    (name, key, modifiers) => {
      expect(
        matchesShortcut(
          new KeyboardEvent("keydown", {
            key,
            ctrlKey: true,
            ...modifiers,
          }),
          appShortcuts[name],
        ),
      ).toBe(false);
    },
  );
});
