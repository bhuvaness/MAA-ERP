import React from 'react';
import type { PTNode } from '../types';
import { LEVEL_LABELS, LEVEL_COLORS, CHILD_LEVEL } from '../types';
import { TYPE_CATEGORIES, DATA_TYPES, ENTITY_TYPES, NODE_ICONS, NODE_COLORS } from '../data/categories';

interface Props {
  node: PTNode | null;
  onUpdate: (id: string, updates: Partial<PTNode>) => void;
  onAddChild: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const PropertiesPanel: React.FC<Props> = ({ node, onUpdate, onAddChild, onDuplicate, onDelete }) => {
  if (!node) {
    return (
      <div className="props-panel">
        <div className="props-empty">
          <div className="props-empty-icon">👈</div>
          <div className="props-empty-title">Select a node</div>
          <div className="props-empty-text">Click on any node in the tree to view and edit its properties</div>
        </div>
      </div>
    );
  }

  const update = (key: string, value: any) => {
    onUpdate(node.id, { [key]: value });
  };

  const childLevel = CHILD_LEVEL[node.level];
  const levelColor = LEVEL_COLORS[node.level];
  const hasRawData = node.rawId || node.rawPayanarssTypeId;

  return (
    <div className="props-panel">
      {/* Header */}
      <div className="props-header">
        <div className="props-header-top">
          <span className="props-node-icon" style={{ background: `${levelColor}18`, color: levelColor }}>{node.icon}</span>
          <div className="props-header-info">
            <h3 className="props-node-name">{node.name || 'Unnamed'}</h3>
            <div className="props-node-meta">
              <span className="props-level-badge" style={{ background: `${levelColor}20`, color: levelColor }}>{node.level} — {LEVEL_LABELS[node.level]}</span>
              {node.code && <span className="props-code-badge">{node.code}</span>}
              {node.rawAttributes && node.rawAttributes.length > 0 && (
                <span className="props-attr-badge">{node.rawAttributes.length} attrs</span>
              )}
            </div>
          </div>
        </div>
        <div className="props-header-actions">
          {childLevel && (
            <button className="props-action-btn" onClick={() => onAddChild(node.id)}>+ Add {LEVEL_LABELS[childLevel]}</button>
          )}
          <button className="props-action-btn" onClick={() => onDuplicate(node.id)}>⧉ Duplicate</button>
          <button className="props-action-btn danger" onClick={() => onDelete(node.id)}>🗑 Delete</button>
        </div>
      </div>

      {/* Properties form */}
      <div className="props-scroll">

        {/* ── Raw PayanarssType Info ── */}
        {hasRawData && (
          <div className="props-section">
            <div className="props-section-title">PayanarssType Identity</div>
            {node.rawId && (
              <div className="props-field">
                <label className="props-label">Id</label>
                <div className="props-readonly mono">{node.rawId}</div>
              </div>
            )}
            {node.rawParentId && node.rawParentId !== node.rawId && (
              <div className="props-field">
                <label className="props-label">Parent Id</label>
                <div className="props-readonly mono">{node.rawParentId}</div>
              </div>
            )}
            {node.rawPayanarssTypeId && node.rawPayanarssTypeId !== node.rawId && (
              <div className="props-field">
                <label className="props-label">PayanarssTypeId</label>
                <div className="props-readonly mono">{node.rawPayanarssTypeId}</div>
              </div>
            )}
            {node.rawAttributes && node.rawAttributes.length > 0 && (
              <div className="props-field">
                <label className="props-label">Attributes ({node.rawAttributes.length})</label>
                <div className="props-attr-list">
                  {node.rawAttributes.map((attr, i) => (
                    <span key={i} className="props-attr-tag">{typeof attr === 'number' ? attr.toExponential() : String(attr)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── General ── */}
        <div className="props-section">
          <div className="props-section-title">General</div>
          <div className="props-field">
            <label className="props-label">Name</label>
            <input className="props-input" value={node.name} onChange={(e) => update('name', e.target.value)} placeholder="Node name" />
          </div>
          <div className="props-row">
            <div className="props-field">
              <label className="props-label">Code</label>
              <input className="props-input" value={node.code} onChange={(e) => update('code', e.target.value)} placeholder="BUC-100" />
            </div>
            <div className="props-field">
              <label className="props-label">Type Category</label>
              <input className="props-input" value={node.typeCategory} onChange={(e) => update('typeCategory', e.target.value)} placeholder="Node" />
            </div>
          </div>
          <div className="props-field">
            <label className="props-label">Description</label>
            <textarea className="props-textarea" value={node.description} onChange={(e) => update('description', e.target.value)} placeholder="Describe this node..." rows={3} />
          </div>
        </div>

        {/* ── Appearance ── */}
        <div className="props-section">
          <div className="props-section-title">Appearance</div>
          <div className="props-field">
            <label className="props-label">Icon</label>
            <div className="props-icon-grid">
              {NODE_ICONS.map(ic => (
                <button key={ic} className={`props-icon-btn${node.icon === ic ? ' active' : ''}`} onClick={() => update('icon', ic)}>{ic}</button>
              ))}
            </div>
          </div>
          <div className="props-field">
            <label className="props-label">Color</label>
            <div className="props-color-grid">
              {NODE_COLORS.map(c => (
                <button key={c} className={`props-color-btn${node.color === c ? ' active' : ''}`} style={{ background: c }} onClick={() => update('color', c)} />
              ))}
            </div>
          </div>
        </div>

        {/* ── Children Summary ── */}
        {node.children.length > 0 && (
          <div className="props-section">
            <div className="props-section-title">Children ({node.children.length})</div>
            <div className="props-children-list">
              {node.children.slice(0, 30).map(c => (
                <div key={c.id} className="props-child-row">
                  <span style={{ color: c.color }}>{c.icon}</span>
                  <span className="props-child-name">{c.name}</span>
                  {c.rawAttributes && c.rawAttributes.length > 0 && (
                    <span className="props-child-attrs">{c.rawAttributes.length}a</span>
                  )}
                  <span className="props-child-level" style={{ color: LEVEL_COLORS[c.level] }}>{c.level}</span>
                  <span className="props-child-type">{c.typeCategory}</span>
                </div>
              ))}
              {node.children.length > 30 && (
                <div className="props-child-overflow">+{node.children.length - 30} more children</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;
