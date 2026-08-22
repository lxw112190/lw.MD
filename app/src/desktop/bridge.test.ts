import { describe, expect, it } from "vitest";
import { decodeBridgeResponse } from "./bridge";

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

  it("accepts native file-open events", () => {
    const event = {
      type: "event",
      name: "file.opened",
      payload: { name: "demo.md" },
    };
    expect(decodeBridgeResponse(event)).toEqual(event);
  });

  it("accepts native image-drop events", () => {
    const event = {
      type: "event",
      name: "image.dropped",
      payload: { sourcePaths: ["C:\\Pictures\\示例.png"] },
    };
    expect(decodeBridgeResponse(event)).toEqual(event);
  });
});
