import React, { useState, useEffect, useMemo } from 'react';
import type { ContextInfo } from '../types';

interface PayanarssType {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Attributes: unknown[];
  Description: string | null;
}

interface Props {
  context: ContextInfo;
  onImport: () => void;
  selectedModuleIds?: string[];
}

interface TreeNode {
  type: PayanarssType;
  children: TreeNode[];
}

const LEVEL_ICONS: Record<string, string> = {
  SEC: "\u{1F3ED}", MOD: "\u{1F4E6}", ISM: "\u{1F4E6}", SMO: "\u{1F4C2}", SUB: "\u{1F4C2}",
  UCX: "\u26A1", TBL: "\u{1F5C3}", GYM: "\u{1F3CB}", CMR: "\u{1F4E6}",
};

const ContextPanel: React.FC<Props> = ({ context, onImport, selectedModuleIds = [] }) => {
  const [allTypes, setAllTypes] = useState<PayanarssType[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedModuleIds.length === 0) return;
    fetch("/data/VanakkamPayanarssTypes.json")
      .then((r) => r.json())
      .then((data: PayanarssType[]) => setAllTypes(data))
      .catch(() => {});
  }, [selectedModuleIds.length]);

  const moduleTree = useMemo(() => {
    if (allTypes.length === 0 || selectedModuleIds.length === 0) return [];
    const selectedSet = new Set(selectedModuleIds);
    const maaErp = allTypes.find((t) => t.Name === "MAA ERP");
    if (!maaErp) return [];

    const skipPrefixes = new Set(["COL", "RUL"]);

    const hasSelectedDesc = (nodeId: string): boolean => {
      if (selectedSet.has(nodeId)) return true;
      return allTypes.filter((t) => t.ParentId === nodeId && t.Id !== nodeId)
        .some((c) => hasSelectedDesc(c.Id));
    };

    const buildBranch = (parentId: string, depth: number): TreeNode[] => {
      if (depth > 4) return [];
      return allTypes
        .filter((t) => t.ParentId === parentId && t.Id !== parentId)
        .filter((c) => {
          const p = c.Id.substring(0, 3).toUpperCase();
          if (skipPrefixes.has(p)) return false;
          return selectedSet.has(c.Id) || hasSelectedDesc(c.Id);
        })
        .map((c) => ({ type: c, children: buildBranch(c.Id, depth + 1) }));
    };

    return allTypes
      .filter((t) => t.ParentId === maaErp.Id && t.Id !== maaErp.Id)
      .filter((t) => hasSelectedDesc(t.Id) || selectedSet.has(t.Id))
      .map((t) => ({ type: t, children: buildBranch(t.Id, 1) }));
  }, [allTypes, selectedModuleIds]);

  useEffect(() => {
    if (moduleTree.length > 0 && expandedIds.size === 0) {
      const auto = new Set<string>();
      moduleTree.forEach((n) => auto.add(n.type.Id));
      setExpandedIds(auto);
    }
  }, [moduleTree]);

  const toggle = (id: string) => {
    setExpandedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const prefix = node.type.Id.substring(0, 3).toUpperCase();
    const icon = LEVEL_ICONS[prefix] || "\u{1F4C4}";
    const hasKids = node.children.length > 0;
    const isOpen = expandedIds.has(node.type.Id);
    return (
      <div key={node.type.Id}>
        <div
          onClick={() => hasKids && toggle(node.type.Id)}
          style={{
            padding: "5px 10px", paddingLeft: 12 + depth * 16,
            display: "flex", alignItems: "center", gap: 6,
            cursor: hasKids ? "pointer" : "default",
            fontSize: 12, color: "var(--text-2)", borderRadius: 4,
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg-elevated)")}
          onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {hasKids ? <span style={{ fontSize: 10, color: "var(--text-4)", width: 12, textAlign: "center" }}>{isOpen ? "\u25BC" : "\u25B6"}</span> : <span style={{ width: 12 }} />}
          <span style={{ fontSize: 12 }}>{icon}</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: depth === 0 ? 600 : 400, color: depth === 0 ? "var(--text-1)" : "var(--text-2)" }}>{node.type.Name}</span>
          {hasKids && <span style={{ fontSize: 10, color: "var(--text-5)" }}>{node.children.length}</span>}
        </div>
        {isOpen && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const showHardcoded = selectedModuleIds.length === 0 || moduleTree.length === 0;

  return (
    <aside className="context-panel">
      <div className="cp-header">
        <div className="cp-brand">
          <div className="cp-logo">M</div>
          <div className="cp-brand-text"><h2>MAA Platform</h2><span>Powered by Viki AI</span></div>
        </div>
        <div className="cp-context">
          <div className="cp-context-label">{"\u2605"} Current Context</div>
          <div className="cp-context-value">{context.value}</div>
          <div className="cp-context-path">{context.path}</div>
        </div>
      </div>
      <div className="cp-threads" style={{ flex: 1, overflowY: "auto" }}>
        {showHardcoded ? (
          <>
            <div className="cp-section-title">Conversations</div>
            <div className="cp-thread active">
              <div className="cp-thread-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>{"\u{1F464}"}</div>
              <div className="cp-thread-info"><h4>HR &amp; Employees</h4><span>Add, import, manage</span></div>
            </div>
            <div className="cp-thread">
              <div className="cp-thread-icon" style={{ background: 'var(--yellow-soft)', color: 'var(--yellow)' }}>{"\u{1F4B5}"}</div>
              <div className="cp-thread-info"><h4>Finance</h4><span>Invoices, payments</span></div>
            </div>
            <div className="cp-thread">
              <div className="cp-thread-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>{"\u{1F4E6}"}</div>
              <div className="cp-thread-info"><h4>Procurement</h4><span>POs, vendors</span></div>
            </div>
          </>
        ) : (
          <>
            <div className="cp-section-title" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Business Modules</span>
              <span style={{ fontSize: 10, color: "var(--text-5)" }}>{moduleTree.length}</span>
            </div>
            <div style={{ paddingBottom: 8 }}>
              {moduleTree.map((node) => renderNode(node, 0))}
            </div>
          </>
        )}
      </div>
      <div className="cp-footer">
        <button className="cp-quick-btn" onClick={onImport}>{"\u{1F4CE}"} Import data (Excel, CSV)</button>
        <button className="cp-quick-btn">{"\u271A"} New conversation</button>
        <button className="cp-quick-btn">{"\u2699"} Settings</button>
      </div>
    </aside>
  );
};

export default ContextPanel;
