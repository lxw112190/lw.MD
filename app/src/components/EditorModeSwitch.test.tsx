import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorModeSwitch } from "./EditorModeSwitch";

describe("EditorModeSwitch", () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = null;
    host?.remove();
    host = null;
  });

  it("marks the active mode and emits explicit selections", async () => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    const onChange = vi.fn();

    await act(async () => {
      root?.render(<EditorModeSwitch mode="ir" onChange={onChange} />);
    });

    const buttons = host.querySelectorAll("button");
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      buttons[1]?.click();
    });
    expect(onChange).toHaveBeenCalledWith("sv");

    await act(async () => {
      buttons[0]?.click();
    });
    expect(onChange).toHaveBeenCalledWith("ir");
  });
});
