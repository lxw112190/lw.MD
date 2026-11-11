import { beforeEach, describe, expect, it, vi } from "vitest";
const bridge = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("./bridge", () => ({
  invoke: bridge.invoke,
  subscribeDesktopEvent: vi.fn(),
}));
import { desktop, type DesktopSettings } from "./desktop";

describe("settings bridge contract", () => {
  beforeEach(() => {
    bridge.invoke.mockReset();
  });
  it("sends only interface settings when loaded settings include native window metadata", async () => {
    const loaded = {
      language: "en_US" as const,
      theme: "dark" as const,
      outlineVisible: true,
      outlineWidth: 300,
      recentFiles: [],
      editorMode: "ir" as const,
      window: { left: 50, top: 50, width: 1280, height: 800, dpi: 96 },
    };
    bridge.invoke.mockImplementation(async (_method, params) => {
      if (Object.keys(params).length !== 6 || "window" in params)
        throw new Error("Invalid settings");
    });
    await desktop.app.setSettings(loaded);
    expect(bridge.invoke).toHaveBeenCalledWith("app.setSettings", {
      language: "en_US",
      theme: "dark",
      outlineVisible: true,
      outlineWidth: 300,
      recentFiles: [],
      editorMode: "ir",
    });
    expect(loaded.window.width).toBe(1280);
  });
  it("propagates a save failure so the interface can report it", async () => {
    bridge.invoke.mockRejectedValue({
      code: "IO_ERROR",
      message: "Cannot save",
    });
    await expect(
      desktop.app.setSettings({
        language: "en_US",
        theme: "system",
        outlineVisible: true,
        outlineWidth: 280,
        recentFiles: [],
        editorMode: "ir",
      } satisfies DesktopSettings),
    ).rejects.toMatchObject({ code: "IO_ERROR" });
  });
});
