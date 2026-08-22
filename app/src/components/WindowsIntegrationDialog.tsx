import { useEffect, useState } from "react";
import { desktop, type FileAssociationStatus } from "../desktop/desktop";
import { errorMessage } from "../desktop/errors";

interface WindowsIntegrationDialogProps {
  onClose(): void;
  onStatus(message: string): void;
}

export function WindowsIntegrationDialog({
  onClose,
  onStatus,
}: WindowsIntegrationDialogProps) {
  const [info, setInfo] = useState<FileAssociationStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void desktop.association
      .status()
      .then((status) => {
        if (!cancelled) setInfo(status);
      })
      .catch((error) => {
        if (!cancelled) onStatus(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [onStatus]);

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeWithEscape);
    return () => window.removeEventListener("keydown", closeWithEscape);
  }, [onClose]);

  const update = async (action: "register" | "unregister") => {
    if (busy) return;
    setBusy(true);
    try {
      await desktop.association[action]();
      setInfo(await desktop.association.status());
      onStatus(
        action === "register" ? "Windows 集成已注册" : "Windows 集成已取消",
      );
    } catch (error) {
      onStatus(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const openDefaultApps = async () => {
    try {
      await desktop.association.openDefaultApps();
      onStatus("已打开 Windows 默认应用设置");
    } catch (error) {
      onStatus(errorMessage(error));
    }
  };

  return (
    <div
      className="association-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="association-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="association-title"
      >
        <div className="association-heading">
          <div>
            <h2 id="association-title">Windows 集成</h2>
            <p>让 Markdown 文件更方便地使用 lw.MD 打开。</p>
          </div>
          <span
            className={`association-status ${
              info?.current
                ? "is-current"
                : info?.registered
                  ? "needs-repair"
                  : "is-unregistered"
            }`}
          >
            {!info
              ? "正在检查"
              : info.current
                ? "已注册"
                : info.registered
                  ? "需要修复"
                  : "未注册"}
          </span>
        </div>
        <ul className="association-features">
          <li>右键菜单显示“使用 lw.MD 打开”</li>
          <li>在 Windows“打开方式”中显示 lw.MD</li>
          <li>支持 .md 和 .markdown 文件</li>
        </ul>
        <p className="association-note">
          注册不会修改当前默认应用。如需默认使用 lw.MD，请在 Windows
          设置中自行选择。
        </p>
        {info?.registered && !info.current && (
          <div className="association-path-warning">
            <strong>检测到程序位置发生变化</strong>
            <span title={info.registeredExecutablePath ?? ""}>
              {info.registeredExecutablePath || "原注册路径不可用"}
            </span>
          </div>
        )}
        <div className="association-actions">
          <button
            disabled={!info?.current || busy}
            onClick={() => void openDefaultApps()}
          >
            默认应用设置…
          </button>
          <span />
          {info?.registered && (
            <button disabled={busy} onClick={() => void update("unregister")}>
              取消注册
            </button>
          )}
          {!info?.current && (
            <button
              className="primary"
              disabled={!info || busy}
              onClick={() => void update("register")}
            >
              {busy
                ? "正在处理…"
                : info?.registered
                  ? "修复关联"
                  : "注册 Windows 集成"}
            </button>
          )}
          <button disabled={busy} onClick={onClose}>
            完成
          </button>
        </div>
      </section>
    </div>
  );
}
