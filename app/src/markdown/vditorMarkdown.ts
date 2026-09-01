/**
 * Markdown extensions shared by the editor and the PDF renderer.
 * Keep this in one place so both rendering paths stay in sync.
 */
export function createDocumentMarkdownOptions() {
  return {
    linkBase: "https://document.lwmd/",
    mark: true,
  } as const;
}
