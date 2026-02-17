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
        {/* ── Common Fields ── */}
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
              <label className="props-label">PayanarssType</label>
              <select className="props-input" value={node.typeCategory} onChange={(e) => update('typeCategory', e.target.value)}>
                {TYPE_CATEGORIES.map(tc => <option key={tc} value={tc}>{tc}</option>)}
              </select>
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
          <div className="props-row">
            <div className="props-field">
              <label className="props-label">Icon</label>
              <div className="props-icon-grid">
                {NODE_ICONS.map(ic => (
                  <button key={ic} className={`props-icon-btn${node.icon === ic ? ' active' : ''}`} onClick={() => update('icon', ic)}>{ic}</button>
                ))}
              </div>
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

        {/* ── L4 Entity Fields ── */}
        {node.level === 'L4' && (
          <div className="props-section">
            <div className="props-section-title">Entity / Table</div>
            <div className="props-row">
              <div className="props-field">
                <label className="props-label">Table Name</label>
                <input className="props-input mono" value={node.tableName || ''} onChange={(e) => update('tableName', e.target.value.toUpperCase())} placeholder="COMPANY" />
              </div>
              <div className="props-field">
                <label className="props-label">Entity Type</label>
                <select className="props-input" value={node.entityType || ''} onChange={(e) => update('entityType', e.target.value)}>
                  <option value="">Select...</option>
                  {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── L5 Field Fields ── */}
        {node.level === 'L5' && (
          <div className="props-section">
            <div className="props-section-title">Field / Column</div>
            <div className="props-row">
              <div className="props-field">
                <label className="props-label">Column Name</label>
                <input className="props-input mono" value={node.columnName || ''} onChange={(e) => update('columnName', e.target.value.toLowerCase())} placeholder="company_name_en" />
              </div>
              <div className="props-field">
                <label className="props-label">Data Type</label>
                <select className="props-input" value={node.dataType || ''} onChange={(e) => update('dataType', e.target.value)}>
                  <option value="">Select...</option>
                  {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="props-row">
              <div className="props-field">
                <label className="props-label">Max Length</label>
                <input className="props-input" type="number" value={node.maxLength || ''} onChange={(e) => update('maxLength', parseInt(e.target.value) || undefined)} placeholder="200" />
              </div>
              <div className="props-field">
                <label className="props-label">Default Value</label>
                <input className="props-input" value={node.defaultValue || ''} onChange={(e) => update('defaultValue', e.target.value)} placeholder="NULL" />
              </div>
            </div>
            <div className="props-field">
              <label className="props-checkbox-row">
                <input type="checkbox" checked={node.required || false} onChange={(e) => update('required', e.target.checked)} />
                <span>Required field</span>
              </label>
            </div>
          </div>
        )}

        {/* ── Children Summary ── */}
        {node.children.length > 0 && (
          <div className="props-section">
            <div className="props-section-title">Children ({node.children.length})</div>
            <div className="props-children-list">
              {node.children.map(c => (
                <div key={c.id} className="props-child-row">
                  <span style={{ color: c.color }}>{c.icon}</span>
                  <span className="props-child-name">{c.name}</span>
                  <span className="props-child-level" style={{ color: LEVEL_COLORS[c.level] }}>{c.level}</span>
                  <span className="props-child-type">{c.typeCategory.replace('Type', '')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;
