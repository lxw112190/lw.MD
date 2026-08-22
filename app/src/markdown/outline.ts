export interface OutlineItem {
  level: number;
  line: number;
  text: string;
}
function cleanHeadingText(value: string) {
  return value
    .replace(/\s+#+\s*$/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}
export function getMarkdownOutline(markdown: string): OutlineItem[] {
  const outline: OutlineItem[] = [];
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^ {0,3}(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const atx = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*$/);
    if (atx) {
      const text = cleanHeadingText(atx[2]);
      if (text) outline.push({ level: atx[1].length, text, line: index + 1 });
    }
  }
  return outline;
}
