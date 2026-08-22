import type { RecoverySnapshot } from "../desktop/desktop";

interface RecoveryDialogProps {
  snapshot: RecoverySnapshot;
  onDiscard(): void | Promise<void>;
  onRestore(): void | Promise<void>;
}

export function RecoveryDialog({
  snapshot,
  onDiscard,
  onRestore,
}: RecoveryDialogProps) {
  return (
    <div className="recovery-backdrop">
      <section
        className="recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
      >
        <div className="recovery-badge" aria-hidden="true">
          ↺
        </div>
        <div>
          <h2 id="recovery-title">发现未保存的恢复快照</h2>
          <p>
            检测到上次意外中断前保存的内容。恢复后会作为未保存文档打开，
            <strong>不会自动覆盖原文件</strong>。
          </p>
        </div>
        <dl className="recovery-details">
          <div>
            <dt>文档</dt>
            <dd>{snapshot.name}</dd>
          </div>
          <div>
            <dt>快照时间</dt>
            <dd>{formatRecoveryTime(snapshot.savedAt)}</dd>
          </div>
          {snapshot.path && (
            <div>
              <dt>原文件</dt>
              <dd title={snapshot.path}>{snapshot.path}</dd>
            </div>
          )}
        </dl>
        <div className="recovery-actions">
          <button onClick={() => void onDiscard()}>放弃快照</button>
          <button className="primary" onClick={() => void onRestore()}>
            恢复内容
          </button>
        </div>
      </section>
    </div>
  );
}

function formatRecoveryTime(value: number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未知" : date.toLocaleString("zh-CN");
}
