const latestReleaseApi =
  "https://api.github.com/repos/lxw112190/lw.MD/releases/latest";
export const latestReleaseUrl =
  "https://github.com/lxw112190/lw.MD/releases/latest";

const cacheKey = "lw-md:update-cache";
const cacheTtlMs = 24 * 60 * 60 * 1000;
const requestTimeoutMs = 5_000;

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
}

interface UpdateCache {
  checkedAt: number;
  latestVersion: string | null;
}

export function normalizeVersion(version: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return null;
  return `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}`;
}

export function compareVersions(left: string, right: string) {
  const leftVersion = normalizeVersion(left);
  const rightVersion = normalizeVersion(right);
  if (!leftVersion || !rightVersion) return null;
  const leftParts = leftVersion.split(".").map(Number);
  const rightParts = rightVersion.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }
  return 0;
}

function readCache() {
  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<UpdateCache>;
    if (
      typeof value.checkedAt !== "number" ||
      !Number.isFinite(value.checkedAt) ||
      value.checkedAt < 0
    ) {
      return null;
    }
    if (value.latestVersion === null) {
      return { checkedAt: value.checkedAt, latestVersion: null };
    }
    if (typeof value.latestVersion !== "string") return null;
    const latestVersion = normalizeVersion(value.latestVersion);
    return latestVersion ? { checkedAt: value.checkedAt, latestVersion } : null;
  } catch {
    return null;
  }
}

function writeCache(cache: UpdateCache) {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch {
    // An unavailable storage area must never affect editing.
  }
}

function toUpdateInfo(currentVersion: string, latestVersion: string | null) {
  if (!latestVersion || compareVersions(latestVersion, currentVersion) !== 1) {
    return null;
  }
  return {
    currentVersion: normalizeVersion(currentVersion)!,
    latestVersion,
  } satisfies UpdateInfo;
}

async function fetchLatestVersion() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(latestReleaseApi, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return null;
    const release: unknown = await response.json();
    if (!release || typeof release !== "object") return null;
    const value = release as {
      tag_name?: unknown;
      draft?: unknown;
      prerelease?: unknown;
    };
    if (value.draft === true || value.prerelease === true) return null;
    return typeof value.tag_name === "string"
      ? normalizeVersion(value.tag_name)
      : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function checkForUpdate(currentVersion: string) {
  const normalizedCurrentVersion = normalizeVersion(currentVersion);
  if (!normalizedCurrentVersion) return null;

  const now = Date.now();
  const cached = readCache();
  if (cached && now - cached.checkedAt < cacheTtlMs) {
    return toUpdateInfo(normalizedCurrentVersion, cached.latestVersion);
  }

  const latestVersion = await fetchLatestVersion();
  writeCache({ checkedAt: now, latestVersion });
  return toUpdateInfo(normalizedCurrentVersion, latestVersion);
}
