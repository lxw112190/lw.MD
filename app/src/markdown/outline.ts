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
  let fence: { marker: string; length: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceLine = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (
        fenceLine &&
        fenceLine[1][0] === fence.marker &&
        fenceLine[1].length >= fence.length &&
        fenceLine[2].trim() === ""
      ) {
        fence = null;
      }
      continue;
    }
    if (fenceLine && (fenceLine[1][0] !== "`" || !fenceLine[2].includes("`"))) {
      fence = { marker: fenceLine[1][0], length: fenceLine[1].length };
      continue;
    }
    const atx = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*$/);
    if (atx) {
      const text = cleanHeadingText(atx[2]);
      if (text) outline.push({ level: atx[1].length, text, line: index + 1 });
      continue;
    }
    const setext = lines[index + 1]?.match(/^ {0,3}(=+|-+)\s*$/);
    if (setext && /^ {0,3}\S/.test(line)) {
      const text = cleanHeadingText(line.trim());
      if (text) {
        outline.push({
          level: setext[1][0] === "=" ? 1 : 2,
          text,
          line: index + 1,
        });
      }
      index += 1;
    }
  }
  return outline;
}
