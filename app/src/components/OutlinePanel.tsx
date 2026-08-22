import type { OutlineItem } from "../markdown/outline";
interface Props {
  items: OutlineItem[];
  onSelect(item: OutlineItem, occurrence: number): void;
}
export function OutlinePanel({ items, onSelect }: Props) {
  return (
    <aside className="outline-panel" aria-label="文档大纲">
      <div className="outline-title">大纲</div>
      {items.length ? (
        <nav>
          {items.map((item, index) => (
            <button
              className="outline-item"
              key={`${item.line}-${item.text}`}
              style={{ paddingLeft: `${12 + (item.level - 1) * 13}px` }}
              title={`第 ${item.line} 行`}
              onClick={() => onSelect(item, index)}
            >
              {item.text}
            </button>
          ))}
        </nav>
      ) : (
        <p>使用标题来组织文章。</p>
      )}
    </aside>
  );
}
