const port = process.argv[2] ?? "9333";
const expression = process.argv[3] ?? "document.title";
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("No WebView2 page target found");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
const response = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("DevTools response timed out")), 5000);
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id !== 1) return;
    clearTimeout(timeout);
    resolve(message);
  });
});
socket.close();
console.log(JSON.stringify(response, null, 2));
