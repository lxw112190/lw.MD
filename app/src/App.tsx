import Vditor from "vditor";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AboutDialog } from "./components/AboutDialog";
import { ExternalFileNotice } from "./components/ExternalFileNotice";
import { FileConflictDialog } from "./components/FileConflictDialog";
import { FindReplacePanel } from "./components/FindReplacePanel";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "./components/MarkdownEditor";
import { OutlinePanel } from "./components/OutlinePanel";
import { RecoveryDialog } from "./components/RecoveryDialog";
import { WindowsIntegrationDialog } from "./components/WindowsIntegrationDialog";
import {
  desktop,
  type DesktopSettings,
  type NativeDocument,
  type RecoverySnapshot,
  type SavedImage,
  type ThemeMode,
} from "./desktop/desktop";
import {
  errorMessage,
  isBridgeErrorCode,
  isDesktopUnavailable,
} from "./desktop/errors";
import {
  createUntitledDocument,
  markDocumentSaved,
  updateDocumentContent,
  type DocumentState,
} from "./document/documentModel";
import type { ExternalFileState } from "./document/externalFileState";
import { addRecentFile, fileNameFromPath } from "./document/recentFiles";
import { getMarkdownOutline } from "./markdown/outline";
import { waitForPrintAssets } from "./pdf/printAssets";

const recoveryIntervalMs = 15_000;
const recoveryDebounceMs = 1_500;

const defaultSettings: DesktopSettings = {
  theme: "system",
  outlineVisible: true,
  recentFiles: [],
};

