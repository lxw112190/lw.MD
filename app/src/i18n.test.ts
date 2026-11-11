import { afterEach, describe, expect, it } from "vitest";
import { english, getLanguage, setLanguage, t } from "./i18n";

afterEach(() => setLanguage("zh_CN"));
describe("interface languages", () => {
  it("switches labels and placeholders without changing user text", () => {
    expect(t("保存")).toBe("保存");
    setLanguage("en_US");
    expect(getLanguage()).toBe("en_US");
    expect(t("保存")).toBe("Save");
    expect(t("第 {0} 项，共 {1} 项", 2, 5)).toBe("Match 2 of 5");
    expect(t("客户自己的文件.md")).toBe("客户自己的文件.md");
    expect(document.documentElement.lang).toBe("en");
    setLanguage("zh_CN");
    expect(t("保存")).toBe("保存");
  });
  it("keeps translation placeholders consistent", () => {
    for (const [key, value] of Object.entries(english)) {
      expect(value.match(/\{\d+\}/g)?.sort() ?? []).toEqual(
        key.match(/\{\d+\}/g)?.sort() ?? [],
      );
    }
  });
});
