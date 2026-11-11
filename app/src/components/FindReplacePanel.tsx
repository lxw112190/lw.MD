import { t } from "../i18n";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { MarkdownEditorHandle } from "./MarkdownEditor";
import {
  findTextMatches,
  replaceAllText,
  replaceTextMatch,
} from "../document/findReplace";

interface FindReplacePanelProps {
  content: string;
  editor: RefObject<MarkdownEditorHandle | null>;
  replaceVisible: boolean;
  onChange(content: string): void;
  onClose(): void;
  onReplaceVisibleChange(visible: boolean): void;
  onStatus(message: string): void;
}

export function FindReplacePanel({
  content,
  editor,
  replaceVisible,
  onChange,
  onClose,
  onReplaceVisibleChange,
  onStatus,
}: FindReplacePanelProps) {
  const [findQuery, setFindQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [activeMatch, setActiveMatch] = useState(0);
  const findInput = useRef<HTMLInputElement>(null);
  const matches = useMemo(
    () => findTextMatches(content, findQuery, matchCase),
    [content, findQuery, matchCase],
  );
  const currentMatchIndex = matches.length
    ? Math.min(activeMatch, matches.length - 1)
    : 0;
  const close = () => {
    onClose();
    editor.current?.focus();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      findInput.current?.focus();
      findInput.current?.select();
    });
    return () => window.clearTimeout(timer);
  }, [replaceVisible]);

  useEffect(() => {
    if (!findQuery) return;
    const timer = window.setTimeout(() => {
      editor.current?.revealText(findQuery, 0, matchCase);
    });
    return () => window.clearTimeout(timer);
  }, [editor, findQuery, matchCase]);

  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      editor.current?.focus();
    };
    window.addEventListener("keydown", closeWithEscape, true);
    return () => window.removeEventListener("keydown", closeWithEscape, true);
  }, [editor, onClose]);

  const revealMatch = (requestedIndex: number) => {
    if (matches.length === 0) {
      setActiveMatch(0);
      onStatus(findQuery ? t("未找到匹配内容") : t("请输入要查找的内容"));
      return;
    }
    const nextIndex = (requestedIndex + matches.length) % matches.length;
    setActiveMatch(nextIndex);
    const visible = editor.current?.revealText(findQuery, nextIndex, matchCase);
    onStatus(
      visible
        ? t("第 {0} 项，共 {1} 项", nextIndex + 1, matches.length)
        : t("找到 {0} 项，当前结果不在可见文本中", matches.length),
    );
  };

  const replaceCurrent = () => {
    const match = matches[currentMatchIndex];
    if (!match) {
      onStatus(findQuery ? t("未找到匹配内容") : t("请输入要查找的内容"));
      return;
    }
    const nextContent = replaceTextMatch(content, match, replacement);
    onChange(nextContent);
    const nextMatches = findTextMatches(nextContent, findQuery, matchCase);
    const nextIndex = Math.min(
      currentMatchIndex,
      Math.max(0, nextMatches.length - 1),
    );
    setActiveMatch(nextIndex);
    onStatus(t("已替换 1 处"));
    window.setTimeout(() => {
      if (nextMatches.length > 0) {
        editor.current?.revealText(findQuery, nextIndex, matchCase);
      }
    }, 50);
  };

  const replaceEveryMatch = () => {
    const result = replaceAllText(content, findQuery, replacement, matchCase);
    if (result.count === 0) {
      onStatus(findQuery ? t("未找到匹配内容") : t("请输入要查找的内容"));
      return;
    }
    onChange(result.content);
    setActiveMatch(0);
    onStatus(t("已替换 {0} 处", result.count));
  };

  return (
    <section className="find-panel" role="search" aria-label={t("查找和替换")}>
      <div className="find-row">
        <input
          ref={findInput}
          value={findQuery}
          placeholder={t("查找")}
          aria-label={t("查找内容")}
          onChange={(event) => {
            setFindQuery(event.target.value);
            setActiveMatch(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              revealMatch(currentMatchIndex + (event.shiftKey ? -1 : 1));
            }
          }}
        />
        <span className="find-count" aria-live="polite">
          {matches.length ? currentMatchIndex + 1 : 0}/{matches.length}
        </span>
        <button
          className="find-icon-button"
          title={t("上一个（Shift+Enter）")}
          aria-label={t("上一个匹配项")}
          onClick={() => revealMatch(currentMatchIndex - 1)}
        >
          ↑
        </button>
        <button
          className="find-icon-button"
          title={t("下一个（Enter）")}
          aria-label={t("下一个匹配项")}
          onClick={() => revealMatch(currentMatchIndex + 1)}
        >
          ↓
        </button>
        <button
          className="find-icon-button find-close"
          title={t("关闭（Esc）")}
          aria-label={t("关闭查找")}
          onClick={close}
        >
          ×
        </button>
      </div>
      {replaceVisible && (
        <div className="find-row replace-row">
          <input
            value={replacement}
            placeholder={t("替换为")}
            aria-label={t("替换内容")}
            onChange={(event) => setReplacement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                replaceCurrent();
              }
            }}
          />
          <button onClick={replaceCurrent}>{t("替换")}</button>
          <button onClick={replaceEveryMatch}>{t("全部替换")}</button>
        </div>
      )}
      <div className="find-options">
        <button
          className="find-replace-toggle"
          onClick={() => onReplaceVisibleChange(!replaceVisible)}
        >
          {replaceVisible ? t("收起替换") : t("展开替换")}
        </button>
        <label>
          <input
            type="checkbox"
            checked={matchCase}
            onChange={(event) => setMatchCase(event.target.checked)}
          />
          {t("区分大小写")}
        </label>
      </div>
    </section>
  );
}
