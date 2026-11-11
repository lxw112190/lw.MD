import { t } from "../i18n";
import { normalizeDocumentImages } from "../markdown/documentImages";

const imageTimeoutMs = 8_000;

function imageLabel(image: HTMLImageElement) {
  return image.getAttribute("src") || image.alt || t("未知图片");
}

async function waitForImage(image: HTMLImageElement) {
  if (!image.complete) {
    await new Promise<void>((resolve) => {
      let settled = false;
      let timeout = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        image.removeEventListener("load", finish);
        image.removeEventListener("error", finish);
        resolve();
      };
      image.addEventListener("load", finish);
      image.addEventListener("error", finish);
      timeout = window.setTimeout(finish, imageTimeoutMs);
      if (image.complete) finish();
    });
  }

  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) return false;
  if (typeof image.decode === "function") {
    try {
      await image.decode();
    } catch {
      return false;
    }
  }
  return true;
}

export async function waitForPrintAssets(
  target: HTMLElement,
  resourceScope: string,
) {
  normalizeDocumentImages(target, resourceScope);
  const images = Array.from(target.querySelectorAll<HTMLImageElement>("img"));
  const loaded = await Promise.all(images.map(waitForImage));
  const failed = images
    .filter((_image, index) => !loaded[index])
    .map(imageLabel);
  if (failed.length > 0) {
    const shown = failed.slice(0, 3).join("\n");
    const remaining =
      failed.length > 3 ? t("\n另有 {0} 张图片", failed.length - 3) : "";
    throw new Error(
      t("图片无法载入，已取消导出 PDF：\n{0}{1}", shown, remaining),
    );
  }

  await window.document.fonts?.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
