import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/app.css";
import "./styles/editor.css";
import "./styles/dialogs.css";
import "./styles/theme-light.css";
import "./styles/theme-dark.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
