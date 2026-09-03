import { editorModeLabel, type EditorMode } from "../editor/editorMode";

interface EditorModeSwitchProps {
  mode: EditorMode;
  onChange(mode: EditorMode): void;
}

export function EditorModeSwitch({ mode, onChange }: EditorModeSwitchProps) {
  return (
    <div
      className="editor-mode-switch"
      role="group"
      aria-label="编辑模式"
      title="切换编辑模式（Ctrl+Shift+E）"
    >
      {(["ir", "sv"] as const).map((value) => (
        <button
          key={value}
          className={mode === value ? "active" : ""}
          aria-pressed={mode === value}
          title={`${editorModeLabel[value]}模式`}
          onClick={() => onChange(value)}
        >
          {editorModeLabel[value]}
        </button>
      ))}
    </div>
  );
}
