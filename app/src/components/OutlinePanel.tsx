import { useRef } from "react";
import type { OutlineItem } from "../markdown/outline";

export const defaultOutlineWidth = 280;
export const minOutlineWidth = 180;
export const maxOutlineWidth = 420;

interface Props {
  items: OutlineItem[];
  width: number;
  onSelect(item: OutlineItem, occurrence: number): void;
  onResize(width: number): void;
  onResizeEnd(width: number): void;
}

interface OutlineDrag {
  pointerId: number;
  startX: number;
  startWidth: number;
  width: number;
}

function clampOutlineWidth(width: number) {
  return Math.round(
    Math.min(
      Math.max(minOutlineWidth, window.innerWidth - 360),
      maxOutlineWidth,
      Math.max(minOutlineWidth, width),
    ),
  );
}

export function OutlinePanel({
  items,
  width,
  onSelect,
  onResize,
  onResizeEnd,
}: Props) {
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<OutlineDrag | null>(null);

  const finishDrag = (pointerId: number) => {
    if (drag.current?.pointerId !== pointerId) return;
    const finalWidth = drag.current.width;
    drag.current = null;
    onResizeEnd(finalWidth);
  };

  return (
    <aside className="outline-panel" aria-label="文档大纲" ref={panel}>
      <div className="outline-scroll">
        <div className="outline-title">大纲</div>
        {items.length ? (
          <nav>
            {items.map((item, index) => (
              <button
                className="outline-item"
                key={`${item.line}-${item.text}`}
                style={{ paddingLeft: `${12 + (item.level - 1) * 13}px` }}
                title={`${item.text}（第 ${item.line} 行）`}
                onClick={() => onSelect(item, index)}
              >
                {item.text}
              </button>
            ))}
          </nav>
        ) : (
          <p>使用标题来组织文章。</p>
        )}
      </div>
      <div
        className="outline-resize-handle"
        role="separator"
        aria-label="调整大纲宽度"
        aria-orientation="vertical"
        aria-valuemin={minOutlineWidth}
        aria-valuemax={maxOutlineWidth}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          const startWidth = Math.round(
            panel.current?.getBoundingClientRect().width ?? width,
          );
          drag.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth,
            width: startWidth,
          };
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          const current = drag.current;
          if (current?.pointerId !== event.pointerId) return;
          const next = clampOutlineWidth(
            current.startWidth + event.clientX - current.startX,
          );
          current.width = next;
          onResize(next);
          event.preventDefault();
        }}
        onPointerUp={(event) => finishDrag(event.pointerId)}
        onPointerCancel={(event) => finishDrag(event.pointerId)}
        onLostPointerCapture={(event) => finishDrag(event.pointerId)}
        onKeyDown={(event) => {
          const current = panel.current?.getBoundingClientRect().width ?? width;
          let next: number;
          switch (event.key) {
            case "ArrowLeft":
              next = current - 16;
              break;
            case "ArrowRight":
              next = current + 16;
              break;
            case "Home":
              next = minOutlineWidth;
              break;
            case "End":
              next = maxOutlineWidth;
              break;
            default:
              return;
          }
          event.preventDefault();
          next = clampOutlineWidth(next);
          onResize(next);
          onResizeEnd(next);
        }}
      />
    </aside>
  );
}
