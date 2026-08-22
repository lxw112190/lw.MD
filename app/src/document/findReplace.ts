export interface TextMatch {
  start: number;
  end: number;
}

export function findTextMatches(
  content: string,
  query: string,
  matchCase: boolean,
): TextMatch[] {
  if (!query) return [];

  const pattern = new RegExp(escapeRegExp(query), matchCase ? "gu" : "giu");
  return Array.from(content.matchAll(pattern), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function replaceTextMatch(
  content: string,
  match: TextMatch,
  replacement: string,
) {
  return `${content.slice(0, match.start)}${replacement}${content.slice(match.end)}`;
}

export function replaceAllText(
  content: string,
  query: string,
  replacement: string,
  matchCase: boolean,
) {
  const matches = findTextMatches(content, query, matchCase);
  if (matches.length === 0) return { content, count: 0 };

  let cursor = 0;
  const parts: string[] = [];
  for (const match of matches) {
    parts.push(content.slice(cursor, match.start), replacement);
    cursor = match.end;
  }
  parts.push(content.slice(cursor));
  return { content: parts.join(""), count: matches.length };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
