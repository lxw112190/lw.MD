const port = process.argv[2] ?? "9333";
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = targets.find((target) => target.type === "page");
if (!page) throw new Error("No WebView2 page target found");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
const events = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (["Runtime.exceptionThrown", "Runtime.consoleAPICalled", "Log.entryAdded"].includes(message.method)) {
    events.push(message);
  }
});
socket.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
socket.send(JSON.stringify({ id: 2, method: "Log.enable" }));
socket.send(JSON.stringify({ id: 3, method: "Page.reload", params: { ignoreCache: true } }));
await new Promise((resolve) => setTimeout(resolve, 5000));
socket.close();
console.log(JSON.stringify(events, null, 2));
