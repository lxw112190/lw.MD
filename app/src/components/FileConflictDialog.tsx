import type { ExternalFileState } from "../document/externalFileState";

interface Props {
  state: ExternalFileState;
  onReload: () => void;
  onSaveAs: () => void;
  onContinue: () => void;
}

export function FileConflictDialog({
  state,
  onReload,
  onSaveAs,
  onContinue,
}: Props) {
  if (state.kind === "none") return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-dialog" role="dialog" aria-modal="true">
        <h2>文件已发生变化</h2>
        <p>
          {state.kind === "missing"
            ? "原文件已不存在，不能覆盖保存。"
            : "原文件已被其他程序修改，为避免覆盖他人的内容，请选择后续操作。"}
        </p>
        <div className="modal-actions">
          {state.kind === "changed" && (
            <button onClick={onReload}>重新加载磁盘版本</button>
          )}
          <button onClick={onSaveAs}>另存为新文件</button>
          <button onClick={onContinue}>继续编辑</button>
        </div>
      </section>
    </div>
  );
}
