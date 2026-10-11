import type { ExternalFileState } from "../document/externalFileState";
import { ModalDialog } from "./ModalDialog";

interface Props {
  state: ExternalFileState;
  dirty: boolean;
  onReload: () => void;
  onSaveAs: () => void;
  onContinue: () => void;
}

export function FileConflictDialog({
  state,
  dirty,
  onReload,
  onSaveAs,
  onContinue,
}: Props) {
  if (state.kind === "none") return null;
  return (
    <ModalDialog
      className="modal-dialog"
      titleId="file-conflict-title"
      descriptionId="file-conflict-description"
      onDismiss={onContinue}
    >
      <h2 id="file-conflict-title">
        {state.kind === "missing" ? "原文件已不存在" : "文档被外部修改"}
      </h2>
      <p id="file-conflict-description">
        {state.kind === "missing"
          ? "原 Markdown 文件已被删除或移动。你可以将当前内容另存为新文件，或继续编辑。"
          : "原 Markdown 文件已在其他程序中修改。你可以重新加载磁盘版本，或保留当前内容继续编辑。"}
        {dirty &&
          (state.kind === "changed"
            ? "当前有未保存的修改，重新加载需要确认后才会放弃这些修改。"
            : "当前未保存的修改会保留在编辑器中。")}
      </p>
      <div className="modal-actions">
        {state.kind === "changed" && (
          <button onClick={onReload}>重新加载磁盘版本</button>
        )}
        <button onClick={onSaveAs}>另存为新文件</button>
        <button data-dialog-initial-focus onClick={onContinue}>
          继续编辑
        </button>
      </div>
    </ModalDialog>
  );
}
