import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface UpdateNoticeProps {
  currentVersion: string;
  version: string;
  onOpen(): void;
  onDismiss(): void;
}

export function UpdateNotice({
  currentVersion,
  version,
  onOpen,
  onDismiss,
}: UpdateNoticeProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  // Keep the modal out of the editor grid so an update cannot consume its row.
  return createPortal(
    <dialog
      ref={dialog}
      className="update-dialog"
      aria-labelledby="update-dialog-title"
      aria-describedby="update-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== "Tab") return;
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(
          "button:not(:disabled)",
        );
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <h2 id="update-dialog-title">发现新版本</h2>
      <p className="update-dialog-version">
        v{currentVersion} → <strong>v{version}</strong>
      </p>
      <p id="update-dialog-description">
        新版本已发布，点击“查看更新”将在浏览器中打开发布页面，查看更新内容并下载。
      </p>
      <div className="update-dialog-actions">
        <button onClick={onDismiss}>稍后</button>
        <button className="primary" onClick={onOpen}>
          查看更新
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
