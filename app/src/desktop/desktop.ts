import { invoke, subscribeDesktopEvent } from "./bridge";

export interface NativeDocument {
  path: string;
  name: string;
  content: string;
}
export interface SaveResult {
  path: string;
  name: string;
}
export interface PdfExportResult {
  path: string;
  name: string;
}
export interface SavedImage {
  path: string;
  relativePath: string;
}
export interface DroppedImages {
  sourcePaths: string[];
}
export type ThemeMode = "system" | "light" | "dark";
export interface DesktopSettings {
  theme: ThemeMode;
  outlineVisible: boolean;
  recentFiles: string[];
}

export const desktop = {
  app: {
    ping: () => invoke<string>("app.ping"),
    quit: () => invoke<void>("app.quit"),
    getSettings: () => invoke<DesktopSettings>("app.getSettings"),
    setSettings: (settings: DesktopSettings) =>
      invoke<void>("app.setSettings", settings),
    setDirty: (dirty: boolean) => invoke<void>("app.setDirty", { dirty }),
    setTitle: (title: string) => invoke<void>("app.setTitle", { title }),
    openExternal: (url: string) => invoke<void>("app.openExternal", { url }),
  },
  file: {
    clearCurrent: () => invoke<void>("file.clearCurrent"),
    open: () => invoke<NativeDocument | null>("file.open"),
    read: (path: string) => invoke<NativeDocument>("file.read", { path }),
    save: (path: string, content: string) =>
      invoke<SaveResult>("file.save", { path, content }),
    saveAs: (content: string, suggestedName: string) =>
      invoke<SaveResult | null>("file.saveAs", { content, suggestedName }),
    onOpened: (listener: (document: NativeDocument) => void) =>
      subscribeDesktopEvent("file.opened", listener),
  },
  pdf: {
    export: (suggestedName: string) =>
      invoke<PdfExportResult | null>("pdf.export", { suggestedName }),
  },
  image: {
    save: (documentPath: string, mimeType: string, base64: string) =>
      invoke<SavedImage>("image.save", {
        documentPath,
        mimeType,
        base64,
      }),
    import: (documentPath: string, sourcePaths: string[]) =>
      invoke<SavedImage[]>("image.import", { documentPath, sourcePaths }),
    onDropped: (listener: (images: DroppedImages) => void) =>
      subscribeDesktopEvent("image.dropped", listener),
  },
};
