import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  interface Options {
    value: string;
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

import { MarkdownEditor } from "./MarkdownEditor";

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
          dropActive={false}
          onChange={onChange}
          onChooseImages={onChooseImages}
          onInsertImages={onInsertImages}
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
          dropActive={false}
          onChange={onChange}
          onChooseImages={onChooseImages}
          onInsertImages={onInsertImages}
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
          dropActive={false}
          onChange={vi.fn()}
          onChooseImages={onChooseImages}
          onInsertImages={vi.fn(async () => [])}
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
          dropActive
          onChange={vi.fn()}
          onChooseImages={vi.fn(async () => [])}
          onInsertImages={vi.fn(async () => [])}
        />,
      );
    });

    expect(host.querySelector(".drop-overlay")?.textContent).toContain(
      "打开 Markdown 或插入图片",
    );
  });
});
