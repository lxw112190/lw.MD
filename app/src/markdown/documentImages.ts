const documentOrigin = "https://document.lwmd/";
const resourceScopeParameter = "lwmdScope";

export function resolveDocumentImageSource(
  source: string,
  resourceScope: string,
) {
  const value = source.trim();
  if (!value || !resourceScope) {
    return null;
  }

  if (value.startsWith(documentOrigin)) {
    const url = new URL(value);
    url.searchParams.set(resourceScopeParameter, resourceScope);
    return url.href;
  }

  if (
    value.startsWith("#") ||
    value.startsWith("/") ||
    value.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  ) {
    return null;
  }

  const url = new URL(value.replace(/\\/g, "/"), documentOrigin);
  url.searchParams.set(resourceScopeParameter, resourceScope);
  return url.href;
}

export function normalizeDocumentImage(
  image: HTMLImageElement,
  resourceScope: string,
) {
  const source = image.getAttribute("src");
  if (!source) return false;
  const resolved = resolveDocumentImageSource(source, resourceScope);
  if (!resolved || resolved === source) return false;
  image.setAttribute("src", resolved);
  return true;
}

export function normalizeDocumentImages(
  root: ParentNode,
  resourceScope: string,
) {
  const images = Array.from(
    root.querySelectorAll<HTMLImageElement>("img[src]"),
  );
  if (root instanceof HTMLImageElement && root.hasAttribute("src")) {
    images.unshift(root);
  }
  images.forEach((image) => normalizeDocumentImage(image, resourceScope));
}
