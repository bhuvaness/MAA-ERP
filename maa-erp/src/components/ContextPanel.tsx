/**
 * ContextPanel — Left Sidebar
 * ============================
 * Dynamically builds nav threads from selectedModuleIds.
 * Hydrates names/descriptions from VanakkamPayanarssTypes.json.
 * Falls back to a "pre-setup" state when no modules are configured.
 *
 * Thread sections:
 *   ACTIVE   — top 3 configured modules (most recently used / highest priority)
 *   MODULES  — remaining configured modules
 *   SYSTEM   — always-present: Business Setup, Settings
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { ContextInfo } from '../types';

// ─── Types ────────────────────────────────────────────────────

interface PTSNode {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Description?: string | null;
}

interface NavThread {
  id: string;
  icon: string;
  iconBg: string;
  name: string;
  subtitle: string;
  badge?: number;
  time?: string;
  isActive?: boolean;
}

interface Props {
  context: ContextInfo;
  onImport: () => void;
  selectedModuleIds?: string[];
  /** Optional: notify parent when a thread is clicked */
  onThreadClick?: (moduleId: string, moduleName: string) => void;
}

// ─── PayanarssTypeId → icon/color mapping ────────────────────

const TYPE_ICON_MAP: Record<string, { icon: string; bg: string }> = {
  // Business Solutions
  '10000000000000000000000000000011111': { icon: '🏢', bg: 'var(--blue-soft, #dbeafe)' },
  // Business Modules
  '10000000000000000000000000000001111': { icon: '📦', bg: 'var(--accent-soft, #fde8da)' },
  // Group
  '100000000000000000000000000000004': { icon: '📁', bg: 'var(--bg-elevated, #f5f3ef)' },
  // Table
  '100000000000000000000000000000001': { icon: '🗃️', bg: 'var(--green-soft, #dcfce7)' },
  '100000000000000000000000000000002': { icon: '📂', bg: 'var(--purple-soft, #ede9fe)' },
  // NOTE: BUSINESS_USE_CASE (...111) intentionally excluded so name patterns take priority
};

// Domain keyword → icon (fallback for name-based inference)
const NAME_ICON_MAP: [RegExp, { icon: string; bg: string }][] = [
  [/hr|employ|staff|payroll|salary|recruit|hire|team|workforce/i,  { icon: '👤', bg: 'var(--green-soft, #dcfce7)' }],
  [/finance|account|ledger|invoice|payment|tax|budget|revenue/i,   { icon: '💰', bg: 'var(--yellow-soft, #fef9c3)' }],
  [/gym|member|fitness|workout|trainer|segment|customer/i,         { icon: '🏋️', bg: 'var(--accent-soft, #fde8da)' }],
  [/equipment|inventory|stock|warehouse|asset|purchase|procure/i,  { icon: '📦', bg: 'var(--blue-soft, #dbeafe)' }],
  [/market|promot|advertis|campaign|social|brand/i,                { icon: '🚀', bg: 'var(--pink-soft, #fce7f3)' }],
  [/compliance|legal|audit|document|contract/i,                    { icon: '🔒', bg: 'var(--bg-elevated, #f5f3ef)' }],
  [/vendor|supplier/i,                                             { icon: '🛒', bg: 'var(--teal-soft, #ccfbf1)' }],
  [/sales|crm|lead|client/i,                                       { icon: '📈', bg: 'var(--pink-soft, #fce7f3)' }],
  [/building|facility|maintain|repair|floor|find|prepare/i,        { icon: '🏗️', bg: 'var(--teal-soft, #ccfbf1)' }],
  [/register|license|vision|goal|define|plan|budget/i,             { icon: '🎯', bg: 'var(--accent-soft, #fde8da)' }],
  [/insurance|risk|safety|emergency/i,                             { icon: '🛡️', bg: 'var(--blue-soft, #dbeafe)' }],
  [/daily|operat|schedul|class|session|maintenance/i,              { icon: '📅', bg: 'var(--green-soft, #dcfce7)' }],
  [/add|onboard|register|enrol/i,                                  { icon: '➕', bg: 'var(--green-soft, #dcfce7)' }],
];

function getThreadStyle(node: PTSNode): { icon: string; bg: string } {
  // 1. Try PayanarssTypeId exact match
  const byType = TYPE_ICON_MAP[node.PayanarssTypeId];
  if (byType) return byType;

  // 2. Try name keyword match
  for (const [pattern, style] of NAME_ICON_MAP) {
    if (pattern.test(node.Name) || pattern.test(node.Description || '')) {
      return style;
    }
  }

  // 3. Default
  return { icon: '⚙️', bg: 'var(--bg-elevated, #f5f3ef)' };
}

