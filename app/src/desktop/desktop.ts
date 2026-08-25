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
export interface DroppedFileGrant {
  id: string;
  name: string;
  kind: "markdown" | "image";
  size: number;
}
export interface DroppedFiles {
  files: DroppedFileGrant[];
}
export interface DropActiveState {
  active: boolean;
}
export interface RecoverySnapshot {
  path: string | null;
  name: string;
  content: string;
  savedAt: number;
}
export interface FileAssociationStatus {
  registered: boolean;
  current: boolean;
  executablePath: string;
  registeredExecutablePath: string | null;
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
    getLaunch: () => invoke<NativeDocument | null>("file.getLaunch"),
    open: () => invoke<NativeDocument | null>("file.open"),
    read: (path: string) => invoke<NativeDocument>("file.read", { path }),
    save: (path: string, content: string) =>
      invoke<SaveResult>("file.save", { path, content }),
    saveAs: (content: string, suggestedName: string) =>
      invoke<SaveResult | null>("file.saveAs", { content, suggestedName }),
  },
  drop: {
    openMarkdown: (id: string) =>
      invoke<NativeDocument>("drop.openMarkdown", { id }),
    importImages: (documentPath: string, ids: string[]) =>
      invoke<SavedImage[]>("image.importDropped", { documentPath, ids }),
    onActive: (listener: (state: DropActiveState) => void) =>
      subscribeDesktopEvent("drop.active", listener),
    onFiles: (listener: (files: DroppedFiles) => void) =>
      subscribeDesktopEvent("drop.files", listener),
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
    choose: (documentPath: string) =>
      invoke<SavedImage[]>("image.choose", { documentPath }),
  },
  recovery: {
    get: () => invoke<RecoverySnapshot | null>("recovery.get"),
    restore: () => invoke<RecoverySnapshot>("recovery.restore"),
    save: (snapshot: Pick<RecoverySnapshot, "path" | "name" | "content">) =>
      invoke<void>("recovery.save", snapshot),
    clear: () => invoke<void>("recovery.clear"),
  },
  association: {
    status: () => invoke<FileAssociationStatus>("association.status"),
    register: () => invoke<void>("association.register"),
    unregister: () => invoke<void>("association.unregister"),
    openDefaultApps: () => invoke<void>("association.openDefaultApps"),
  },
};
