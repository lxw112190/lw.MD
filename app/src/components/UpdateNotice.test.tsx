import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateNotice } from "./UpdateNotice";

describe("UpdateNotice", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;
  const showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });

  beforeEach(() => {
    // jsdom does not implement the native dialog/top-layer API.
    Object.defineProperties(HTMLDialogElement.prototype, {
      showModal: { configurable: true, value: showModal },
      close: { configurable: true, value: close },
    });
    showModal.mockClear();
    close.mockClear();
    host = document.createElement("div");
    host.className = "app-shell";
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    host?.remove();
    host = null;
    Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
    Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  });

  it("shows the version and forwards both actions", async () => {
    const onOpen = vi.fn();
    const onDismiss = vi.fn();

    await act(async () => {
      root?.render(
        <UpdateNotice
          currentVersion="0.4.7"
          version="0.4.8"
          onOpen={onOpen}
          onDismiss={onDismiss}
        />,
      );
    });

    const dialog = document.body.querySelector("dialog")!;
    expect(dialog.parentElement).toBe(document.body);
    expect(host?.contains(dialog)).toBe(false);
    expect(dialog.open).toBe(true);
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog.textContent).toContain("v0.4.7 → v0.4.8");
    const buttons = dialog.querySelectorAll("button");
    await act(async () => {
      buttons[0]?.click();
      buttons[1]?.click();
    });
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("dismisses on native Escape cancellation and removes the modal on unmount", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      root?.render(
        <UpdateNotice
          currentVersion="0.4.7"
          version="0.4.8"
          onOpen={vi.fn()}
          onDismiss={onDismiss}
        />,
      );
    });
    const dialog = document.body.querySelector("dialog")!;
    const cancel = new Event("cancel", { cancelable: true });
    await act(async () => {
      dialog.dispatchEvent(cancel);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(cancel.defaultPrevented).toBe(true);

    await act(async () => root?.unmount());
    root = null;
    expect(close).toHaveBeenCalledOnce();
    expect(document.body.querySelector("dialog")).toBeNull();
  });

  it("does not pass dialog keystrokes to the editor's global shortcuts", async () => {
    const onKeyDown = vi.fn();
    window.addEventListener("keydown", onKeyDown);
    try {
      await act(async () => {
        root?.render(
          <UpdateNotice
            currentVersion="0.4.7"
            version="0.4.8"
            onOpen={vi.fn()}
            onDismiss={vi.fn()}
          />,
        );
      });
      document.body.querySelector("dialog button")!.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "s",
          ctrlKey: true,
          bubbles: true,
        }),
      );
      expect(onKeyDown).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", onKeyDown);
    }
  });
});
