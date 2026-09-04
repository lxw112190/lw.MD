import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  interface Options {
    value: string;
    mode: "ir" | "sv";
    after(): void;
    input(value: string): void;
    toolbar: Array<
      | string
      | {
          name: string;
          tip?: string;
          click(): void;
        }
    >;
    preview: {
      markdown: {
        linkBase: string;
        mark: boolean;
      };
    };
  }

  class MockVditor {
    static instances: MockVditor[] = [];

    readonly options: Options;
    readonly setValues: string[] = [];
    readonly vditor = {
      element: document.createElement("div"),
      undo: {
        redo: vi.fn(),
        undo: vi.fn(),
      },
    };
    value: string;

    constructor(_container: HTMLDivElement, options: Options) {
      this.options = options;
      this.value = options.value;
      MockVditor.instances.push(this);
    }

    destroy() {}
    focus() {}
    getValue() {
      return this.value;
    }
    insertMD = vi.fn();
    setTheme() {}
    setValue(value: string) {
      this.value = value;
      this.setValues.push(value);
    }
  }

  return { MockVditor };
});

vi.mock("vditor", () => ({ default: mock.MockVditor }));

import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";

describe("MarkdownEditor", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    host?.remove();
    host = null;
    mock.MockVditor.instances.length = 0;
  });

  it("applies a launch document received before Vditor is ready", async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const onChange = vi.fn();
    const onInsertImages = vi.fn(async () => [] as string[]);
    const onChooseImages = vi.fn(async () => [] as string[]);

    await act(async () => {
      root?.render(
        <MarkdownEditor
          value=""
          theme="light"
          mode="ir"
          dropActive={false}
          onChange={onChange}
          onChooseImages={onChooseImages}
          onInsertImages={onInsertImages}
          resourceScope="test-document"
        />,
      );
    });
    const instance = mock.MockVditor.instances[0];
    expect(instance.value).toBe("");

    await act(async () => {
      root?.render(
        <MarkdownEditor
          value="# 从 Windows 打开的文档"
          theme="light"
          mode="ir"
          dropActive={false}
          onChange={onChange}
          onChooseImages={onChooseImages}
          onInsertImages={onInsertImages}
          resourceScope="test-document"
        />,
      );
    });
    expect(instance.setValues).toEqual([]);

    await act(async () => {
      instance.options.after();
      await Promise.resolve();
    });

    expect(instance.value).toBe("# 从 Windows 打开的文档");
    expect(instance.setValues).toEqual(["# 从 Windows 打开的文档"]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("enables Markdown mark syntax in every editor mode", async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const common = {
      value: "==重点==",
      theme: "light" as const,
      dropActive: false,
      onChange: vi.fn(),
      onChooseImages: vi.fn(async () => [] as string[]),
      onInsertImages: vi.fn(async () => [] as string[]),
      resourceScope: "test-document",
    };

    await act(async () => {
      root?.render(<MarkdownEditor {...common} mode="ir" />);
    });
    await act(async () => {
      root?.render(<MarkdownEditor {...common} mode="sv" />);
    });

    expect(
      mock.MockVditor.instances.map(
        (instance) => instance.options.preview.markdown,
      ),
    ).toEqual([
      { linkBase: "https://document.lwmd/", mark: true },
      { linkBase: "https://document.lwmd/", mark: true },
    ]);
  });

  it("inserts images selected from the editor toolbar", async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const onChooseImages = vi.fn(async () => ["./assets/封面.png"]);

    await act(async () => {
      root?.render(
        <MarkdownEditor
          value="# 图片测试"
          theme="light"
          mode="ir"
          dropActive={false}
          onChange={vi.fn()}
          onChooseImages={onChooseImages}
          onInsertImages={vi.fn(async () => [])}
          resourceScope="test-document"
        />,
      );
    });
    const instance = mock.MockVditor.instances[0];
    const imageButton = instance.options.toolbar.find(
      (item) => typeof item !== "string" && item.name === "insert-image",
    );
    expect(imageButton).toBeTypeOf("object");
    if (typeof imageButton !== "string") {
      expect(imageButton?.tip).toBe("插入本地图片");
    }
    await act(async () => {
      if (typeof imageButton !== "string") imageButton?.click();
      await Promise.resolve();
    });

    expect(onChooseImages).toHaveBeenCalledOnce();
    expect(instance.insertMD).toHaveBeenCalledWith("![](<./assets/封面.png>)");
  });

  it("shows the native drag hint over the editor workspace", async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <MarkdownEditor
          value=""
          theme="light"
          mode="ir"
          dropActive
          onChange={vi.fn()}
          onChooseImages={vi.fn(async () => [])}
          onInsertImages={vi.fn(async () => [])}
          resourceScope="test-document"
        />,
      );
    });

    expect(host.querySelector(".drop-overlay")?.textContent).toContain(
      "打开 Markdown 或插入图片",
    );
  });

  it("rebuilds Vditor when the editor mode changes", async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const common = {
      value: "# 模式测试",
      theme: "light" as const,
      dropActive: false,
      onChange: vi.fn(),
      onChooseImages: vi.fn(async () => [] as string[]),
      onInsertImages: vi.fn(async () => [] as string[]),
      resourceScope: "test-document",
    };
    await act(async () => {
      root?.render(<MarkdownEditor {...common} mode="ir" />);
    });
    await act(async () => {
      root?.render(<MarkdownEditor {...common} mode="sv" />);
    });
    expect(mock.MockVditor.instances.map((item) => item.options.mode)).toEqual([
      "ir",
      "sv",
    ]);
  });

  it.each([
    ["ir", "vditor-ir"],
    ["sv", "vditor-sv"],
  ] as const)(
    "reveals text in %s mode without stealing focus",
    async (mode, rootClass) => {
      host = document.createElement("div");
      document.body.append(host);
      root = createRoot(host);
      const editorRef = createRef<MarkdownEditorHandle>();

      await act(async () => {
        root?.render(
          <MarkdownEditor
            ref={editorRef}
            value="前面的文字 target 后面的文字"
            theme="light"
            mode={mode}
            dropActive={false}
            onChange={vi.fn()}
            onChooseImages={vi.fn(async () => [])}
            onInsertImages={vi.fn(async () => [])}
            resourceScope="test-document"
          />,
        );
      });

      const editorContainer = host.querySelector(".markdown-editor");
      expect(editorContainer).not.toBeNull();
      const editorRoot = document.createElement("div");
      editorRoot.className = rootClass;
      editorRoot.tabIndex = -1;
      editorRoot.textContent = "前面的文字 target 后面的文字";
      editorRoot.scrollIntoView = vi.fn();
      editorContainer?.append(editorRoot);

      const searchInput = document.createElement("input");
      document.body.append(searchInput);
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);

      const selection = window.getSelection();
      expect(selection).not.toBeNull();
      const addRange = selection!.addRange.bind(selection);
      const addRangeSpy = vi
        .spyOn(selection!, "addRange")
        .mockImplementation((range) => {
          addRange(range);
          editorRoot.focus();
        });

      try {
        expect(editorRef.current?.revealText("target", 0, false)).toBe(true);
        expect(addRangeSpy).toHaveBeenCalledOnce();
        expect(addRangeSpy.mock.calls[0][0].toString()).toBe("target");
        expect(document.activeElement).toBe(searchInput);
      } finally {
        addRangeSpy.mockRestore();
        searchInput.remove();
      }
    },
  );
});