function truncate(str: string, max: number): string {
  return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

// ─── Local JSON loader (cached) ───────────────────────────────

let _cachedNodes: PTSNode[] | null = null;

async function loadNodes(): Promise<PTSNode[]> {
  if (_cachedNodes) return _cachedNodes;
  const res = await fetch('/data/VanakkamPayanarssTypes.json');
  if (!res.ok) throw new Error('Failed to load VanakkamPayanarssTypes.json');
  _cachedNodes = (await res.json()) as PTSNode[];
  return _cachedNodes;
}

// ─── Component ────────────────────────────────────────────────

const ContextPanel: React.FC<Props> = ({
  context,
  onImport,
  selectedModuleIds = [],
  onThreadClick,
}) => {
  const [nodes, setNodes] = useState<PTSNode[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const isConfigured = selectedModuleIds.length > 0;

  // Load local JSON once
  useEffect(() => {
    loadNodes()
      .then(setNodes)
      .catch((err) => console.warn('[ContextPanel] Failed to load nodes:', err));
  }, []);

  // Build threads from selectedModuleIds × local JSON
  const threads = useMemo<NavThread[]>(() => {
    if (nodes.length === 0 || selectedModuleIds.length === 0) return [];

    const idMap = new Map(nodes.map((n) => [n.Id, n]));
    // Build child count map for subtitle fallback
    const childCount = new Map<string, number>();
    for (const n of nodes) {
      if (n.ParentId && n.ParentId !== n.Id) {
        childCount.set(n.ParentId, (childCount.get(n.ParentId) ?? 0) + 1);
      }
    }

    return selectedModuleIds
      .map((id) => idMap.get(id))
      .filter((n): n is PTSNode => Boolean(n))
      .map((node) => {
        const style = getThreadStyle(node);
        const count = childCount.get(node.Id) ?? 0;
        // Subtitle: description → child count → generic
        const subtitle = node.Description?.trim()
          ? truncate(node.Description.trim(), 38)
          : count > 0
          ? `${count} item${count !== 1 ? 's' : ''} to configure`
          : 'Tap to open';
        return {
          id: node.Id,
          icon: style.icon,
          iconBg: style.bg,
          name: node.Name,
          subtitle,
        };
      });
  }, [nodes, selectedModuleIds]);

  // Active = first 3; rest go under "Modules"
  const activeThreads = threads.slice(0, 3);
  const moreThreads = threads.slice(3);

  const handleThreadClick = (thread: NavThread) => {
    setActiveThreadId(thread.id);
    onThreadClick?.(thread.id, thread.name);
  };

  return (
    <aside className="context-panel">
      {/* Header */}
      <div className="cp-header">
        <div className="cp-brand">
          <div className="cp-logo">M</div>
          <div className="cp-brand-text">
            <h2>MAA ERP</h2>
            <span>{isConfigured ? context.value : 'Setup Required'}</span>
          </div>
        </div>
        <div className="cp-context">
          <div className="cp-context-label">Current Context</div>
          <div className="cp-context-value">{context.value}</div>
          <div className="cp-context-path">{context.path}</div>
        </div>
      </div>

      {/* Search */}
      <div className="cp-search">
        <input placeholder="Search or ⌘K..." />
      </div>

      <div className="cp-threads">

        {/* ── Configured modules — dynamic ── */}
        {isConfigured && threads.length > 0 ? (
          <>
            <div className="cp-section-title">Active</div>

            {activeThreads.map((thread) => (
              <div
                key={thread.id}
                className={`cp-thread${activeThreadId === thread.id ? ' active' : ''}`}
                onClick={() => handleThreadClick(thread)}
                style={{ cursor: 'pointer' }}
              >
                <div className="cp-thread-icon" style={{ background: thread.iconBg }}>
                  {thread.icon}
                </div>
                <div className="cp-thread-info">
                  <h4>{thread.name}</h4>
                  <span>{thread.subtitle}</span>
                </div>
              </div>
            ))}

            {moreThreads.length > 0 && (
              <>
                <div className="cp-section-title">Modules</div>
                {moreThreads.map((thread) => (
                  <div
                    key={thread.id}
                    className={`cp-thread${activeThreadId === thread.id ? ' active' : ''}`}
                    onClick={() => handleThreadClick(thread)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="cp-thread-icon" style={{ background: thread.iconBg }}>
                      {thread.icon}
                    </div>
                    <div className="cp-thread-info">
                      <h4>{thread.name}</h4>
                      <span>{thread.subtitle}</span>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* System — always present */}
            <div className="cp-section-title">System</div>
            <div className="cp-thread">
              <div className="cp-thread-icon" style={{ background: 'var(--bg-warm, #faf8f4)' }}>
                ⚙️
              </div>
              <div className="cp-thread-info">
                <h4>Business Setup</h4>
                <span>{selectedModuleIds.length} modules configured</span>
              </div>
            </div>
          </>
        ) : (
          /* ── Pre-setup fallback ── */
          <>
            <div className="cp-section-title">Getting Started</div>
            <div className="cp-thread active">
              <div className="cp-thread-icon" style={{ background: 'var(--accent-soft, #fde8da)' }}>
                🎯
              </div>
              <div className="cp-thread-info">
                <h4>Configure Business</h4>
                <span>Tell Viki about your business</span>
              </div>
            </div>
            <div className="cp-thread">
              <div className="cp-thread-icon" style={{ background: 'var(--bg-elevated, #f5f3ef)' }}>
                📖
              </div>
              <div className="cp-thread-info">
                <h4>Explore Modules</h4>
                <span>Browse available features</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="cp-footer">
        <button className="cp-quick-btn" onClick={onImport}>+ New</button>
        <button className="cp-quick-btn">⚙ Settings</button>
        <button className="cp-quick-btn">▤ Data</button>
      </div>
    </aside>
  );
};

export default ContextPanel;
