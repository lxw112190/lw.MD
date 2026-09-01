import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkForUpdate,
  compareVersions,
  normalizeVersion,
} from "./updateService";

describe("update service", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes stable versions and rejects prerelease tags", () => {
    expect(normalizeVersion("v0.4.4")).toBe("0.4.4");
    expect(normalizeVersion("0.4.10")).toBe("0.4.10");
    expect(normalizeVersion("v0.4.4-rc.1")).toBeNull();
    expect(normalizeVersion("nightly")).toBeNull();
  });

  it("compares semantic versions numerically", () => {
    expect(compareVersions("0.4.10", "0.4.9")).toBe(1);
    expect(compareVersions("0.4.3", "0.4.3")).toBe(0);
    expect(compareVersions("0.5.0", "0.4.9")).toBe(1);
    expect(compareVersions("abc", "0.4.3")).toBeNull();
  });

  it("returns a newer stable release", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ tag_name: "v0.4.4" }), { status: 200 }),
    );
    await expect(checkForUpdate("0.4.3")).resolves.toEqual({
      currentVersion: "0.4.3",
      latestVersion: "0.4.4",
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("uses a fresh cache without another request", async () => {
    window.localStorage.setItem(
      "lw-md:update-cache",
      JSON.stringify({ checkedAt: Date.now(), latestVersion: "0.4.4" }),
    );
    await expect(checkForUpdate("0.4.3")).resolves.toEqual({
      currentVersion: "0.4.3",
      latestVersion: "0.4.4",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("silently ignores invalid, prerelease, and failed responses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ tag_name: "v0.4.4-rc.1" }), {
        status: 200,
      }),
    );
    await expect(checkForUpdate("0.4.3")).resolves.toBeNull();

    window.localStorage.clear();
    vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 503 }));
    await expect(checkForUpdate("0.4.3")).resolves.toBeNull();
  });
});
