import { t } from "../i18n";
export function errorMessage(error: unknown) {
  return typeof error === "object" && error && "message" in error
    ? t(String(error.message))
    : t("操作失败");
}

export function isDesktopUnavailable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "DESKTOP_UNAVAILABLE"
  );
}

export function isBridgeErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}
