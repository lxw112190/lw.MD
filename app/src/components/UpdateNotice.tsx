import { ModalDialog } from "./ModalDialog";

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
  return (
    <ModalDialog
      className="update-dialog"
      titleId="update-dialog-title"
      descriptionId="update-dialog-description"
      onDismiss={onDismiss}
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
    </ModalDialog>
  );
}
