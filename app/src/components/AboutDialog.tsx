import { useEffect } from "react";
import packageInfo from "../../package.json";
import { desktop } from "../desktop/desktop";
import { errorMessage } from "../desktop/errors";

const repositoryUrl = "https://github.com/lxw112190/lw.MD";
const latestReleaseUrl = `${repositoryUrl}/releases/latest`;

interface AboutDialogProps {
  onClose(): void;
  onStatus(message: string): void;
}

export function AboutDialog({ onClose, onStatus }: AboutDialogProps) {
  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  const openWebsite = async (url: string, label: string) => {
    try {
      await desktop.app.openExternal(url);
      onStatus(`已在浏览器打开${label}`);
    } catch (error) {
      onStatus(errorMessage(error));
    }
  };

  return (
    <div
      className="about-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
      >
        <button
          className="about-close"
          aria-label="关闭关于窗口"
          onClick={onClose}
        >
          ×
        </button>
        <img src="/app-icon.png" alt="" className="about-icon" />
        <h2 id="about-title">lw.MD（简墨）</h2>
        <p className="about-version">版本 {packageInfo.version}</p>
        <p className="about-description">
          简洁轻量的 Windows 本地 Markdown 编辑器
        </p>
        <div className="about-actions">
          <button
            className="primary"
            onClick={() => void openWebsite(repositoryUrl, " GitHub")}
          >
            GitHub 项目主页
          </button>
          <button
            onClick={() => void openWebsite(latestReleaseUrl, "最新版本页面")}
          >
            查看最新版本
          </button>
        </div>
        <p className="about-meta">
          作者：天天代码码天天
          <br />
          MIT License · Copyright © 2026
        </p>
      </section>
    </div>
  );
}
