/**
 * PTSTreeView — PayanarssType Tree Renderer
 * ==========================================
 * Renders a GymTreeNode as a collapsible tree in the main chat area.
 * Dark theme, matching maa-erp.css variables.
 * First two levels expanded by default.
 */

import React, { useState, useCallback } from "react";
import type { GymTreeNode } from "../data/gymBusinessData";
import { TYPE_DISPLAY, PTS_TYPE_IDS } from "../data/gymBusinessData";

function getTypeInfo(typeId: string) {
  return TYPE_DISPLAY[typeId] || { label: "Node", icon: "📄", color: "#6b7280" };
}

function isBranch(typeId: string): boolean {
  return typeId === PTS_TYPE_IDS.CHILD_TABLE || typeId === PTS_TYPE_IDS.TABLE_TYPE;
}

function countDescendants(node: GymTreeNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}

// ── Single tree node ──

const TreeNode: React.FC<{
  node: GymTreeNode;
  depth: number;
  defaultOpen?: boolean;
}> = ({ node, depth, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasKids = node.children.length > 0;
  const branch = isBranch(node.typeId);
  const info = getTypeInfo(node.typeId);
  const descendants = countDescendants(node);

  const toggle = useCallback(() => {
    if (hasKids) setOpen((v) => !v);
  }, [hasKids]);

  return (
    <div className="pts-node">
      {/* Row */}
      <div
        className={`pts-row ${hasKids ? "pts-expandable" : ""}`}
        onClick={toggle}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <span className="pts-chevron">
          {hasKids ? (open ? "▾" : "▸") : "·"}
        </span>
        <span className="pts-icon" style={{ color: info.color }}>
          {info.icon}
        </span>
        <span className={`pts-name ${branch ? "pts-branch-name" : ""}`}>
          {node.name}
        </span>
        <span
          className="pts-badge"
          style={{ background: `${info.color}20`, color: info.color }}
        >
          {info.label}
        </span>
        {hasKids && <span className="pts-count">{descendants}</span>}
      </div>

      {/* Description (leaf nodes only) */}
      {node.description && open && !branch && (
        <div className="pts-desc" style={{ paddingLeft: `${depth * 20 + 48}px` }}>
          {node.description}
        </div>
      )}

      {/* Children */}
      {open && hasKids && (
        <div className="pts-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              defaultOpen={depth < 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main component ──

const PTSTreeView: React.FC<{
  tree: GymTreeNode;
  title?: string;
  onClose?: () => void;
}> = ({ tree, title, onClose }) => {
  const [expandAll, setExpandAll] = useState(false);
  const totalNodes = countDescendants(tree) + 1;

  return (
    <div className="pts-tree">
      {/* Header */}
      <div className="pts-header">
        <div className="pts-header-info">
          <h3 className="pts-title">{title || tree.name}</h3>
          <span className="pts-stats">
            {totalNodes} nodes · depth 3 · max 3 cols/branch
          </span>
        </div>
        <div className="pts-header-actions">
          <button className="pts-btn" onClick={() => setExpandAll(!expandAll)}>
            {expandAll ? "Collapse" : "Expand all"}
          </button>
          {onClose && (
            <button className="pts-btn" onClick={onClose}>✕</button>
          )}
        </div>
      </div>

      {/* Root description */}
      {tree.description && (
        <div className="pts-root-desc">{tree.description}</div>
      )}

      {/* Tree body — re-mount on expandAll toggle to reset all states */}
      <div className="pts-body" key={expandAll ? "expanded" : "collapsed"}>
        {tree.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={0}
            defaultOpen={expandAll || true}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="pts-legend">
        {[
          PTS_TYPE_IDS.CHILD_TABLE,
          PTS_TYPE_IDS.TEXT,
          PTS_TYPE_IDS.NUMBER,
          PTS_TYPE_IDS.LOOKUP_TYPE,
          PTS_TYPE_IDS.BOOLEAN,
          PTS_TYPE_IDS.ATTRIBUTE_TYPE,
          PTS_TYPE_IDS.LOOKUP_VALUE,
        ].map((typeId) => {
          const inf = getTypeInfo(typeId);
          return (
            <span key={typeId} className="pts-legend-item">
              <span style={{ color: inf.color }}>{inf.icon}</span> {inf.label}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default PTSTreeView;
