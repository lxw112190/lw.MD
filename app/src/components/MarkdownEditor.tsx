import Vditor from "vditor";
import "vditor/dist/index.css";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import vditorRuntime from "../../vditor-runtime.config.json";
import { normalizeDocumentImages } from "../markdown/documentImages";
import { createDocumentMarkdownOptions } from "../markdown/vditorMarkdown";
import type { EditorMode } from "../editor/editorMode";

export interface MarkdownEditorHandle {
  focus(): void;
  getValue(): string;
  redo(): void;
  setValue(value: string): void;
  insertMarkdown(value: string): void;
  revealText(text: string, occurrence: number, matchCase: boolean): boolean;
  scrollToHeading(text: string, occurrence: number): void;
  undo(): void;
}

interface Props {
  value: string;
  onChange(value: string): void;
  onChooseImages(): Promise<string[]>;
  onInsertImages(files: File[]): Promise<string[]>;
  dropActive: boolean;
  theme: "light" | "dark";
  mode: EditorMode;
}

function applyEditorTheme(instance: Vditor, theme: "light" | "dark") {
  const configuredTheme = vditorRuntime.themes[theme];
  instance.setTheme(
    configuredTheme.editor as "classic" | "dark",
    configuredTheme.content,
    configuredTheme.code,
  );
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(
  function MarkdownEditor(
    {
      value,
      onChange,
      onChooseImages,
      onInsertImages,
      dropActive,
      theme,
      mode,
    },
    ref,
  ) {
    const container = useRef<HTMLDivElement>(null);
    const editor = useRef<Vditor | null>(null);
    const valueRef = useRef(value);
    const readyRef = useRef(false);
    const themeRef = useRef(theme);
    const onChooseImagesRef = useRef(onChooseImages);
    const scheduleImageScanRef = useRef<() => void>(() => undefined);
    themeRef.current = theme;
    onChooseImagesRef.current = onChooseImages;
    useEffect(() => {
      if (!container.current) return;
      const editorContainer = container.current;
      let imageScanFrame: number | null = null;
      const scheduleImageScan = () => {
        if (imageScanFrame !== null) return;
        imageScanFrame = window.requestAnimationFrame(() => {
          imageScanFrame = null;
          normalizeDocumentImages(editorContainer);
        });
      };
      scheduleImageScanRef.current = scheduleImageScan;
      const imageObserver = new MutationObserver(() => {
        scheduleImageScan();
      });
      imageObserver.observe(editorContainer, {
        attributeFilter: ["src"],
        attributes: true,
        childList: true,
        subtree: true,
      });
      const instance = new Vditor(container.current, {
        mode,
        lang: vditorRuntime.locale as "zh_CN",
        cache: { enable: false },
        cdn: "/vditor",
        height: "100%",
        icon: vditorRuntime.icon as "material",
        theme: "classic",
        preview: {
          markdown: createDocumentMarkdownOptions(),
          math: {
            engine: vditorRuntime.math.engine as "KaTeX",
            inlineDigit: vditorRuntime.math.inlineDigit,
            macros: {},
          },
        },
        toolbar: [
          "emoji",
          "headings",
          "bold",
          "italic",
          "strike",
          "|",
          "quote",
          "line",
          "list",
          "ordered-list",
          "check",
          "outdent",
          "indent",
          "|",
          "code",
          "inline-code",
          "insert-after",
          "table",
          "link",
          {
            name: "insert-image",
            icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 16H5l3.5-4.5 2.5 3.01L14.5 13l4.5 6ZM8.5 10.5A1.5 1.5 0 1 1 8.5 7a1.5 1.5 0 0 1 0 3.5Z"/></svg>',
            tip: "插入本地图片",
            click: () => {
              void onChooseImagesRef.current().then((paths) => {
                if (paths.length > 0) {
                  editor.current?.insertMD(
                    paths.map((path) => `![](<${path}>)`).join("\n\n"),
                  );
                }
              });
            },
          },
          "|",
          "undo",
          "redo",
        ],
        value: valueRef.current,
        after: () =>
          queueMicrotask(() => {
            const current = editor.current;
            if (!current) return;
            const latestValue = valueRef.current;
            if (current.getValue() !== latestValue) {
              current.setValue(latestValue, true);
            }
            scheduleImageScan();
            readyRef.current = true;
            const currentTheme = themeRef.current;
            applyEditorTheme(current, currentTheme);
            current.focus();
          }),
        input: (nextValue) => {
          if (!readyRef.current) return;
          valueRef.current = nextValue;
          onChange(nextValue);
        },
      });
      editor.current = instance;
      return () => {
        imageObserver.disconnect();
        scheduleImageScanRef.current = () => undefined;
        if (imageScanFrame !== null) {
          window.cancelAnimationFrame(imageScanFrame);
        }
        if (readyRef.current && instance.vditor?.element) instance.destroy();
        readyRef.current = false;
        editor.current = null;
      };
    }, [onChange, mode]);
    useEffect(() => {
      if (value === valueRef.current) return;
      valueRef.current = value;
      if (readyRef.current) {
        editor.current?.setValue(value, true);
        scheduleImageScanRef.current();
      }
    }, [value]);

    useEffect(() => {
      if (!readyRef.current) return;
      const instance = editor.current;
      if (instance) applyEditorTheme(instance, theme);
    }, [theme]);
    useEffect(() => {
      const insertImages = async (files: File[]) => {
        const paths = await onInsertImages(files);
        if (paths.length === 0) return;
        editor.current?.insertMD(
          paths.map((path) => `![](<${path}>)`).join("\n\n"),
        );
      };
      const onPaste = (event: ClipboardEvent) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(
          (file) => file.type.startsWith("image/"),
        );
        if (files.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        void insertImages(files);
      };
      window.addEventListener("paste", onPaste, true);
      return () => {
        window.removeEventListener("paste", onPaste, true);
      };
    }, [onInsertImages]);
    useImperativeHandle(ref, () => ({
      focus: () => editor.current?.focus(),
      getValue: () => editor.current?.getValue() ?? "",
      insertMarkdown: (nextValue) => editor.current?.insertMD(nextValue),
      revealText: (text, occurrence, matchCase) =>
        revealTextInEditor(
          container.current,
          text,
          occurrence,
          matchCase,
          mode,
        ),
      redo: () => editor.current?.vditor.undo?.redo(editor.current.vditor),
      setValue: (nextValue) => {
        valueRef.current = nextValue;
        editor.current?.setValue(nextValue, true);
      },
      scrollToHeading: (text, occurrence) => {
        const headings = Array.from(
          container.current?.querySelectorAll<HTMLElement>(
            '.vditor-ir [data-type="heading"], .vditor-ir h1, .vditor-ir h2, .vditor-ir h3, .vditor-ir h4, .vditor-ir h5, .vditor-ir h6, .vditor-preview [data-type="heading"], .vditor-preview h1, .vditor-preview h2, .vditor-preview h3, .vditor-preview h4, .vditor-preview h5, .vditor-preview h6',
          ) ?? [],
        );
        const exact = headings.filter(
          (heading) =>
            (heading.textContent ?? "").replace(/^#{1,6}\s*/, "").trim() ===
            text,
        );
        const target = exact[occurrence] ?? headings[occurrence] ?? exact[0];
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
      undo: () => editor.current?.vditor.undo?.undo(editor.current.vditor),
    }));
    return (
      <div className="markdown-editor-shell">
        <div ref={container} className="markdown-editor" />
        {dropActive && (
          <div className="drop-overlay" role="status">
            <strong>松开鼠标</strong>
            <span>打开 Markdown 或插入图片</span>
          </div>
        )}
      </div>
    );
  },
);

function revealTextInEditor(
  container: HTMLDivElement | null,
  query: string,
  occurrence: number,
  matchCase: boolean,
  mode: EditorMode,
) {
  const root = container?.querySelector<HTMLElement>(
    mode === "sv" ? ".vditor-sv" : ".vditor-ir",
  );
  if (!root || !query) return false;

  const walker = window.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments: Array<{ node: Text; start: number; end: number }> = [];
  let content = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text;
    if (!textNode.data) continue;
    const start = content.length;
    content += textNode.data;
    segments.push({ node: textNode, start, end: content.length });
  }

  const pattern = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    matchCase ? "gu" : "giu",
  );
  const matches = Array.from(content.matchAll(pattern));
  if (matches.length === 0) return false;
  const selected = matches[occurrence % matches.length];
  const start = selected.index;
  const end = start + selected[0].length;
  const startSegment = segments.find(
    (segment) => start >= segment.start && start < segment.end,
  );
  const endSegment = segments.find(
    (segment) => end > segment.start && end <= segment.end,
  );
  if (!startSegment || !endSegment) return false;

  root.focus();
  const range = window.document.createRange();
  range.setStart(startSegment.node, start - startSegment.start);
  range.setEnd(endSegment.node, end - endSegment.start);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  startSegment.node.parentElement?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
  return true;
}
