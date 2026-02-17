import React, { useState, useCallback } from 'react';
import type { PTNode } from '../types';
import { LEVEL_LABELS, CHILD_LEVEL } from '../types';

interface Props {
  node: PTNode;
  depth: number;
  selectedId: string | null;
  searchQuery: string;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (dragId: string, dropId: string, pos: 'before' | 'after' | 'inside') => void;
}

const TreeNode: React.FC<Props> = ({ node, depth, selectedId, searchQuery, onSelect, onToggle, onAddChild, onDelete, onMove }) => {
  const [dragOver, setDragOver] = useState<'before' | 'after' | 'inside' | null>(null);
  const isSelected = node.id === selectedId;
  const hasChildren = node.children.length > 0;
  const canHaveChildren = CHILD_LEVEL[node.level] !== null;

  // Search filter
  const matchesSearch = !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    node.typeCategory.toLowerCase().includes(searchQuery.toLowerCase());

  const childMatchesSearch = (n: PTNode): boolean => {
    if (n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.typeCategory.toLowerCase().includes(searchQuery.toLowerCase())) return true;
    return n.children.some(c => childMatchesSearch(c));
  };

  const anyChildMatches = searchQuery ? node.children.some(c => childMatchesSearch(c)) : true;
  if (searchQuery && !matchesSearch && !anyChildMatches) return null;

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
  }, [node.id]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const h = rect.height;
    if (y < h * 0.25) setDragOver('before');
    else if (y > h * 0.75) setDragOver('after');
    else setDragOver(canHaveChildren ? 'inside' : 'after');
  }, [canHaveChildren]);

  const handleDragLeave = useCallback(() => setDragOver(null), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dragId = e.dataTransfer.getData('text/plain');
    if (dragId && dragOver) onMove(dragId, node.id, dragOver);
    setDragOver(null);
  }, [node.id, dragOver, onMove]);

  return (
    <div className="tree-node-wrapper">
      {dragOver === 'before' && <div className="drop-indicator drop-before" />}
      <div
        className={`tree-node${isSelected ? ' selected' : ''}${dragOver === 'inside' ? ' drop-inside' : ''}`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/collapse toggle */}
        <button
          className={`tree-toggle${hasChildren ? '' : ' invisible'}`}
          onClick={(e) => { e.stopPropagation(); onToggle(node.id); }}
        >
          {node.expanded ? '▾' : '▸'}
        </button>

        {/* Icon */}
        <span className="tree-icon" style={{ color: node.color }}>{node.icon}</span>

        {/* Name + meta */}
        <div className="tree-label">
          <span className="tree-name">{node.name}</span>
          {node.code && <span className="tree-code">{node.code}</span>}
        </div>

        {/* Level badge */}
        <span className="tree-level-badge" style={{ background: `${node.color}18`, color: node.color }}>
          {node.level}
        </span>

        {/* Type category */}
        <span className="tree-type">{node.typeCategory.replace('Type', '')}</span>

        {/* Quick actions */}
        <div className="tree-actions">
          {canHaveChildren && (
            <button className="tree-action-btn" onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }} title={`Add ${CHILD_LEVEL[node.level]} child`}>+</button>
          )}
          <button className="tree-action-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} title="Delete">×</button>
        </div>
      </div>
      {dragOver === 'after' && <div className="drop-indicator drop-after" />}

      {/* Children */}
      {node.expanded && hasChildren && (
        <div className="tree-children">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              searchQuery={searchQuery}
              onSelect={onSelect}
              onToggle={onToggle}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeNode;
