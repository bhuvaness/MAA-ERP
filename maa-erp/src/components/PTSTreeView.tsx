/**
 * PTSTreeView — PayanarssType Tree Renderer
 * ==========================================
 * Renders a GymTreeNode hierarchy as a collapsible tree.
 * Each node shows its name, type icon, and description.
 * Branches expand/collapse on click.
 */

import React, { useState, useCallback } from "react";
import type { GymTreeNode } from "../data/gymBusinessData";
import { TYPE_DISPLAY, PTS_TYPE_IDS } from "../data/gymBusinessData";

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// SINGLE TREE NODE
// ═══════════════════════════════════════════════════════════════

const TreeNode: React.FC<{
  node: GymTreeNode;
  depth: number;
  defaultExpanded?: boolean;
}> = ({ node, depth, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasChildren = node.children.length > 0;
  const nodeIsBranch = isBranch(node.typeId);
  const typeInfo = getTypeInfo(node.typeId);
  const descendantCount = countDescendants(node);

  const toggle = useCallback(() => {
    if (hasChildren) setExpanded((e) => !e);
  }, [hasChildren]);

  return (
    <div className="pts-tree-node" data-depth={depth}>
      <div
        className={`pts-tree-row ${hasChildren ? "expandable" : ""} ${expanded ? "expanded" : ""} ${nodeIsBranch ? "branch" : "leaf"}`}
        onClick={toggle}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Expand/collapse chevron */}
        <span className="pts-tree-chevron">
          {hasChildren ? (expanded ? "▾" : "▸") : "·"}
        </span>

        {/* Type icon */}
        <span
          className="pts-tree-icon"
          style={{ color: typeInfo.color }}
          title={typeInfo.label}
        >
          {typeInfo.icon}
        </span>

        {/* Name */}
        <span className={`pts-tree-name ${nodeIsBranch ? "is-branch" : ""}`}>
          {node.name}
        </span>

        {/* Type badge */}
        <span
          className="pts-tree-badge"
          style={{ background: `${typeInfo.color}18`, color: typeInfo.color }}
        >
          {typeInfo.label}
        </span>

        {/* Child count (for branches) */}
        {hasChildren && (
          <span className="pts-tree-count">{descendantCount}</span>
        )}
      </div>

      {/* Description on hover/expanded */}
      {node.description && expanded && !nodeIsBranch && (
        <div
          className="pts-tree-desc"
          style={{ paddingLeft: `${depth * 20 + 44}px` }}
        >
          {node.description}
        </div>
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <div className="pts-tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              defaultExpanded={depth < 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

const PTSTreeView: React.FC<{
  tree: GymTreeNode;
  title?: string;
  onBack?: () => void;
}> = ({ tree, title, onBack }) => {
  const [expandAll, setExpandAll] = useState(false);

  const totalNodes = countDescendants(tree) + 1;

  return (
    <div className="pts-tree-view">
      {/* Header */}
      <div className="pts-tree-header">
        {onBack && (
          <button className="pts-tree-back" onClick={onBack}>
            ← Back
          </button>
        )}
        <div className="pts-tree-title-area">
          <h3 className="pts-tree-title">
            {title || tree.name}
          </h3>
          <span className="pts-tree-stats">
            {totalNodes} nodes · depth 3 · max 3 cols per branch
          </span>
        </div>
        <button
          className="pts-tree-toggle-all"
          onClick={() => setExpandAll(!expandAll)}
        >
          {expandAll ? "Collapse all" : "Expand all"}
        </button>
      </div>

      {/* Description */}
      {tree.description && (
        <div className="pts-tree-root-desc">{tree.description}</div>
      )}

      {/* Tree body */}
      <div className="pts-tree-body" key={expandAll ? "expanded" : "collapsed"}>
        {tree.children.map((child) => (
          <TreeNode
            key={child.id}
            node={child}
            depth={0}
            defaultExpanded={expandAll}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="pts-tree-legend">
        {[
          PTS_TYPE_IDS.CHILD_TABLE,
          PTS_TYPE_IDS.TEXT,
          PTS_TYPE_IDS.NUMBER,
          PTS_TYPE_IDS.LOOKUP_TYPE,
          PTS_TYPE_IDS.BOOLEAN,
          PTS_TYPE_IDS.ATTRIBUTE_TYPE,
          PTS_TYPE_IDS.LOOKUP_VALUE,
        ].map((typeId) => {
          const info = getTypeInfo(typeId);
          return (
            <span key={typeId} className="pts-tree-legend-item">
              <span style={{ color: info.color }}>{info.icon}</span>
              <span>{info.label}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default PTSTreeView;
