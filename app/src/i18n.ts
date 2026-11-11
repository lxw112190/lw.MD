import { useSyncExternalStore } from "react";
export type Language = "zh_CN" | "en_US";
let language: Language = "zh_CN";
const listeners = new Set<() => void>();
export function getLanguage() {
  return language;
}
export function setLanguage(value: Language) {
  if (language === value) return;
  language = value;
  document.documentElement.lang = value === "zh_CN" ? "zh-CN" : "en";
  listeners.forEach((listener) => listener());
}
export function useLanguage() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, getLanguage);
}
export const english: Record<string, string> = {
  "无法获取 lw.MD.exe 路径": "Unable to locate lw.MD.exe",
  "lw.MD.exe 路径过长": "The lw.MD.exe path is too long",
  "无法更新 Windows 文件关联": "Unable to update Windows file associations",
  就绪: "Ready",
  未命名: "Untitled",
  即时渲染: "Instant rendering",
  "源码 + 预览": "Source + Preview",
  "当前文档或磁盘文件存在未处理修改，确定放弃吗？":
    "There are unsaved edits or unresolved disk changes. Discard them?",
  新建文档: "New document",
  已打开: "Opened",
  已打开最近文件: "Recent file opened",
  "检测到文件冲突，请先选择处理方式":
    "File conflict detected. Choose how to proceed.",
  已保存: "Saved",
  "重新加载将放弃当前未保存的修改，确定继续吗？":
    "Reloading will discard your unsaved edits. Continue?",
  已从磁盘重新加载: "Reloaded from disk",
  "继续编辑当前内容；保存前请先处理文件冲突":
    "Continue editing; resolve the file conflict before saving.",
  "正在准备 PDF…": "Preparing PDF…",
  "PDF 已导出：{0}": "PDF exported: {0}",
  "已取消导出 PDF": "PDF export cancelled",
  "请先保存当前 Markdown 文件，再插入本地图片。":
    "Save the Markdown document before inserting local images.",
  "正在保存图片…": "Saving images…",
  "已插入 {0} 张图片": "Inserted {0} image(s)",
  "正在选择图片…": "Choosing images…",
  已取消插入图片: "Image insertion cancelled",
  "恢复快照保存失败，将稍后重试": "Recovery snapshot failed; will retry later",
  "已恢复上次未保存的内容，请确认后保存":
    "Unsaved content restored. Review it before saving.",
  已放弃恢复快照: "Recovery snapshot discarded",
  "已从 Windows 打开文件": "File opened from Windows",
  已取消打开拖入文件: "Dropped file cancelled",
  "正在打开拖入文件…": "Opening dropped file…",
  已打开拖入文件: "Dropped file opened",
  "正在导入图片…": "Importing images…",
  "正在准备编辑器…": "Preparing editor…",
  "新建（{0}）": "New ({0})",
  "打开（{0}）": "Open ({0})",
  "保存（{0}）": "Save ({0})",
  新建: "New",
  打开: "Open",
  保存: "Save",
  文件: "File",
  "打开…": "Open…",
  "另存为…": "Save As…",
  "正在导出…": "Exporting…",
  "导出 PDF": "Export PDF",
  "Windows 集成…": "Windows Integration…",
  最近文件: "Recent files",
  请选择: "Select a file",
  编辑: "Edit",
  查找: "Find",
  替换: "Replace",
  视图: "View",
  隐藏大纲: "Hide outline",
  显示大纲: "Show outline",
  主题: "Theme",
  跟随系统: "System",
  浅色: "Light",
  深色: "Dark",
  编辑模式: "Editor mode",
  关于: "About",
  字符: "characters",
  未保存: "Unsaved",
  无法读取图片数据: "Unable to read image data",
  "已在浏览器打开{0}": "Opened {0} in browser",
  关闭关于窗口: "Close About",
  "lw.MD（简墨）": "lw.MD (Jianmo)",
  版本: "Version",
  "简洁轻量的 Windows 本地 Markdown 编辑器":
    "A clean, lightweight local Markdown editor for Windows",
  联系与支持: "Contact & Support",
  作者: "Author",
  天天代码码天天: "天天代码码天天",
  QQ群: "QQ Group",
  "C# 人工智能实践": "C# AI Practice",
  "群号：758616458": "Group: 758616458",
  "如果项目对你有帮助，可以扫码支持后续维护。":
    "If you find this project useful, scan the code to support maintenance.",
  微信赞助二维码: "WeChat donation QR code",
  微信扫码支持维护: "Support via WeChat",
  "GitHub 项目主页": "GitHub repository",
  最新版本页面: "latest release page",
  查看最新版本: "Latest release",
  "切换编辑模式（Ctrl+Shift+E）": "Switch editor mode (Ctrl+Shift+E)",
  "{0}模式": "{0} mode",
  原文件已不存在: "Original file missing",
  文档被外部修改: "Document changed externally",
  "原 Markdown 文件已被删除或移动。你可以将当前内容另存为新文件，或继续编辑。":
    "The original Markdown file was deleted or moved. Save a copy or continue editing.",
  "原 Markdown 文件已在其他程序中修改。你可以重新加载磁盘版本，或保留当前内容继续编辑。":
    "Another program changed this file. Reload the disk version, or keep your current content and continue editing.",
  "当前有未保存的修改，重新加载需要确认后才会放弃这些修改。":
    "You have unsaved edits. Reloading requires confirmation before discarding them.",
  "当前未保存的修改会保留在编辑器中。":
    "Your unsaved edits remain in the editor.",
  重新加载磁盘版本: "Reload from disk",
  另存为新文件: "Save a copy",
  继续编辑: "Continue editing",
  未找到匹配内容: "No matches",
  请输入要查找的内容: "Enter text to find",
  "第 {0} 项，共 {1} 项": "Match {0} of {1}",
  "找到 {0} 项，当前结果不在可见文本中":
    "Found {0} matches; current result is outside visible text",
  "已替换 1 处": "Replaced 1 match",
  "已替换 {0} 处": "Replaced {0} matches",
  查找和替换: "Find and replace",
  查找内容: "Find text",
  "上一个（Shift+Enter）": "Previous (Shift+Enter)",
  上一个匹配项: "Previous match",
  "下一个（Enter）": "Next (Enter)",
  下一个匹配项: "Next match",
  "关闭（Esc）": "Close (Esc)",
  关闭查找: "Close find",
  替换为: "Replace with",
  替换内容: "Replacement text",
  全部替换: "Replace all",
  收起替换: "Hide replace",
  展开替换: "Show replace",
  区分大小写: "Match case",
  插入本地图片: "Insert local image",
  松开鼠标: "Drop here",
  "打开 Markdown 或插入图片": "Open Markdown or insert images",
  文档大纲: "Document outline",
  大纲: "Outline",
  "{0}（第 {1} 行）": "{0} (line {1})",
  "使用标题来组织文章。": "Use headings to organize your document.",
  调整大纲宽度: "Resize outline",
  发现未保存的恢复快照: "Unsaved recovery snapshot found",
  "检测到上次意外中断前保存的内容。恢复后会作为未保存文档打开，":
    "Content from the previous interrupted session was found. It will open as an unsaved document and ",
  不会自动覆盖原文件: "will not overwrite the original file",
  文档: "Document",
  快照时间: "Snapshot time",
  原文件: "Original file",
  放弃快照: "Discard snapshot",
  恢复内容: "Restore content",
  未知: "Unknown",
  发现新版本: "Update available",
  "新版本已发布，点击“查看更新”将在浏览器中打开发布页面，查看更新内容并下载。":
    "A new version is available. Select View update to open the release notes and download page in your browser.",
  稍后: "Later",
  查看更新: "View update",
  "Windows 集成已注册": "Windows integration registered",
  "Windows 集成已取消": "Windows integration removed",
  "已打开 Windows 默认应用设置": "Windows Default apps settings opened",
  "Windows 集成": "Windows Integration",
  "让 Markdown 文件更方便地使用 lw.MD 打开。":
    "Open Markdown files with lw.MD from Windows.",
  正在检查: "Checking",
  已注册: "Registered",
  需要修复: "Repair required",
  未注册: "Not registered",
  "右键菜单显示“使用 lw.MD 打开”": "Add Open with lw.MD to the context menu",
  "在 Windows“打开方式”中显示 lw.MD": "List lw.MD in Windows Open with",
  "支持 .md 和 .markdown 文件": "Supports .md and .markdown files",
  "注册不会修改当前默认应用。如需默认使用 lw.MD，请在 Windows 设置中自行选择。":
    "Registration does not change your default app. To use lw.MD by default, select it in Windows Settings.",
  检测到程序位置发生变化: "Application location changed",
  原注册路径不可用: "Previous registered path unavailable",
  "默认应用设置…": "Default apps…",
  取消注册: "Unregister",
  "正在处理…": "Working…",
  修复关联: "Repair association",
  "注册 Windows 集成": "Register integration",
  完成: "Done",
  "请在 lw.MD 桌面应用中使用文件操作。":
    "File operations require the lw.MD desktop app.",
  "桌面操作等待超时，请重试。":
    "Desktop operation timed out. Please try again.",
  "无法发送桌面操作请求。": "Unable to send desktop request.",
  操作失败: "Operation failed",
  未知图片: "Unknown image",
  "\n另有 {0} 张图片": "\nPlus {0} more image(s)",
  "图片无法载入，已取消导出 PDF：\n{0}{1}":
    "Images could not be loaded. PDF export cancelled:\n{0}{1}",
};
export function t(source: string, ...values: unknown[]) {
  const text = language === "en_US" ? (english[source] ?? source) : source;
  return text.replace(/\{(\d+)\}/g, (match, index) =>
    Number(index) < values.length ? String(values[Number(index)]) : match,
  );
}
