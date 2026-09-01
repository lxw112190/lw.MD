import type { ExternalFileState } from "../document/externalFileState";

interface Props {
  state: ExternalFileState;
  dirty: boolean;
  onReload: () => void;
  onSaveAs: () => void;
  onContinue: () => void;
}

export function ExternalFileNotice({
  state,
  dirty,
  onReload,
  onSaveAs,
  onContinue,
}: Props) {
  if (state.kind === "none") return null;
  const missing = state.kind === "missing";
  return (
    <section className="external-file-notice" role="alert">
      <span>
        {missing
          ? "原 Markdown 文件已被删除或移动。"
          : "原 Markdown 文件已在其他程序中修改。"}
      </span>
      <div>
        {!missing && <button onClick={onReload}>重新加载</button>}
        {(dirty || missing) && <button onClick={onSaveAs}>另存为…</button>}
        <button onClick={onContinue}>继续编辑</button>
      </div>
    </section>
  );
}
