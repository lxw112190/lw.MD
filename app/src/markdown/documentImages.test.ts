import { describe, expect, it } from "vitest";
import {
  normalizeDocumentImages,
  resolveDocumentImageSource,
} from "./documentImages";

describe("document images", () => {
  it("maps relative HTML image paths to the current document origin", () => {
    expect(
      resolveDocumentImageSource("resources/image/logo/assistant.png", "doc-a"),
    ).toBe(
      "https://document.lwmd/resources/image/logo/assistant.png?lwmdScope=doc-a",
    );
    expect(resolveDocumentImageSource("./图片/产品 图.png", "doc-a")).toBe(
      "https://document.lwmd/%E5%9B%BE%E7%89%87/%E4%BA%A7%E5%93%81%20%E5%9B%BE.png?lwmdScope=doc-a",
    );
  });

  it("leaves absolute and embedded image sources unchanged", () => {
    expect(
      resolveDocumentImageSource("https://example.com/image.png", "doc-a"),
    ).toBeNull();
    expect(
      resolveDocumentImageSource("data:image/png;base64,abc", "doc-a"),
    ).toBeNull();
    expect(resolveDocumentImageSource("/app-icon.png", "doc-a")).toBeNull();
  });

  it("isolates identical relative paths between documents", () => {
    const source = "resources/image/logo.png";

    expect(resolveDocumentImageSource(source, "document-a")).not.toBe(
      resolveDocumentImageSource(source, "document-b"),
    );
  });

  it("rebinds an existing document URL to the new resource scope", () => {
    expect(
      resolveDocumentImageSource(
        "https://document.lwmd/resources/logo.png?version=2&lwmdScope=document-a",
        "document-b",
      ),
    ).toBe(
      "https://document.lwmd/resources/logo.png?version=2&lwmdScope=document-b",
    );
  });

  it("keeps an already scoped URL unchanged", () => {
    const source =
      "https://document.lwmd/resources/logo.png?lwmdScope=document-a";

    expect(resolveDocumentImageSource(source, "document-a")).toBe(source);
  });

  it("normalizes images without changing surrounding HTML", () => {
    const root = document.createElement("div");
    root.innerHTML =
      '<p><img src="resources/logo.png" alt="logo"></p><img src="https://example.com/a.png">';

    normalizeDocumentImages(root, "doc-a");

    const images = root.querySelectorAll("img");
    expect(images[0].getAttribute("src")).toBe(
      "https://document.lwmd/resources/logo.png?lwmdScope=doc-a",
    );
    expect(images[1].getAttribute("src")).toBe("https://example.com/a.png");
  });

  it("does not rewrite an image that already uses the current scope", () => {
    const image = document.createElement("img");
    image.src = "https://document.lwmd/resources/logo.png?lwmdScope=document-a";

    normalizeDocumentImages(image, "document-a");

    expect(image.src).toBe(
      "https://document.lwmd/resources/logo.png?lwmdScope=document-a",
    );
  });
});
