import { t } from "../i18n";
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
        action === "register"
          ? t("Windows 集成已注册")
          : t("Windows 集成已取消"),
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
      onStatus(t("已打开 Windows 默认应用设置"));
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
            <h2 id="association-title">{t("Windows 集成")}</h2>
            <p>{t("让 Markdown 文件更方便地使用 lw.MD 打开。")}</p>
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
              ? t("正在检查")
              : info.current
                ? t("已注册")
                : info.registered
                  ? t("需要修复")
                  : t("未注册")}
          </span>
        </div>
        <ul className="association-features">
          <li>{t("右键菜单显示“使用 lw.MD 打开”")}</li>
          <li>{t("在 Windows“打开方式”中显示 lw.MD")}</li>
          <li>{t("支持 .md 和 .markdown 文件")}</li>
        </ul>
        <p className="association-note">
          {t(
            "注册不会修改当前默认应用。如需默认使用 lw.MD，请在 Windows 设置中自行选择。",
          )}
        </p>
        {info?.registered && !info.current && (
          <div className="association-path-warning">
            <strong>{t("检测到程序位置发生变化")}</strong>
            <span title={info.registeredExecutablePath ?? ""}>
              {info.registeredExecutablePath || t("原注册路径不可用")}
            </span>
          </div>
        )}
        <div className="association-actions">
          <button
            disabled={!info?.current || busy}
            onClick={() => void openDefaultApps()}
          >
            {t("默认应用设置…")}
          </button>
          <span />
          {info?.registered && (
            <button disabled={busy} onClick={() => void update("unregister")}>
              {t("取消注册")}
            </button>
          )}
          {!info?.current && (
            <button
              className="primary"
              disabled={!info || busy}
              onClick={() => void update("register")}
            >
              {busy
                ? t("正在处理…")
                : info?.registered
                  ? t("修复关联")
                  : t("注册 Windows 集成")}
            </button>
          )}
          <button disabled={busy} onClick={onClose}>
            {t("完成")}
          </button>
        </div>
      </section>
    </div>
  );
}
