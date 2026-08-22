import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  interface Options {
    value: string;
    after(): void;
    input(value: string): void;
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
    insertMD() {}
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
    const onOpenMarkdown = vi.fn(async () => undefined);

    await act(async () => {
      root?.render(
        <MarkdownEditor
          value=""
          theme="light"
          onChange={onChange}
          onInsertImages={onInsertImages}
          onOpenMarkdown={onOpenMarkdown}
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
          onChange={onChange}
          onInsertImages={onInsertImages}
          onOpenMarkdown={onOpenMarkdown}
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
});
