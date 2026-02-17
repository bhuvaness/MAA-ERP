import React, { useRef } from 'react';

interface Props {
  stats: { total: number; byLevel: Record<string, number> };
  showJson: boolean;
  canPaste: boolean;
  selectedId: string | null;
  onAddModule: () => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onToggleJson: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
  onClear: () => void;
}

const Toolbar: React.FC<Props> = ({
  stats, showJson, canPaste, selectedId,
  onAddModule, onAddChild, onAddSibling, onDelete, onDuplicate,
  onCopy, onPaste, onUndo, onRedo, onExpandAll, onCollapseAll,
  onToggleJson, onExport, onImport, onClear,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      onImport(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <div className="toolbar-brand">
          <div className="toolbar-logo">P</div>
          <div>
            <div className="toolbar-title">PayanarssType Designer</div>
            <div className="toolbar-subtitle">Visual Tree Editor</div>
          </div>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-stats">
          <span className="stat-badge">{stats.total} nodes</span>
          <span className="stat-badge l1">L1: {stats.byLevel.L1 || 0}</span>
          <span className="stat-badge l2">L2: {stats.byLevel.L2 || 0}</span>
          <span className="stat-badge l3">L3: {stats.byLevel.L3 || 0}</span>
          <span className="stat-badge l4">L4: {stats.byLevel.L4 || 0}</span>
          <span className="stat-badge l5">L5: {stats.byLevel.L5 || 0}</span>
        </div>
      </div>

      <div className="toolbar-center">
        <div className="toolbar-group">
          <button className="tb-btn" onClick={onAddModule} title="Add L1 Module">+ Module</button>
          <button className="tb-btn" onClick={onAddChild} disabled={!selectedId} title="Add child node">+ Child</button>
          <button className="tb-btn" onClick={onAddSibling} disabled={!selectedId} title="Add sibling node">+ Sibling</button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button className="tb-btn icon-btn" onClick={onCopy} disabled={!selectedId} title="Copy">📋</button>
          <button className="tb-btn icon-btn" onClick={onPaste} disabled={!canPaste || !selectedId} title="Paste inside">📌</button>
          <button className="tb-btn icon-btn" onClick={onDuplicate} disabled={!selectedId} title="Duplicate">⧉</button>
          <button className="tb-btn icon-btn danger" onClick={onDelete} disabled={!selectedId} title="Delete">🗑</button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button className="tb-btn icon-btn" onClick={onUndo} title="Undo (Ctrl+Z)">↩</button>
          <button className="tb-btn icon-btn" onClick={onRedo} title="Redo (Ctrl+Y)">↪</button>
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          <button className="tb-btn icon-btn" onClick={onExpandAll} title="Expand all">⊞</button>
          <button className="tb-btn icon-btn" onClick={onCollapseAll} title="Collapse all">⊟</button>
        </div>
      </div>

      <div className="toolbar-right">
        <button className={`tb-btn${showJson ? ' active' : ''}`} onClick={onToggleJson}>
          {'{ }'} JSON
        </button>
        <button className="tb-btn" onClick={onExport}>↓ Export</button>
        <button className="tb-btn" onClick={() => fileRef.current?.click()}>↑ Import</button>
        <button className="tb-btn danger" onClick={onClear}>Clear</button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
      </div>
    </div>
  );
};

export default Toolbar;
