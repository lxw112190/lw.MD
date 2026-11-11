import { t } from "../i18n";
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
      aria-label={t("编辑模式")}
      title={t("切换编辑模式（Ctrl+Shift+E）")}
    >
      {(["ir", "sv"] as const).map((value) => (
        <button
          key={value}
          className={mode === value ? "active" : ""}
          aria-pressed={mode === value}
          title={t("{0}模式", t(editorModeLabel[value]))}
          onClick={() => onChange(value)}
        >
          {t(editorModeLabel[value])}
        </button>
      ))}
    </div>
  );
}
