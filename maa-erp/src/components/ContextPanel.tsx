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
            <h2>MAA Platform</h2>
            <span>Powered by Viki AI</span>
          </div>
        </div>
        <div className="cp-context">
          <div className="cp-context-label">★ Current Context</div>
          <div className="cp-context-value">{context.value}</div>
          <div className="cp-context-path">{context.path}</div>
        </div>
      </div>

      <div className="cp-threads" style={{ flex: 1, overflowY: "auto" }}>
        {isConfigured && tree ? (
          <>
            {/* Gym Business DB Schema tree */}
            <div
              className="cp-section-title"
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <span>Gym Business DB Schema</span>
              <span style={{ fontSize: 10, color: "var(--text-5)" }}>
                {countNodes(tree)}
              </span>
            </div>

            {/* Use case header */}
            <div
              style={{
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: "var(--viki)",
                fontWeight: 600,
                background: "var(--viki-soft)",
                borderRadius: 6,
                margin: "4px 10px 6px",
              }}
            >
              <span>🎯</span>
              <span>Identify Target Customer Segment</span>
            </div>

            {/* TargetCustomer root node */}
            <div
              onClick={() => toggle(tree.id)}
              style={{
                padding: "6px 12px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                fontSize: 12,
                borderRadius: 4,
                margin: "0 6px",
                fontWeight: 600,
                color: "var(--text)",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
              onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 10, color: "var(--text-4)", width: 12, textAlign: "center" }}>
                {expandedIds.has(tree.id) ? "▼" : "▶"}
              </span>
              <span style={{ fontSize: 12 }}>🗃️</span>
              <span style={{ flex: 1 }}>TargetCustomer</span>
              <span
                style={{
                  fontSize: 9,
                  color: "#10b981",
                  background: "rgba(16,185,129,0.15)",
                  padding: "1px 6px",
                  borderRadius: 3,
                  fontWeight: 600,
                }}
              >
                TABLE
              </span>
              <span style={{ fontSize: 10, color: "var(--text-5)" }}>
                {tree.children.length}
              </span>
            </div>

            {/* Children of TargetCustomer */}
            {expandedIds.has(tree.id) && (
              <div style={{ paddingBottom: 8 }}>
                {tree.children.map((child) => renderTreeNode(child, 1))}
              </div>
            )}

            {/* Separator */}
            <div style={{ borderTop: "1px solid var(--border-light)", margin: "8px 12px" }} />

            {/* Quick conversations */}
            <div className="cp-section-title">Conversations</div>
            <div className="cp-thread active">
              <div className="cp-thread-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>🏋️</div>
              <div className="cp-thread-info">
                <h4>Gym Business Setup</h4>
                <span>Target customers configured</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="cp-section-title">Conversations</div>
            <div className="cp-thread active">
              <div className="cp-thread-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>👤</div>
              <div className="cp-thread-info">
                <h4>HR &amp; Employees</h4>
                <span>Add, import, manage</span>
              </div>
            </div>
            <div className="cp-thread">
              <div className="cp-thread-icon" style={{ background: 'var(--yellow-soft)', color: 'var(--yellow)' }}>💵</div>
              <div className="cp-thread-info">
                <h4>Finance</h4>
                <span>Invoices, payments</span>
              </div>
            </div>
            <div className="cp-thread">
              <div className="cp-thread-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>📦</div>
              <div className="cp-thread-info">
                <h4>Procurement</h4>
                <span>POs, vendors</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="cp-footer">
        <button className="cp-quick-btn" onClick={onImport}>📎 Import data (Excel, CSV)</button>
        <button className="cp-quick-btn">✚ New conversation</button>
        <button className="cp-quick-btn">⚙ Settings</button>
      </div>
    </aside>
  );
};

export default ContextPanel;
