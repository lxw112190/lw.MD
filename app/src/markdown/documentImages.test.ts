import { describe, expect, it } from "vitest";
import {
  normalizeDocumentImages,
  resolveDocumentImageSource,
} from "./documentImages";

describe("document images", () => {
  it("maps relative HTML image paths to the current document origin", () => {
    expect(
      resolveDocumentImageSource("resources/image/logo/assistant.png"),
    ).toBe("https://document.lwmd/resources/image/logo/assistant.png");
    expect(resolveDocumentImageSource("./图片/产品 图.png")).toBe(
      "https://document.lwmd/%E5%9B%BE%E7%89%87/%E4%BA%A7%E5%93%81%20%E5%9B%BE.png",
    );
  });

  it("leaves absolute and embedded image sources unchanged", () => {
    expect(
      resolveDocumentImageSource("https://example.com/image.png"),
    ).toBeNull();
    expect(resolveDocumentImageSource("data:image/png;base64,abc")).toBeNull();
    expect(resolveDocumentImageSource("/app-icon.png")).toBeNull();
  });

  it("normalizes images without changing surrounding HTML", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<p><img src="resources/logo.png" alt="logo"></p><img src="https://example.com/a.png">';

    normalizeDocumentImages(root);

    const images = root.querySelectorAll("img");
    expect(images[0].getAttribute("src")).toBe(
      "https://document.lwmd/resources/logo.png",
    );
    expect(images[1].getAttribute("src")).toBe("https://example.com/a.png");
  });
});
