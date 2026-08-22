export function errorMessage(error: unknown) {
  return typeof error === "object" && error && "message" in error
    ? String(error.message)
    : "操作失败";
}

export function isDesktopUnavailable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "DESKTOP_UNAVAILABLE"
  );
}
