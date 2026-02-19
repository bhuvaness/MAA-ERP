/**
 * BusinessSetupWizard.tsx
 * ======================
 * Progressive drill-down UI for business setup.
 *
 * Integration:
 *   App.tsx renders this INSTEAD of WelcomeScreen when user clicks "Set up my business".
 *   On completion, calls onComplete(selectedIds) → App transitions to chat.
 *   On cancel, calls onCancel() → App shows WelcomeScreen again.
 *
 * Data:
 *   Loads PayanarssTypes from /data/VanakkamPayanarssTypes.json (static).
 *   Later: swap fetch URL to REST API — zero changes to this component.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";

// ═══════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════

interface PayanarssType {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Attributes: any[];
  Description: string | null;
}

interface HierarchyIndex {
  byId: Map<string, PayanarssType>;
  childrenOf: Map<string, PayanarssType[]>;
  roots: PayanarssType[];
  descendantCount: Map<string, number>;
  totalCount: number;
}

interface Props {
  onComplete: (selectedIds: string[]) => void;
  onCancel: () => void;
}

const TYPE_IDS = {
  GROUP_TYPE: "100000000000000000000000000000004",
  MODULE_TYPE: "100000000000000000000000000000005",
  SUB_MODULE_TYPE: "100000000000000000000000000000006",
  BUSINESS_USE_CASE: "10000000000000000000000000000000111",
  TABLE_TYPE: "100000000000000000000000000000002",
  VALUE_TYPE: "100000000000000000000000000000001",
  LOOKUP_TYPE: "100000000000000000000000000000003",
  RULE_TYPE: "100000000000000000000000000000008",
};

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  [TYPE_IDS.GROUP_TYPE]: { label: "Category", icon: "🏢", color: "#a78bfa" },
  [TYPE_IDS.MODULE_TYPE]: { label: "Module", icon: "📦", color: "#8b5cf6" },
  [TYPE_IDS.SUB_MODULE_TYPE]: { label: "Sub-Module", icon: "📂", color: "#06b6d4" },
  [TYPE_IDS.BUSINESS_USE_CASE]: { label: "Use Case", icon: "⚡", color: "#f59e0b" },
  [TYPE_IDS.TABLE_TYPE]: { label: "Table", icon: "🗃️", color: "#10b981" },
  [TYPE_IDS.VALUE_TYPE]: { label: "Field", icon: "📄", color: "#6b7280" },
  [TYPE_IDS.LOOKUP_TYPE]: { label: "Lookup", icon: "🔗", color: "#ec4899" },
  [TYPE_IDS.RULE_TYPE]: { label: "Rule", icon: "📏", color: "#ef4444" },
};

const SECTOR_ICONS: Record<string, string> = {
  "Manufacturing": "🏭", "Construction & Real Estate": "🏗️",
  "Retail & E-Commerce": "🛒", "Food & Beverage": "🍽️",
  "Healthcare": "🏥", "Hospitality & Travel": "🏨",
  "Education": "🎓", "Transportation & Logistics": "🚛",
  "Financial Services": "🏦", "Professional Services": "💼",
  "Technology & IT": "💻", "Personal Services": "💇",
  "Energy & Utilities": "⚡", "Agriculture & Farming": "🌾",
  "Media & Entertainment": "🎬", "Government & Public": "🏛️",
  "Sports & Recreation": "⚽", "Religious & Community": "🕌",
  "Common Modules": "📦",
};

// ═══════════════════════════════════════════════════════════════
// HIERARCHY INDEX BUILDER
// ═══════════════════════════════════════════════════════════════

function buildIndex(types: PayanarssType[]): HierarchyIndex {
  const byId = new Map<string, PayanarssType>();
  const childrenOf = new Map<string, PayanarssType[]>();
  const roots: PayanarssType[] = [];
  const descendantCount = new Map<string, number>();

  for (const t of types) byId.set(t.Id, t);

  for (const t of types) {
    if (t.Id === t.ParentId) {
      roots.push(t);
    } else {
      if (!childrenOf.has(t.ParentId)) childrenOf.set(t.ParentId, []);
      childrenOf.get(t.ParentId)!.push(t);
    }
  }

  function countDesc(nodeId: string): number {
    if (descendantCount.has(nodeId)) return descendantCount.get(nodeId)!;
    const children = childrenOf.get(nodeId) || [];
    let count = children.length;
    for (const c of children) count += countDesc(c.Id);
    descendantCount.set(nodeId, count);
    return count;
  }
  for (const t of types) countDesc(t.Id);

  return { byId, childrenOf, roots, descendantCount, totalCount: types.length };
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

const BusinessSetupWizard: React.FC<Props> = ({ onComplete, onCancel }) => {
  const [phase, setPhase] = useState<"loading" | "browsing" | "review">("loading");
  const [index, setIndex] = useState<HierarchyIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [navStack, setNavStack] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [animKey, setAnimKey] = useState(0);

  // ── Load data from static JSON ──
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const resp = await fetch("/data/VanakkamPayanarssTypes.json");
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: PayanarssType[] = await resp.json();
        if (!mounted) return;
        const idx = buildIndex(data);
        setIndex(idx);
        setPhase("browsing");
        console.log(`📦 Loaded ${data.length} PayanarssTypes, ${idx.roots.length} root(s)`);
      } catch (err: any) {
        if (mounted) setError(err.message);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // ── Computed values ──
  const currentParent = useMemo(() => {
    if (!index || navStack.length === 0) return null;
    return index.byId.get(navStack[navStack.length - 1]) || null;
  }, [index, navStack]);

  const currentChildren = useMemo(() => {
    if (!index) return [];
    if (navStack.length === 0) {
      if (index.roots.length === 1) return index.childrenOf.get(index.roots[0].Id) || [];
      return index.roots;
    }
    return index.childrenOf.get(navStack[navStack.length - 1]) || [];
  }, [index, navStack]);

  const filteredChildren = useMemo(() => {
    if (!searchQuery.trim()) return currentChildren;
    const q = searchQuery.toLowerCase();
    return currentChildren.filter((c) =>
      c.Name.toLowerCase().includes(q) ||
      (c.Description && c.Description.toLowerCase().includes(q))
    );
  }, [currentChildren, searchQuery]);

  const breadcrumb = useMemo(() => {
    if (!index || navStack.length === 0) return [];
    const path: PayanarssType[] = [];
    let curId: string | null = navStack[navStack.length - 1];
    while (curId) {
      const n = index.byId.get(curId);
      if (!n) break;
      path.unshift(n);
      if (n.Id === n.ParentId) break;
      curId = n.ParentId;
    }
    return path;
  }, [index, navStack]);

  const depthLabel = useMemo(() => {
    if (navStack.length === 0) return "Select your industry";
    if (!currentParent) return "";
    const t = currentParent.PayanarssTypeId;
    if (t === TYPE_IDS.GROUP_TYPE) return navStack.length === 1 ? `Explore ${currentParent.Name}` : `Sub-categories in ${currentParent.Name}`;
    if (t === TYPE_IDS.MODULE_TYPE) return `Sub-modules in ${currentParent.Name}`;
    if (t === TYPE_IDS.SUB_MODULE_TYPE) return `Use cases in ${currentParent.Name}`;
    if (t === TYPE_IDS.BUSINESS_USE_CASE) return `Tables in ${currentParent.Name}`;
    if (t === TYPE_IDS.TABLE_TYPE) return `Columns in ${currentParent.Name}`;
    return `Inside ${currentParent.Name}`;
  }, [navStack, currentParent]);

  // ── Actions ──
  const drillInto = useCallback((nodeId: string) => {
    if (!index) return;
    const children = index.childrenOf.get(nodeId);
    if (!children || children.length === 0) return;
    setNavStack((prev) => [...prev, nodeId]);
    setSearchQuery("");
    setAnimKey((k) => k + 1);
  }, [index]);

  const goBack = useCallback(() => {
    setNavStack((prev) => prev.slice(0, -1));
    setSearchQuery("");
    setAnimKey((k) => k + 1);
  }, []);

  const goToBreadcrumb = useCallback((idx: number) => {
    if (idx < 0) { setNavStack([]); }
    else {
      const targetId = breadcrumb[idx]?.Id;
      if (targetId) setNavStack((prev) => { const i = prev.indexOf(targetId); return i >= 0 ? prev.slice(0, i + 1) : prev; });
    }
    setSearchQuery("");
    setAnimKey((k) => k + 1);
  }, [breadcrumb]);

  const toggleSelect = useCallback((nodeId: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(nodeId) ? n.delete(nodeId) : n.add(nodeId); return n; });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds((prev) => { const n = new Set(prev); filteredChildren.forEach((c) => n.add(c.Id)); return n; });
  }, [filteredChildren]);

  const deselectAllVisible = useCallback(() => {
    setSelectedIds((prev) => { const n = new Set(prev); filteredChildren.forEach((c) => n.delete(c.Id)); return n; });
  }, [filteredChildren]);

  const getDescCount = useCallback((nodeId: string) => index?.descendantCount.get(nodeId) || 0, [index]);
  const hasKids = useCallback((nodeId: string) => !!(index?.childrenOf.get(nodeId)?.length), [index]);
  const allVisibleSelected = filteredChildren.length > 0 && filteredChildren.every((c) => selectedIds.has(c.Id));
  const isIndustryLevel = navStack.length === 0;

  // ═══════════════════════════════════════════════════
  // RENDER: Loading
  // ═══════════════════════════════════════════════════

  if (phase === "loading") {
    return (
      <div className="setup-wizard" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ textAlign: "center" }}>
          {error ? (
            <>
              <p style={{ color: "#ef4444", marginBottom: 12 }}>Failed to load: {error}</p>
              <button onClick={onCancel} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>← Back</button>
            </>
          ) : (
            <>
              <div style={{ width: 32, height: 32, border: "3px solid var(--bg-surface)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              <p style={{ color: "var(--text-4)", marginTop: 12, fontSize: 13 }}>Loading business catalog...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // RENDER: Review
  // ═══════════════════════════════════════════════════

  if (phase === "review") {
    const grouped = new Map<string, PayanarssType[]>();
    selectedIds.forEach((sid) => {
      const n = index?.byId.get(sid);
      if (!n) return;
      const parent = index?.byId.get(n.ParentId);
      const key = parent?.Name || "Other";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(n);
    });

    return (
      <div className="setup-wizard" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => setPhase("browsing")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontSize: 13, marginBottom: 8 }}>← Back to Selection</button>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-1)" }}>Review Your Selections</h2>
          <p style={{ fontSize: 13, color: "var(--text-4)", marginTop: 4 }}>{selectedIds.size} items selected</p>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {selectedIds.size === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-4)" }}>
              <p style={{ fontSize: 36, marginBottom: 8 }}>📋</p>
              <p>No selections yet. Go back and choose modules.</p>
            </div>
          ) : (
            Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group} style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{group}</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {items.map((item) => {
                    const tc = TYPE_CONFIG[item.PayanarssTypeId];
                    return (
                      <span key={item.Id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 12, color: "var(--text-2)" }}>
                        {tc?.icon || "📄"} {item.Name}
                        <button onClick={() => toggleSelect(item.Id)} style={{ background: "none", border: "none", color: "var(--text-4)", cursor: "pointer", fontSize: 14, marginLeft: 2 }}>×</button>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {selectedIds.size > 0 && (
          <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", textAlign: "right" }}>
            <button
              onClick={() => onComplete(Array.from(selectedIds))}
              style={{ padding: "10px 24px", fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--accent)", border: "none", borderRadius: 10, cursor: "pointer" }}
            >
              ✓ Confirm & Set Up My Business
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // RENDER: Browsing (main drill-down)
  // ═══════════════════════════════════════════════════

  return (
    <div className="setup-wizard" style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: "var(--text-4)", cursor: "pointer", fontSize: 13 }}>✕ Cancel</button>
          <span style={{ color: "var(--text-4)", fontSize: 12 }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>Business Setup</span>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={() => setPhase("review")}
            style={{ padding: "6px 16px", fontSize: 12, fontWeight: 600, color: "#fff", background: "var(--accent)", border: "none", borderRadius: 6, cursor: "pointer" }}
          >
            Review ({selectedIds.size}) →
          </button>
        )}
      </div>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 0, fontSize: 12 }}>
        <button onClick={() => goToBreadcrumb(-1)} style={{ background: "none", border: "none", color: "var(--text-4)", cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>🏠 Industries</button>
        {breadcrumb.slice(1).map((node, i) => (
          <React.Fragment key={node.Id}>
            <span style={{ color: "var(--text-5)", margin: "0 2px" }}>›</span>
            <button
              onClick={() => {
                const stackIdx = navStack.indexOf(node.Id);
                if (stackIdx >= 0) { setNavStack(navStack.slice(0, stackIdx + 1)); setAnimKey((k) => k + 1); }
              }}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: "2px 6px", borderRadius: 4, fontSize: 12,
                color: i === breadcrumb.length - 2 ? "var(--text-1)" : "var(--text-4)",
                fontWeight: i === breadcrumb.length - 2 ? 600 : 400,
              }}
            >
              {node.Name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Sub-header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {navStack.length > 0 && (
            <button onClick={goBack} style={{ padding: "5px 12px", fontSize: 12, color: "var(--text-3)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer" }}>← Back</button>
          )}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>{depthLabel}</h3>
            <p style={{ fontSize: 11, color: "var(--text-5)", marginTop: 1 }}>{filteredChildren.length} items</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6 }}>
            <span style={{ color: "var(--text-5)", fontSize: 12 }}>🔍</span>
            <input
              type="text" placeholder="Filter..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: "none", border: "none", color: "var(--text-1)", fontSize: 12, outline: "none", width: 120 }}
            />
            {searchQuery && <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: "var(--text-4)", cursor: "pointer", fontSize: 14 }}>×</button>}
          </div>
          {!isIndustryLevel && (
            <button
              onClick={allVisibleSelected ? deselectAllVisible : selectAllVisible}
              style={{ padding: "4px 10px", fontSize: 11, color: "var(--text-4)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 4, cursor: "pointer" }}
            >
              {allVisibleSelected ? "☑ Deselect All" : "☐ Select All"}
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }} key={animKey}>
        {filteredChildren.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "var(--text-4)" }}>
            <p style={{ fontSize: 36, marginBottom: 8 }}>🔍</p>
            <p>No items match "{searchQuery}"</p>
          </div>
        ) : isIndustryLevel ? (
          /* ─── Industry cards (top level) ─── */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {filteredChildren.map((child) => {
              const desc = getDescCount(child.Id);
              const icon = SECTOR_ICONS[child.Name] || "🏢";
              const isSelected = selectedIds.has(child.Id);
              return (
                <div
                  key={child.Id}
                  onClick={() => drillInto(child.Id)}
                  style={{
                    padding: 16, borderRadius: 10, cursor: "pointer",
                    background: isSelected ? "rgba(139,92,246,0.08)" : "var(--bg-surface)",
                    border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 28 }}>{icon}</span>
                    <span style={{ fontSize: 14, color: "var(--text-5)" }}>→</span>
                  </div>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)", marginBottom: 4 }}>{child.Name}</h4>
                  {child.Description && <p style={{ fontSize: 11, color: "var(--text-4)", lineHeight: 1.4, marginBottom: 8, maxHeight: 32, overflow: "hidden" }}>{child.Description}</p>}
                  <span style={{ fontSize: 10, color: "var(--text-5)", background: "var(--bg-base)", padding: "2px 6px", borderRadius: 3 }}>{desc} items</span>
                </div>
              );
            })}
          </div>
        ) : (
          /* ─── Item list (deeper levels) ─── */
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredChildren.map((child) => {
              const tc = TYPE_CONFIG[child.PayanarssTypeId] || { label: "Item", icon: "📄", color: "#6b7280" };
              const desc = getDescCount(child.Id);
              const canDrill = hasKids(child.Id);
              const isSelected = selectedIds.has(child.Id);
              return (
                <div
                  key={child.Id}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 8,
                    background: isSelected ? "rgba(139,92,246,0.06)" : "var(--bg-surface)",
                    border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border)",
                    borderLeft: `3px solid ${isSelected ? "var(--accent)" : tc.color}40`,
                    transition: "all 0.1s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    <input
                      type="checkbox" checked={isSelected} onChange={() => toggleSelect(child.Id)}
                      style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-1)", display: "flex", alignItems: "center", gap: 4 }}>
                        <span>{tc.icon}</span> {child.Name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 500, padding: "1px 6px", borderRadius: 3, background: `${tc.color}15`, color: tc.color }}>{tc.label}</span>
                        {desc > 0 && <span style={{ fontSize: 10, color: "var(--text-5)" }}>{desc} children</span>}
                        {child.Description && <span style={{ fontSize: 10, color: "var(--text-5)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{child.Description}</span>}
                      </div>
                    </div>
                  </div>
                  {canDrill && (
                    <button
                      onClick={(e) => { e.stopPropagation(); drillInto(child.Id); }}
                      style={{ padding: "4px 10px", fontSize: 11, fontWeight: 500, color: "var(--accent)", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 5, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      Explore →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {selectedIds.size > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>✓ {selectedIds.size} selected</span>
          <button
            onClick={() => setPhase("review")}
            style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, color: "#fff", background: "var(--accent)", border: "none", borderRadius: 8, cursor: "pointer" }}
          >
            Review & Confirm →
          </button>
        </div>
      )}
    </div>
  );
};

export default BusinessSetupWizard;
