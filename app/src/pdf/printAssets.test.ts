import { describe, expect, it, vi } from "vitest";
import { waitForPrintAssets } from "./printAssets";

function setImageState(
  image: HTMLImageElement,
  state: { complete: boolean; width: number; height: number },
) {
  Object.defineProperties(image, {
    complete: { configurable: true, value: state.complete },
    naturalHeight: { configurable: true, value: state.height },
    naturalWidth: { configurable: true, value: state.width },
  });
}

describe("PDF print assets", () => {
  it("accepts decoded images and normalizes relative sources", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const target = document.createElement("div");
    target.innerHTML = '<img src="resources/logo.png">';
    const image = target.querySelector("img")!;
    setImageState(image, { complete: true, width: 400, height: 200 });
    image.decode = vi.fn(async () => undefined);

    await waitForPrintAssets(target);

    expect(image.getAttribute("src")).toBe(
      "https://document.lwmd/resources/logo.png",
    );
    expect(image.decode).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("rejects broken images even when complete is true", async () => {
    const target = document.createElement("div");
    target.innerHTML = '<img src="missing.png" alt="缺失图片">';
    setImageState(target.querySelector("img")!, {
      complete: true,
      width: 0,
      height: 0,
    });

    await expect(waitForPrintAssets(target)).rejects.toThrow(
      "图片无法载入，已取消导出 PDF",
    );
  });
});
