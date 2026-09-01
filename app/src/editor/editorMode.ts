export type EditorMode = "ir" | "sv";

export const editorModeLabel: Record<EditorMode, string> = {
  ir: "即时渲染",
  sv: "源码 + 预览",
};
