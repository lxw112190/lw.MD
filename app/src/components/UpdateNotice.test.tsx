import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UpdateNotice } from "./UpdateNotice";

describe("UpdateNotice", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    host?.remove();
    host = null;
  });

  it("shows the version and forwards both actions", async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const onOpen = vi.fn();
    const onDismiss = vi.fn();

    await act(async () => {
      root?.render(
        <UpdateNotice version="0.4.4" onOpen={onOpen} onDismiss={onDismiss} />,
      );
    });

    expect(host.textContent).toContain("发现新版本 0.4.4");
    const buttons = host.querySelectorAll("button");
    await act(async () => {
      buttons[0]?.click();
      buttons[1]?.click();
    });
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
