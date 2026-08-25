import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeBridgeResponse, invoke } from "./bridge";

describe("desktop bridge response", () => {
  const response = { type: "response", id: "req-1", ok: true, result: "pong" };

  it("accepts the object delivered by WebView2", () => {
    expect(decodeBridgeResponse(response)).toEqual(response);
  });

  it("also accepts a JSON string for compatibility", () => {
    expect(decodeBridgeResponse(JSON.stringify(response))).toEqual(response);
  });

  it("ignores malformed JSON", () => {
    expect(decodeBridgeResponse("{")).toBeNull();
  });

  it("accepts native dropped-file grants", () => {
    const event = {
      type: "event",
      name: "drop.files",
      payload: {
        files: [
          { id: "grant-1", name: "demo.md", kind: "markdown", size: 128 },
        ],
      },
    };
    expect(decodeBridgeResponse(event)).toEqual(event);
  });

  it("accepts native drag-state events", () => {
    const event = {
      type: "event",
      name: "drop.active",
      payload: { active: true },
    };
    expect(decodeBridgeResponse(event)).toEqual(event);
  });
});

describe("desktop bridge requests", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete window.chrome;
  });

  it("rejects a native request that never replies", async () => {
    vi.useFakeTimers();
    window.chrome = {
      webview: {
        postMessage: vi.fn(),
        addEventListener: vi.fn(),
      },
    };
    const request = invoke("app.ping");
    const rejection = expect(request).rejects.toMatchObject({
      code: "BRIDGE_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(60_000);
    await rejection;
  });
});
