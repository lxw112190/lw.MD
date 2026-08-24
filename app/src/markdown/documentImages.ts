const documentOrigin = "https://document.lwmd/";

export function resolveDocumentImageSource(source: string) {
  const value = source.trim();
  if (
    !value ||
    value.startsWith("#") ||
    value.startsWith("/") ||
    value.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  ) {
    return null;
  }

  return new URL(value.replace(/\\/g, "/"), documentOrigin).href;
}

export function normalizeDocumentImage(image: HTMLImageElement) {
  const source = image.getAttribute("src");
  if (!source) return false;
  const resolved = resolveDocumentImageSource(source);
  if (!resolved || resolved === source) return false;
  image.setAttribute("src", resolved);
  return true;
}

export function normalizeDocumentImages(root: ParentNode) {
  const images = Array.from(
    root.querySelectorAll<HTMLImageElement>("img[src]"),
  );
  if (root instanceof HTMLImageElement && root.hasAttribute("src")) {
    images.unshift(root);
  }
  images.forEach(normalizeDocumentImage);
}
