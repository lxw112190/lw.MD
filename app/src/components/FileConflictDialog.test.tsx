import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileConflictDialog } from "./FileConflictDialog";

describe("FileConflictDialog", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.open = true;
        },
      },
      close: {
        configurable: true,
        value: function (this: HTMLDialogElement) {
          this.open = false;
        },
      },
    });
    host = document.createElement("div");
    host.className = "app-shell";
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  });

  it("opens outside the editor grid and preserves all conflict actions", async () => {
    const onReload = vi.fn();
    const onSaveAs = vi.fn();
    const onContinue = vi.fn();
    await act(async () => {
      root.render(
        <FileConflictDialog
          state={{
            kind: "changed",
            observedRevision: { size: 1, lastWriteTime: "1", sha256: "new" },
          }}
          dirty
          onReload={onReload}
          onSaveAs={onSaveAs}
          onContinue={onContinue}
        />,
      );
    });
    const dialog = document.body.querySelector("dialog")!;
    expect(dialog.parentElement).toBe(document.body);
    expect(host.contains(dialog)).toBe(false);
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("当前有未保存的修改");
    const buttons = dialog.querySelectorAll("button");
    expect(document.activeElement).toBe(buttons[2]);
    await act(async () => buttons.forEach((button) => button.click()));
    expect(onReload).toHaveBeenCalledOnce();
    expect(onSaveAs).toHaveBeenCalledOnce();
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("offers save-as and continue for missing files; Escape also continues", async () => {
    const onContinue = vi.fn();
    const onReload = vi.fn();
    await act(async () => {
      root.render(
        <FileConflictDialog
          state={{ kind: "missing" }}
          dirty
          onReload={onReload}
          onSaveAs={vi.fn()}
          onContinue={onContinue}
        />,
      );
    });
    const dialog = document.body.querySelector("dialog")!;
    expect(dialog.querySelectorAll("button")).toHaveLength(2);
    expect(dialog.textContent).not.toContain("重新加载");
    const cancel = new Event("cancel", { cancelable: true });
    await act(async () => dialog.dispatchEvent(cancel));
    expect(cancel.defaultPrevented).toBe(true);
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onReload).not.toHaveBeenCalled();
  });

  it("renders nothing when there is no conflict", async () => {
    await act(async () => {
      root.render(
        <FileConflictDialog
          state={{ kind: "none" }}
          dirty={false}
          onReload={vi.fn()}
          onSaveAs={vi.fn()}
          onContinue={vi.fn()}
        />,
      );
    });
    expect(document.body.querySelector("dialog")).toBeNull();
  });
});
