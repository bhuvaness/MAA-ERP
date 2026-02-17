import React from 'react';
import type { CmdGroup } from '../hooks/useCommandPopup';

interface Props {
  isOpen: boolean;
  query: string;
  groups: CmdGroup[];
  filteredCount: number;
  focusIdx: number;
  onSelect: (globalIdx: number) => void;
  onHover: (globalIdx: number) => void;
  highlightMatch: (text: string, query: string) => string;
  popupRef: React.RefObject<HTMLDivElement | null>;
}

const CommandPopup: React.FC<Props> = ({ isOpen, query, groups, filteredCount, focusIdx, onSelect, onHover, highlightMatch, popupRef }) => {
  if (!isOpen) return null;
  let globalIdx = 0;

  return (
    <div className="cmd-popup open" ref={popupRef}>
      <div className="cmd-header">
        <div className="cmd-header-title">⚡ Quick Actions</div>
        <div className="cmd-header-hint">↑↓ navigate · Enter select · Esc close</div>
      </div>
      <div className="cmd-results">
        {groups.length === 0 ? (
          <div className="cmd-empty">
            <span className="cmd-empty-icon">🔍</span>
            No matches for "{query}"<br />
            <small style={{ color: 'var(--text-4)' }}>Try a module name, action, or report</small>
          </div>
        ) : (
          groups.map(group => {
            const startIdx = globalIdx;
            return (
              <div className="cmd-section" key={group.cat}>
                <div className="cmd-section-title">{group.icon} {group.label} <span className="sec-count">{group.items.length}</span></div>
                {group.items.map((item, i) => {
                  const idx = startIdx + i;
                  globalIdx++;
                  return (
                    <div key={`${item.cat}-${item.action}-${i}`} className={`cmd-item${idx === focusIdx ? ' focused' : ''}`} data-idx={idx} onClick={() => onSelect(idx)} onMouseEnter={() => onHover(idx)}>
                      <div className="cmd-item-icon" style={{ background: item.bg, color: item.color }}>{item.icon}</div>
                      <div className="cmd-item-info">
                        <h5 dangerouslySetInnerHTML={{ __html: highlightMatch(item.name, query) }} />
                        <span>{item.desc}</span>
                      </div>
                      <span className="cmd-item-badge" style={{ background: item.bg, color: item.color }}>{item.cat}</span>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CommandPopup;
