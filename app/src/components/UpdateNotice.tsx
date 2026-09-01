interface UpdateNoticeProps {
  version: string;
  onOpen(): void;
  onDismiss(): void;
}

export function UpdateNotice({
  version,
  onOpen,
  onDismiss,
}: UpdateNoticeProps) {
  return (
    <section className="update-notice" role="status" aria-live="polite">
      <span>发现新版本 {version}</span>
      <div>
        <button onClick={onOpen}>查看更新</button>
        <button onClick={onDismiss}>稍后</button>
      </div>
    </section>
  );
}
