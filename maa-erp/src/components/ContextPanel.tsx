/**
 * ContextPanel — Left Sidebar
 * ============================
 * Shows the Gym Business DB Schema tree when business is configured.
 * Uses hardcoded TargetCustomer tree from gymBusinessData.
 */

import React, { useState, useMemo } from 'react';
import type { ContextInfo } from '../types';
import { getTargetCustomerTree, TYPE_DISPLAY, PTS_TYPE_IDS, type GymTreeNode } from '../data/gymBusinessData';

interface Props {
  context: ContextInfo;
  onImport: () => void;
  selectedModuleIds?: string[];
}

function getTypeInfo(typeId: string) {
  return TYPE_DISPLAY[typeId] || { label: "Node", icon: "📄", color: "#6b7280" };
}

function isBranch(typeId: string): boolean {
  return typeId === PTS_TYPE_IDS.CHILD_TABLE || typeId === PTS_TYPE_IDS.TABLE_TYPE;
}

function countNodes(node: GymTreeNode): number {
  let c = 1;
  for (const child of node.children) c += countNodes(child);
  return c;
}

const ContextPanel: React.FC<Props> = ({ context, onImport, selectedModuleIds = [] }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const tree = useMemo(() => getTargetCustomerTree(), []);
  const isConfigured = selectedModuleIds.length > 0;

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const renderTreeNode = (node: GymTreeNode, depth: number): React.ReactNode => {
    const hasKids = node.children.length > 0;
    const isOpen = expandedIds.has(node.id);
    const info = getTypeInfo(node.typeId);
    const branch = isBranch(node.typeId);

    return (
      <div key={node.id}>
        <div
          onClick={() => hasKids && toggle(node.id)}
          style={{
            padding: "5px 10px",
            paddingLeft: 12 + depth * 16,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: hasKids ? "pointer" : "default",
            fontSize: 12,
            color: "var(--text-2)",
            borderRadius: 4,
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
          onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {hasKids ? (
            <span style={{ fontSize: 10, color: "var(--text-4)", width: 12, textAlign: "center" }}>
              {isOpen ? "▼" : "▶"}
            </span>
          ) : (
            <span style={{ width: 12 }} />
          )}
          <span style={{ fontSize: 12, color: info.color }}>{info.icon}</span>
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: branch ? 600 : 400,
              color: branch ? "var(--text)" : "var(--text-2)",
            }}
          >
            {node.name}
          </span>
          {hasKids && (
            <span style={{ fontSize: 10, color: "var(--text-5)" }}>
              {node.children.length}
            </span>
          )}
        </div>
        {isOpen && node.children.map((child) => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <aside className="context-panel">
      <div className="cp-header">
        <div className="cp-brand">
          <div className="cp-logo">M</div>
          <div className="cp-brand-text">
            <h2>MAA ERP</h2>
            <span>Gym Business</span>
          </div>
        </div>
        <div className="cp-context">
          <div className="cp-context-label">Current Context</div>
          <div className="cp-context-value">{context.value}</div>
          <div className="cp-context-path">{context.path}</div>
        </div>
      </div>

      <div className="cp-search">
        <input placeholder="Search or ⌘K..." />
      </div>

      <div className="cp-threads">
        <div className="cp-section-title">Active</div>

        <div className="cp-thread active">
          <div className="cp-thread-icon" style={{ background: 'var(--accent-light)' }}>👤</div>
          <div className="cp-thread-info">
            <h4>HR &amp; Employees</h4>
            <span>Salary for Ahmed...</span>
          </div>
          <div className="cp-thread-badge">3</div>
        </div>

        <div className="cp-thread">
          <div className="cp-thread-icon" style={{ background: 'var(--amber-light)' }}>💰</div>
          <div className="cp-thread-info">
            <h4>Finance &amp; Accounts</h4>
            <span>Chart of accounts ready</span>
          </div>
          <div className="cp-thread-time">11:30</div>
        </div>

        <div className="cp-thread">
          <div className="cp-thread-icon" style={{ background: 'var(--green-light)' }}>🏋️</div>
          <div className="cp-thread-info">
            <h4>Gym Members</h4>
            <span>45 members imported</span>
          </div>
          <div className="cp-thread-badge">2</div>
        </div>

        <div className="cp-section-title">Earlier</div>

        <div className="cp-thread">
          <div className="cp-thread-icon" style={{ background: 'var(--bg-warm)' }}>⚙️</div>
          <div className="cp-thread-info">
            <h4>Business Setup</h4>
            <span>Modules configured</span>
          </div>
          <div className="cp-thread-time">Tue</div>
        </div>

        <div className="cp-thread">
          <div className="cp-thread-icon" style={{ background: 'var(--blue-light)' }}>📦</div>
          <div className="cp-thread-info">
            <h4>Equipment &amp; Inventory</h4>
            <span>Treadmills ordered</span>
          </div>
          <div className="cp-thread-time">Mon</div>
        </div>
      </div>

      <div className="cp-footer">
        <button className="cp-quick-btn" onClick={onImport}>+ New</button>
        <button className="cp-quick-btn">⚙ Settings</button>
        <button className="cp-quick-btn">▤ Data</button>
      </div>
    </aside>
  );
};

export default ContextPanel;
