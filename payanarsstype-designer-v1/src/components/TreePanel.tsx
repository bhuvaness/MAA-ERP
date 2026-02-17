import React from 'react';
import type { PTNode } from '../types';
import TreeNode from './TreeNode';

interface Props {
  root: PTNode[];
  selectedId: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (dragId: string, dropId: string, pos: 'before' | 'after' | 'inside') => void;
  onAddModule: () => void;
}

const TreePanel: React.FC<Props> = ({ root, selectedId, searchQuery, onSearchChange, onSelect, onToggle, onAddChild, onDelete, onMove, onAddModule }) => {
  return (
    <div className="tree-panel">
      <div className="tree-search-bar">
        <span className="tree-search-icon">🔍</span>
        <input
          className="tree-search-input"
          placeholder="Search nodes, codes, types..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {searchQuery && (
          <button className="tree-search-clear" onClick={() => onSearchChange('')}>×</button>
        )}
      </div>

      <div className="tree-scroll">
        {root.length === 0 ? (
          <div className="tree-empty">
            <div className="tree-empty-icon">🌳</div>
            <div className="tree-empty-text">No modules yet</div>
            <button className="tree-empty-btn" onClick={onAddModule}>+ Add Module</button>
          </div>
        ) : (
          root.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              searchQuery={searchQuery}
              onSelect={onSelect}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default TreePanel;