export default function App() {
  const [document, setDocument] = useState<DocumentState>(
    createUntitledDocument,
  );
  const [status, setStatus] = useState("就绪");
  const [settings, setSettings] = useState(defaultSettings);
  const [settingsReady, setSettingsReady] = useState(false);
  const [bootReady, setBootReady] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [associationOpen, setAssociationOpen] = useState(false);
  const [findMode, setFindMode] = useState<"find" | "replace" | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [pendingRecovery, setPendingRecovery] =
    useState<RecoverySnapshot | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [externalFileState, setExternalFileState] = useState<ExternalFileState>(
    { kind: "none" },
  );
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [externalNoticeDismissed, setExternalNoticeDismissed] = useState(false);
  const editor = useRef<MarkdownEditorHandle>(null);
  const printDocument = useRef<HTMLDivElement>(null);
  const documentRef = useRef(document);
  const externalFileStateRef = useRef(externalFileState);
  const lastRecoverySnapshot = useRef<{
    path: string | null;
    name: string;
    content: string;
  } | null>(null);
  const deferredOutlineContent = useDeferredValue(document.content);
  const outline = useMemo(
    () => getMarkdownOutline(deferredOutlineContent),
    [deferredOutlineContent],
  );
  const title = `${document.name}${document.dirty ? " *" : ""} — lw.MD`;
  const hasPersistenceRisk =
    document.dirty || externalFileState.kind !== "none";
  const acceptDocument = useCallback(
    (result: NativeDocument, clearRecovery = true) => {
      if (clearRecovery) {
        void desktop.recovery.clear().catch(() => undefined);
        lastRecoverySnapshot.current = null;
      }
      setDocument({
        ...result,
        savedContent: result.content,
        dirty: false,
        encoding: "utf-8",
        revision: result.revision,
      });
      setExternalFileState({ kind: "none" });
      setExternalNoticeDismissed(false);
      setSettings((current) => ({
        ...current,
        recentFiles: addRecentFile(current.recentFiles, result.path),
      }));
    },
    [],
  );
  const changeContent = useCallback((content: string) => {
    setDocument((current) => updateDocumentContent(current, content));
  }, []);
  const confirmDiscard = useCallback(
    () =>
      !hasPersistenceRisk ||
      window.confirm("当前文档或磁盘文件存在未处理修改，确定放弃吗？"),
    [hasPersistenceRisk],
  );
  const createNew = useCallback(() => {
    if (!confirmDiscard()) return;
    void desktop.recovery.clear().catch(() => undefined);
    lastRecoverySnapshot.current = null;
    void desktop.file.clearCurrent().catch(() => undefined);
    setDocument(createUntitledDocument());
    setExternalFileState({ kind: "none" });
    setExternalNoticeDismissed(false);
    setStatus("新建文档");
  }, [confirmDiscard]);
  const open = useCallback(async () => {
    if (!confirmDiscard()) return;
    try {
      const result = await desktop.file.open();
      if (result) {
        acceptDocument(result);
        setStatus("已打开");
      }
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }, [acceptDocument, confirmDiscard]);
  const openRecent = useCallback(
    async (path: string) => {
      if (!path || !confirmDiscard()) return;
      try {
        acceptDocument(await desktop.file.read(path));
        setStatus("已打开最近文件");
      } catch (error) {
        setSettings((current) => ({
          ...current,
          recentFiles: current.recentFiles.filter((item) => item !== path),
        }));
        setStatus(errorMessage(error));
      }
    },
    [acceptDocument, confirmDiscard],
  );
  const save = useCallback(
    async (saveAs = false) => {
      try {
        const result =
          !saveAs && document.path
            ? document.revision
              ? await desktop.file.save(
                  document.path,
                  document.content,
                  document.revision,
                )
              : await desktop.file.saveAs(
                  document.content,
                  document.name === "未命名" ? "未命名.md" : document.name,
                )
            : await desktop.file.saveAs(
                document.content,
                document.name === "未命名" ? "未命名.md" : document.name,
              );
        if (result) {
          void desktop.recovery.clear().catch(() => undefined);
          lastRecoverySnapshot.current = null;
          setDocument((current) =>
            markDocumentSaved(
              current,
              result.path,
              result.name,
              result.revision,
            ),
          );
          setExternalFileState({ kind: "none" });
          setExternalNoticeDismissed(false);
          setSettings((current) => ({
            ...current,
            recentFiles: addRecentFile(current.recentFiles, result.path),
          }));
          setStatus("已保存");
        }
      } catch (error) {
        if (isBridgeErrorCode(error, "FILE_CONFLICT")) {
          setExternalFileState((current) =>
            current.kind === "changed"
              ? current
              : { kind: "changed", observedRevision: document.revision! },
          );
          setConflictDialogOpen(true);
        } else if (isBridgeErrorCode(error, "FILE_MISSING")) {
          setExternalFileState({ kind: "missing" });
          setConflictDialogOpen(true);
        }
        setStatus(errorMessage(error));
      }
    },
    [document],
  );
  const reloadFromDisk = useCallback(async () => {
    const path = documentRef.current.path;
    if (!path) return;
    try {
      acceptDocument(await desktop.file.read(path));
      setConflictDialogOpen(false);
      setStatus("已从磁盘重新加载");
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }, [acceptDocument]);
  const continueWithCurrentContent = useCallback(() => {
    setExternalNoticeDismissed(true);
    setConflictDialogOpen(false);
    setStatus("继续编辑当前内容；保存前请先处理文件冲突");
  }, []);
  const exportPdf = useCallback(async () => {
    const target = printDocument.current;
    if (!target || exportingPdf) return;
    setExportingPdf(true);
    setStatus("正在准备 PDF…");
    try {
      await Vditor.preview(target, document.content, {
        cdn: "/vditor",
        lang: "zh_CN",
        mode: "light",
        markdown: { linkBase: "https://document.lwmd/" },
        render: { media: { enable: false } },
      });
      await waitForPrintAssets(target);
      const result = await desktop.pdf.export(pdfName(document.name));
      setStatus(result ? `PDF 已导出：${result.name}` : "已取消导出 PDF");
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setExportingPdf(false);
    }
  }, [document.content, document.name, exportingPdf]);
  const savePastedImages = useCallback(
    async (files: File[]) => {
      if (!document.path) {
        const message = "请先保存当前 Markdown 文件，再插入本地图片。";
        setStatus(message);
        window.alert(message);
        return [];
      }
      setStatus("正在保存图片…");
      try {
        const images: SavedImage[] = [];
        for (const file of files) {
          images.push(
            await desktop.image.save(
              document.path,
              file.type,
              await fileBase64(file),
            ),
          );
        }
        setStatus(`已插入 ${images.length} 张图片`);
        return images.map((image) => image.relativePath);
      } catch (error) {
        setStatus(errorMessage(error));
        return [];
      }
    },
    [document.path],
  );
  const chooseImages = useCallback(async () => {
    if (!document.path) {
      const message = "请先保存当前 Markdown 文件，再插入本地图片。";
      setStatus(message);
      window.alert(message);
      return [];
    }
    setStatus("正在选择图片…");
    try {
      const images = await desktop.image.choose(document.path);
      setStatus(
        images.length > 0 ? `已插入 ${images.length} 张图片` : "已取消插入图片",
      );
      return images.map((image) => image.relativePath);
    } catch (error) {
      setStatus(errorMessage(error));
      return [];
    }
  }, [document.path]);
  const persistRecoverySnapshot = useCallback(() => {
    const current = documentRef.current;
    if (!current.dirty && externalFileStateRef.current.kind === "none") return;
    const previous = lastRecoverySnapshot.current;
    if (
      previous?.path === current.path &&
      previous.name === current.name &&
      previous.content === current.content
    ) {
      return;
    }
    const snapshot = {
      path: current.path,
      name: current.name,
      content: current.content,
    };
    lastRecoverySnapshot.current = snapshot;
    void desktop.recovery.save(snapshot).catch((error) => {
      if (lastRecoverySnapshot.current === snapshot) {
        lastRecoverySnapshot.current = null;
      }
      if (!isDesktopUnavailable(error)) {
        setStatus("恢复快照保存失败，将稍后重试");
      }
    });
  }, []);
  const restoreRecovery = useCallback(async () => {
    try {
      const snapshot = await desktop.recovery.restore();
      lastRecoverySnapshot.current = {
        path: snapshot.path,
        name: snapshot.name,
        content: snapshot.content,
      };
      setDocument({
        path: snapshot.path,
        name: snapshot.name,
        content: snapshot.content,
        savedContent: `${snapshot.content}\0`,
        dirty: true,
        encoding: "utf-8",
        revision: null,
      });
      setExternalFileState({ kind: "none" });
      setExternalNoticeDismissed(false);
      setPendingRecovery(null);
      setRecoveryReady(true);
      setStatus("已恢复上次未保存的内容，请确认后保存");
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }, []);
  const discardRecovery = useCallback(async () => {
    try {
      await desktop.recovery.clear();
      setStatus("已放弃恢复快照");
    } catch (error) {
      if (!isDesktopUnavailable(error)) setStatus(errorMessage(error));
    } finally {
      lastRecoverySnapshot.current = null;
      setPendingRecovery(null);
      setRecoveryReady(true);
    }
  }, []);
  useEffect(() => {
    documentRef.current = document;
  }, [document]);
  useEffect(() => {
    externalFileStateRef.current = externalFileState;
  }, [externalFileState]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [settingsResult, launchResult, recoveryResult] =
        await Promise.allSettled([
          desktop.app.getSettings(),
          desktop.file.getLaunch(),
          desktop.recovery.get(),
        ] as const);
      if (cancelled) return;

      setSettings(
        settingsResult.status === "fulfilled"
          ? settingsResult.value
          : defaultSettings,
      );
      setSettingsReady(true);

      if (launchResult.status === "fulfilled") {
        if (launchResult.value) {
          acceptDocument(launchResult.value, false);
          setStatus("已从 Windows 打开文件");
        }
      } else if (!isDesktopUnavailable(launchResult.reason)) {
        setStatus(errorMessage(launchResult.reason));
      }

      if (recoveryResult.status === "fulfilled" && recoveryResult.value) {
        setPendingRecovery(recoveryResult.value);
      } else {
        setRecoveryReady(true);
      }
      setBootReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [acceptDocument]);
  useEffect(() => {
    if (!recoveryReady) return;
    if (!hasPersistenceRisk) {
      lastRecoverySnapshot.current = null;
      void desktop.recovery.clear().catch(() => undefined);
      return;
    }
    const timer = window.setTimeout(
      persistRecoverySnapshot,
      recoveryDebounceMs,
    );
    return () => window.clearTimeout(timer);
  }, [
    document.content,
    document.dirty,
    externalFileState.kind,
    hasPersistenceRisk,
    document.name,
    document.path,
    persistRecoverySnapshot,
    recoveryReady,
  ]);
  useEffect(() => {
    if (!recoveryReady) return;
    const interval = window.setInterval(
      persistRecoverySnapshot,
      recoveryIntervalMs,
    );
    return () => window.clearInterval(interval);
  }, [persistRecoverySnapshot, recoveryReady]);
  useEffect(() => {
    window.document.title = title;
    void desktop.app.setTitle(title).catch(() => undefined);
  }, [title]);
  useEffect(
    () => desktop.drop.onActive(({ active }) => setDropActive(active)),
    [],
  );
  useEffect(
    () =>
      desktop.drop.onFiles(({ files }) => {
        setDropActive(false);
        const markdown = files.find((file) => file.kind === "markdown");
        if (markdown) {
          if (!confirmDiscard()) {
            setStatus("已取消打开拖入文件");
            return;
          }
          setStatus("正在打开拖入文件…");
          void desktop.drop
            .openMarkdown(markdown.id)
            .then((result) => {
              acceptDocument(result);
              setStatus("已打开拖入文件");
            })
            .catch((error) => setStatus(errorMessage(error)));
          return;
        }
        const imageIds = files
          .filter((file) => file.kind === "image")
          .map((file) => file.id);
        if (imageIds.length === 0) return;
        if (!document.path) {
          const message = "请先保存当前 Markdown 文件，再插入本地图片。";
          setStatus(message);
          window.alert(message);
          return;
        }
        setStatus("正在导入图片…");
        void desktop.drop
          .importImages(document.path, imageIds)
          .then((images) => {
            editor.current?.insertMarkdown(
              images
                .map((image) => `![](<${image.relativePath}>)`)
                .join("\n\n"),
            );
            setStatus(`已插入 ${images.length} 张图片`);
          })
          .catch((error) => setStatus(errorMessage(error)));
      }),
    [acceptDocument, confirmDiscard, document.path],
  );
  useEffect(() => {
    if (!settingsReady) return;
    void desktop.app.setSettings(settings).catch(() => undefined);
  }, [settings, settingsReady]);
  useEffect(() => {
    void desktop.app.setDirty(hasPersistenceRisk).catch(() => undefined);
  }, [hasPersistenceRisk]);
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const check = async () => {
      const current = documentRef.current;
      if (current.path && current.revision) {
        const checkedPath = current.path;
        const checkedHash = current.revision.sha256;
        try {
          const result = await desktop.file.checkRevision(
            checkedPath,
            current.revision,
          );
          const latest = documentRef.current;
          if (
            !cancelled &&
            latest.path === checkedPath &&
            latest.revision?.sha256 === checkedHash
          ) {
            if (result.state === "missing") {
              setExternalFileState({ kind: "missing" });
              setExternalNoticeDismissed(false);
            } else if (result.state === "changed" && result.revision) {
              setExternalFileState({
                kind: "changed",
                observedRevision: result.revision,
              });
              setExternalNoticeDismissed(false);
            } else if (result.revision) {
              setExternalFileState({ kind: "none" });
              setDocument((previous) =>
                previous.path === checkedPath &&
                previous.revision?.sha256 === checkedHash
                  ? { ...previous, revision: result.revision ?? null }
                  : previous,
              );
            }
          }
        } catch {
          // A transient read failure should not make the editor lose content.
        }
      }
      if (!cancelled) timer = window.setTimeout(check, 3000);
    };
    timer = window.setTimeout(check, 3000);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [document.path, document.revision?.sha256]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const next =
        settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : settings.theme;
      setResolvedTheme(next);
      window.document.documentElement.dataset.theme = next;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings.theme]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (key === "f" || key === "h") {
        event.preventDefault();
        event.stopPropagation();
        setFindMode(key === "h" ? "replace" : "find");
        return;
      }
      if (key === "s") {
        event.preventDefault();
        void save(event.shiftKey);
      }
      if (key === "o") {
        event.preventDefault();
        void open();
      }
      if (key === "n") {
        event.preventDefault();
        createNew();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [createNew, open, save]);
  if (!bootReady) {
    return (
      <main className="boot-screen" role="status" aria-live="polite">
        <span className="boot-spinner" aria-hidden="true" />
        <strong>lw.MD</strong>
        <span>正在准备编辑器…</span>
      </main>
    );
  }
  return (
    <main
      className={`app-shell${settings.outlineVisible ? " with-outline" : ""}`}
    >
      <header>
        <div className="menu">
          <button onClick={createNew}>新建</button>
          <button onClick={() => void open()}>打开</button>
          <button onClick={() => void save()}>保存</button>
          <details
            className="menu-dropdown"
            name="application-menu"
            onMouseLeave={(event) =>
              event.currentTarget.removeAttribute("open")
            }
          >
            <summary>文件</summary>
            <div className="menu-popover">
              <button onClick={() => void save(true)}>另存为…</button>
              <button disabled={exportingPdf} onClick={() => void exportPdf()}>
                {exportingPdf ? "正在导出…" : "导出 PDF"}
              </button>
              <button onClick={() => setAssociationOpen(true)}>
                Windows 集成…
              </button>
              {settings.recentFiles.length > 0 && (
                <label>
                  最近文件
                  <select
                    className="recent-select"
                    value=""
                    onChange={(event) => void openRecent(event.target.value)}
                    aria-label="最近文件"
                  >
                    <option value="">请选择</option>
                    {settings.recentFiles.map((path) => (
                      <option key={path} value={path}>
                        {fileNameFromPath(path)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </details>
          <details
            className="menu-dropdown"
            name="application-menu"
            onMouseLeave={(event) =>
              event.currentTarget.removeAttribute("open")
            }
          >
            <summary>编辑</summary>
            <div className="menu-popover edit-menu-popover">
              <button onClick={() => setFindMode("find")}>
                <span>查找</span>
                <kbd>Ctrl+F</kbd>
              </button>
              <button onClick={() => setFindMode("replace")}>
                <span>替换</span>
                <kbd>Ctrl+H</kbd>
              </button>
            </div>
          </details>
          <details
            className="menu-dropdown"
            name="application-menu"
            onMouseLeave={(event) =>
              event.currentTarget.removeAttribute("open")
            }
          >
            <summary>视图</summary>
            <div className="menu-popover">
              <button
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    outlineVisible: !current.outlineVisible,
                  }))
                }
              >
                {settings.outlineVisible ? "隐藏大纲" : "显示大纲"}
              </button>
              <label>
                主题
                <select
                  className="theme-select"
                  value={settings.theme}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      theme: event.target.value as ThemeMode,
                    }))
                  }
                  aria-label="主题"
                >
                  <option value="system">跟随系统</option>
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                </select>
              </label>
            </div>
          </details>
          <button
            className="about-menu-button"
            onClick={() => setAboutOpen(true)}
          >
            关于
          </button>
        </div>
      </header>
      <ExternalFileNotice
        state={externalFileState}
        dirty={document.dirty}
        dismissed={externalNoticeDismissed}
        onReload={() => void reloadFromDisk()}
        onSaveAs={() => void save(true)}
        onContinue={continueWithCurrentContent}
      />
      {findMode && (
        <FindReplacePanel
          content={document.content}
          editor={editor}
          replaceVisible={findMode === "replace"}
          onChange={changeContent}
          onClose={() => setFindMode(null)}
          onReplaceVisibleChange={(visible) =>
            setFindMode(visible ? "replace" : "find")
          }
          onStatus={setStatus}
        />
      )}
      {settings.outlineVisible && (
        <OutlinePanel
          items={outline}
          onSelect={(item, index) =>
            editor.current?.scrollToHeading(item.text, index)
          }
        />
      )}
      <section className="editor-area">
        <MarkdownEditor
          ref={editor}
          value={document.content}
          onChange={changeContent}
          onChooseImages={chooseImages}
          onInsertImages={savePastedImages}
          dropActive={dropActive}
          theme={resolvedTheme}
        />
      </section>
      <footer>
        <span>{document.content.length} 字符</span>
        <span>Markdown</span>
        <span>{document.dirty ? "未保存" : "已保存"}</span>
        <span>{status}</span>
      </footer>
      {pendingRecovery && (
        <RecoveryDialog
          snapshot={pendingRecovery}
          onDiscard={discardRecovery}
          onRestore={restoreRecovery}
        />
      )}
      {aboutOpen && (
        <AboutDialog onClose={() => setAboutOpen(false)} onStatus={setStatus} />
      )}
      {associationOpen && (
        <WindowsIntegrationDialog
          onClose={() => setAssociationOpen(false)}
          onStatus={setStatus}
        />
      )}
      {conflictDialogOpen && (
        <FileConflictDialog
          state={externalFileState}
          onReload={() => void reloadFromDisk()}
          onSaveAs={() => {
            setConflictDialogOpen(false);
            void save(true);
          }}
          onContinue={continueWithCurrentContent}
        />
      )}
      <article
        ref={printDocument}
        className="print-document vditor-reset"
        aria-hidden="true"
      />
    </main>
  );
}

function pdfName(documentName: string) {
  const base = documentName.replace(/\.(?:md|markdown)$/i, "").trim();
  return `${base || "未命名"}.pdf`;
}

async function fileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const result = String(reader.result ?? "");
      const separator = result.indexOf(",");
      if (separator < 0) reject(new Error("无法读取图片数据"));
      else resolve(result.slice(separator + 1));
    });
    reader.addEventListener("error", () =>
      reject(new Error("无法读取图片数据")),
    );
    reader.readAsDataURL(file);
  });
}
