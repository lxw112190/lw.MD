export interface DocumentState {
  path: string | null;
  name: string;
  content: string;
  savedContent: string;
  dirty: boolean;
  encoding: "utf-8";
}

export function createUntitledDocument(): DocumentState {
  return {
    path: null,
    name: "未命名",
    content: "",
    savedContent: "",
    dirty: false,
    encoding: "utf-8",
  };
}

export function updateDocumentContent(
  document: DocumentState,
  content: string,
): DocumentState {
  return { ...document, content, dirty: content !== document.savedContent };
}

export function markDocumentSaved(
  document: DocumentState,
  path = document.path,
  name = document.name,
): DocumentState {
  return {
    ...document,
    path,
    name,
    savedContent: document.content,
    dirty: false,
  };
}
