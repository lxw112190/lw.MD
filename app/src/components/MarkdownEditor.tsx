import Vditor from "vditor";
import "vditor/dist/index.css";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

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
  onInsertImages(files: File[]): Promise<string[]>;
  onOpenMarkdown(file: File): Promise<void>;
  theme: "light" | "dark";
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, Props>(
  function MarkdownEditor(
    { value, onChange, onInsertImages, onOpenMarkdown, theme },
    ref,
  ) {
    const container = useRef<HTMLDivElement>(null);
    const editor = useRef<Vditor | null>(null);
    const valueRef = useRef(value);
    const readyRef = useRef(false);
    const themeRef = useRef(theme);
    const [draggingFiles, setDraggingFiles] = useState(false);
    themeRef.current = theme;
    useEffect(() => {
      if (!container.current) return;
      const instance = new Vditor(container.current, {
        mode: "ir",
        cache: { enable: false },
        cdn: "/vditor",
        height: "100%",
        icon: "material",
        theme: "classic",
        preview: {
          markdown: { linkBase: "https://document.lwmd/" },
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
          "|",
          "undo",
          "redo",
        ],
        value: valueRef.current,
        after: () =>
          queueMicrotask(() => {
            const current = editor.current;
            if (!current) return;
            readyRef.current = true;
            const currentTheme = themeRef.current;
            current.setTheme(
              currentTheme === "dark" ? "dark" : "classic",
              currentTheme === "dark" ? "dark" : "light",
            );
            current.focus();
          }),
        input: (nextValue) => {
          valueRef.current = nextValue;
          onChange(nextValue);
        },
      });
      editor.current = instance;
      return () => {
        if (readyRef.current && instance.vditor?.element) instance.destroy();
        readyRef.current = false;
        editor.current = null;
      };
    }, [onChange]);
    useEffect(() => {
      if (value !== valueRef.current && editor.current) {
        valueRef.current = value;
        editor.current.setValue(value, true);
      }
    }, [value]);

    useEffect(() => {
      if (!readyRef.current) return;
      editor.current?.setTheme(
        theme === "dark" ? "dark" : "classic",
        theme === "dark" ? "dark" : "light",
      );
    }, [theme]);
    useEffect(() => {
      let dragDepth = 0;
      const containsFiles = (event: DragEvent) =>
        Array.from(event.dataTransfer?.items ?? []).some(
          (item) => item.kind === "file",
        );
      const clearDragState = () => {
        dragDepth = 0;
        setDraggingFiles(false);
      };
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
      const onDragEnter = (event: DragEvent) => {
        if (!containsFiles(event)) return;
        event.preventDefault();
        dragDepth += 1;
        setDraggingFiles(true);
      };
      const onDrop = (event: DragEvent) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        clearDragState();
        const markdown = files.find((file) =>
          /\.(?:md|markdown)$/i.test(file.name),
        );
        const images = files.filter(
          (file) =>
            file.type.startsWith("image/") ||
            /\.(?:png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name),
        );
        if (!markdown && images.length === 0) return;
        event.dataTransfer!.dropEffect = "copy";
        if (markdown) void onOpenMarkdown(markdown);
        else void insertImages(images);
      };
      const onDragOver = (event: DragEvent) => {
        if (containsFiles(event)) {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        }
      };
      const onDragLeave = (event: DragEvent) => {
        if (!containsFiles(event)) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) setDraggingFiles(false);
      };
      window.addEventListener("paste", onPaste, true);
      window.addEventListener("dragenter", onDragEnter, true);
      window.addEventListener("drop", onDrop, true);
      window.addEventListener("dragover", onDragOver, true);
      window.addEventListener("dragleave", onDragLeave, true);
      window.addEventListener("dragend", clearDragState, true);
      window.addEventListener("blur", clearDragState);
      return () => {
        window.removeEventListener("paste", onPaste, true);
        window.removeEventListener("dragenter", onDragEnter, true);
        window.removeEventListener("drop", onDrop, true);
        window.removeEventListener("dragover", onDragOver, true);
        window.removeEventListener("dragleave", onDragLeave, true);
        window.removeEventListener("dragend", clearDragState, true);
        window.removeEventListener("blur", clearDragState);
      };
    }, [onInsertImages, onOpenMarkdown]);
    useImperativeHandle(ref, () => ({
      focus: () => editor.current?.focus(),
      getValue: () => editor.current?.getValue() ?? "",
      insertMarkdown: (nextValue) => editor.current?.insertMD(nextValue),
      revealText: (text, occurrence, matchCase) =>
        revealTextInEditor(container.current, text, occurrence, matchCase),
      redo: () => editor.current?.vditor.undo?.redo(editor.current.vditor),
      setValue: (nextValue) => {
        valueRef.current = nextValue;
        editor.current?.setValue(nextValue, true);
      },
      scrollToHeading: (text, occurrence) => {
        const headings = Array.from(
          container.current?.querySelectorAll<HTMLElement>(
            '[data-type="heading"], h1, h2, h3, h4, h5, h6',
          ) ?? [],
        );
        const exact = headings.filter(
          (heading) =>
            (heading.textContent ?? "").replace(/^#{1,6}\s*/, "").trim() ===
            text,
        );
        const target = headings[occurrence] ?? exact[0];
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
      undo: () => editor.current?.vditor.undo?.undo(editor.current.vditor),
    }));
    return (
      <div className="markdown-editor-shell">
        <div ref={container} className="markdown-editor" />
        {draggingFiles && (
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
) {
  const root = container?.querySelector<HTMLElement>(".vditor-ir");
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
