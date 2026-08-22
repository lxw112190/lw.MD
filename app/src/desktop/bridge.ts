export interface BridgeError {
  code: string;
  message: string;
}
interface BridgeResponse {
  type: "response";
  id: string;
  ok: boolean;
  result?: unknown;
  error?: BridgeError;
}
interface BridgeEvent {
  type: "event";
  name: string;
  payload: unknown;
}
type BridgeMessage = BridgeResponse | BridgeEvent;

declare global {
  interface Window {
    chrome?: {
      webview?: {
        postMessage(message: unknown): void;
        addEventListener(
          name: "message",
          listener: (event: MessageEvent<unknown>) => void,
        ): void;
      };
    };
  }
}

const pending = new Map<
  string,
  {
    resolve(value: unknown): void;
    reject(reason: BridgeError): void;
    timeout: number;
  }
>();
const eventListeners = new Map<string, Set<(payload: unknown) => void>>();
const bridgeTimeoutMs = 60_000;
let sequence = 0;

export function decodeBridgeResponse(data: unknown): BridgeMessage | null {
  try {
    const value = typeof data === "string" ? JSON.parse(data) : data;
    if (!value || typeof value !== "object") return null;
    return value as BridgeMessage;
  } catch {
    return null;
  }
}

if (window.chrome?.webview) {
  window.chrome.webview.addEventListener("message", (event) => {
    const response = decodeBridgeResponse(event.data);
    if (!response) return;
    if (response.type === "event") {
      eventListeners
        .get(response.name)
        ?.forEach((listener) => listener(response.payload));
      return;
    }
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    window.clearTimeout(request.timeout);
    if (response.ok) {
      request.resolve(response.result);
    } else {
      request.reject(
        response.error ?? {
          code: "BRIDGE_ERROR",
          message: "Unknown desktop error",
        },
      );
    }
  });
}

export function subscribeDesktopEvent<T>(
  name: string,
  listener: (payload: T) => void,
): () => void {
  const listeners =
    eventListeners.get(name) ?? new Set<(payload: unknown) => void>();
  const wrapped = (payload: unknown) => listener(payload as T);
  listeners.add(wrapped);
  eventListeners.set(name, listeners);
  return () => {
    listeners.delete(wrapped);
    if (listeners.size === 0) eventListeners.delete(name);
  };
}

export function invoke<T>(method: string, params?: unknown): Promise<T> {
  const webview = window.chrome?.webview;
  if (!webview)
    return Promise.reject({
      code: "DESKTOP_UNAVAILABLE",
      message: "请在 lw.MD 桌面应用中使用文件操作。",
    } satisfies BridgeError);
  const id = `req-${Date.now()}-${++sequence}`;
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(id);
      reject({
        code: "BRIDGE_TIMEOUT",
        message: "桌面操作等待超时，请重试。",
      } satisfies BridgeError);
    }, bridgeTimeoutMs);
    pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
      timeout,
    });
    try {
      webview.postMessage({ type: "request", id, method, params });
    } catch {
      window.clearTimeout(timeout);
      pending.delete(id);
      reject({
        code: "BRIDGE_SEND_FAILED",
        message: "无法发送桌面操作请求。",
      } satisfies BridgeError);
    }
  });
}
