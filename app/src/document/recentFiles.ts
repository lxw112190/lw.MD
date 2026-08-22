const MAX_RECENT_FILES = 10;

export function addRecentFile(files: string[], path: string): string[] {
  const normalized = path.toLocaleLowerCase();
  return [
    path,
    ...files.filter((item) => item.toLocaleLowerCase() !== normalized),
  ].slice(0, MAX_RECENT_FILES);
}

export function fileNameFromPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
