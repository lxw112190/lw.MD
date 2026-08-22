import Vditor from "vditor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "./components/MarkdownEditor";
import { OutlinePanel } from "./components/OutlinePanel";
import {
  desktop,
  type DesktopSettings,
  type NativeDocument,
  type SavedImage,
  type ThemeMode,
} from "./desktop/desktop";
import {
  createUntitledDocument,
  markDocumentSaved,
  updateDocumentContent,
  type DocumentState,
} from "./document/documentModel";
import { addRecentFile, fileNameFromPath } from "./document/recentFiles";
import { getMarkdownOutline } from "./markdown/outline";

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
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [exportingPdf, setExportingPdf] = useState(false);
  const editor = useRef<MarkdownEditorHandle>(null);
  const printDocument = useRef<HTMLDivElement>(null);
  const outline = useMemo(
    () => getMarkdownOutline(document.content),
    [document.content],
  );
  const title = `${document.name}${document.dirty ? " *" : ""} — lw.MD`;
  const acceptDocument = useCallback((result: NativeDocument) => {
    setDocument({
      ...result,
      savedContent: result.content,
      dirty: false,
      encoding: "utf-8",
    });
    setSettings((current) => ({
      ...current,
      recentFiles: addRecentFile(current.recentFiles, result.path),
    }));
  }, []);
  const changeContent = useCallback((content: string) => {
    setDocument((current) => updateDocumentContent(current, content));
  }, []);
  const confirmDiscard = useCallback(
    () =>
      !document.dirty || window.confirm("当前文档尚未保存，确定放弃修改吗？"),
    [document.dirty],
  );
  const createNew = useCallback(() => {
    if (!confirmDiscard()) return;
    setDocument(createUntitledDocument());
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
            ? await desktop.file.save(document.path, document.content)
            : await desktop.file.saveAs(
                document.content,
                document.name === "Untitled" ? "Untitled.md" : document.name,
              );
        if (result) {
          setDocument((current) =>
            markDocumentSaved(current, result.path, result.name),
          );
          setSettings((current) => ({
            ...current,
            recentFiles: addRecentFile(current.recentFiles, result.path),
          }));
          setStatus("已保存");
        }
      } catch (error) {
        setStatus(errorMessage(error));
      }
    },
    [document],
  );
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
  const openDroppedMarkdown = useCallback(
    async (file: File) => {
      if (!confirmDiscard()) return;
      try {
        const content = await file.text();
        setDocument({
          path: null,
          name: file.name,
          content,
          savedContent: "",
          dirty: true,
          encoding: "utf-8",
        });
        setStatus("已载入拖入文件，首次保存时请选择位置");
      } catch (error) {
        setStatus(errorMessage(error));
      }
    },
    [confirmDiscard],
  );
  useEffect(() => {
    window.document.title = title;
  }, [title]);
  useEffect(
    () =>
      desktop.file.onOpened((result) => {
        acceptDocument(result);
        setStatus("已打开拖入文件");
      }),
    [acceptDocument],
  );
  useEffect(
    () =>
      desktop.image.onDropped(({ sourcePaths }) => {
        if (!document.path) {
          const message = "请先保存当前 Markdown 文件，再插入本地图片。";
          setStatus(message);
          window.alert(message);
          return;
        }
        setStatus("正在导入图片…");
        void desktop.image
          .import(document.path, sourcePaths)
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
    [document.path],
  );
  useEffect(() => {
    void desktop.app
      .getSettings()
      .then(setSettings)
      .catch(() => setSettings(defaultSettings))
      .finally(() => setSettingsReady(true));
  }, []);
  useEffect(() => {
    if (!settingsReady) return;
    void desktop.app.setSettings(settings).catch(() => undefined);
  }, [settings, settingsReady]);
  useEffect(() => {
    void desktop.app.setDirty(document.dirty).catch(() => undefined);
  }, [document.dirty]);
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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createNew, open, save]);
  return (
    <main
      className={`app-shell${settings.outlineVisible ? " with-outline" : ""}`}
    >
      <header>
        <div className="menu">
          <button onClick={createNew}>新建</button>
          <button onClick={() => void open()}>打开</button>
          <button onClick={() => void save()}>保存</button>
          <button onClick={() => void save(true)}>另存为</button>
          <button disabled={exportingPdf} onClick={() => void exportPdf()}>
            {exportingPdf ? "正在导出…" : "导出 PDF"}
          </button>
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
          {settings.recentFiles.length > 0 && (
            <select
              className="recent-select"
              value=""
              onChange={(event) => void openRecent(event.target.value)}
              aria-label="最近文件"
            >
              <option value="">最近文件</option>
              {settings.recentFiles.map((path) => (
                <option key={path} value={path}>
                  {fileNameFromPath(path)}
                </option>
              ))}
            </select>
          )}
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
        </div>
        <span className="document-name">{document.name}</span>
      </header>
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
          onInsertImages={savePastedImages}
          onOpenMarkdown={openDroppedMarkdown}
          theme={resolvedTheme}
        />
      </section>
      <footer>
        <span>{document.content.length} 字</span>
        <span>Markdown</span>
        <span>{document.dirty ? "未保存" : "已保存"}</span>
        <span>{status}</span>
      </footer>
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
  return `${base || "Untitled"}.pdf`;
}

async function waitForPrintAssets(target: HTMLElement) {
  await Promise.all(
    Array.from(target.querySelectorAll("img")).map(
      (image) =>
        image.complete ||
        new Promise<void>((resolve) => {
          const finish = () => resolve();
          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
          window.setTimeout(finish, 5000);
        }),
    ),
  );
  await window.document.fonts?.ready;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
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

function errorMessage(error: unknown) {
  return typeof error === "object" && error && "message" in error
    ? String(error.message)
    : "操作失败";
}
