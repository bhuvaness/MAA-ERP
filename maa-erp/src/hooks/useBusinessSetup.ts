/**
 * useBusinessSetup Hook
 * =====================
 * Manages the entire "Set up my business" wizard state:
 *   - Loads PayanarssType data on mount
 *   - Builds hierarchy index
 *   - Tracks navigation stack (drill-down / back)
 *   - Tracks user selections (checkboxes)
 *   - Provides computed values for the current view
 *
 * State Machine:
 *   LOADING → READY → NAVIGATING (drill in/out) → CONFIRMING → DONE
 *
 * Navigation Model:
 *   The wizard uses a STACK-based navigation. Each drill-down pushes
 *   a node onto the stack. "Back" pops the stack. The current view
 *   always shows children of the top-of-stack node.
 *
 *   Stack: [root] → [root, Manufacturing] → [root, Manufacturing, Food & Bev Mfg]
 *   Back:  [root, Manufacturing, Food & Bev Mfg] → [root, Manufacturing] → [root]
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { PayanarssType, TYPE_IDS } from "../types/PayanarssType";
import {
  fetchAllTypes,
  saveBusinessConfig,
  loadBusinessConfig,
} from "../services/payanarssTypeService";
import {
  HierarchyIndex,
  buildHierarchyIndex,
  getChildren,
  getNodeById,
  getAncestorPath,
  getDescendantCount,
  hasChildren as nodeHasChildren,
  searchByName,
} from "../utils/hierarchyBuilder";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type WizardPhase =
  | "loading"    // Fetching data
  | "welcome"    // "Set up my business" landing
  | "browsing"   // Drill-down navigation
  | "review"     // Review selections before confirming
  | "complete";  // Setup finished

export interface BusinessSetupState {
  // ── Data ──
  phase: WizardPhase;
  loading: boolean;
  error: string | null;
  index: HierarchyIndex | null;

  // ── Navigation ──
  /** Stack of node IDs representing the drill-down path */
  navigationStack: string[];
  /** The node whose children are currently displayed */
  currentParent: PayanarssType | null;
  /** Children of currentParent (what the UI renders) */
  currentChildren: PayanarssType[];
  /** Breadcrumb path (ancestor chain of currentParent) */
  breadcrumb: PayanarssType[];
  /** Search query */
  searchQuery: string;
  /** Filtered children (after search) */
  filteredChildren: PayanarssType[];

  // ── Selections ──
  /** Set of selected node IDs */
  selectedIds: Set<string>;
  /** Count of selected items */
  selectedCount: number;

  // ── Actions ──
  /** Navigate into a node (show its children) */
  drillInto: (nodeId: string) => void;
  /** Navigate back one level */
  goBack: () => void;
  /** Navigate to a specific breadcrumb level */
  goToBreadcrumb: (index: number) => void;
  /** Start the wizard */
  startSetup: () => void;
  /** Toggle selection of a node */
  toggleSelection: (nodeId: string) => void;
  /** Select all visible children */
  selectAll: () => void;
  /** Deselect all visible children */
  deselectAll: () => void;
  /** Move to review phase */
  goToReview: () => void;
  /** Confirm and save */
  confirmSetup: () => Promise<void>;
  /** Go back from review to browsing */
  backToSelection: () => void;
  /** Set search query */
  setSearchQuery: (q: string) => void;
  /** Get descendant count for a node */
  getDescendants: (nodeId: string) => number;
  /** Check if a node has children */
  hasChildren: (nodeId: string) => boolean;
  /** Get selected items grouped by parent for review */
  getSelectedGrouped: () => Map<string, PayanarssType[]>;
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useBusinessSetup(): BusinessSetupState {
  // ── Core State ──
  const [phase, setPhase] = useState<WizardPhase>("loading");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState<HierarchyIndex | null>(null);
  const [allTypes, setAllTypes] = useState<PayanarssType[]>([]);

  // ── Navigation ──
  const [navigationStack, setNavigationStack] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Selections ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ═══════════════════════════════════════════════════
  // INITIALIZATION — Load data, build index
  // ═══════════════════════════════════════════════════

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoading(true);

        // 1. Fetch all types
        const types = await fetchAllTypes();
        if (!mounted) return;

        // 2. Build hierarchy index
        const hierarchyIndex = buildHierarchyIndex(types);
        if (!mounted) return;

        setAllTypes(types);
        setIndex(hierarchyIndex);

        // 3. Check for existing configuration
        const existingConfig = await loadBusinessConfig();
        if (existingConfig && existingConfig.length > 0) {
          setSelectedIds(new Set(existingConfig));
          setPhase("complete");
        } else {
          setPhase("welcome");
        }

        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load data");
        setPhase("welcome");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();
    return () => { mounted = false; };
  }, []);

  // ═══════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════

  /**
   * Current parent node — the node whose children we're viewing.
   * If stack is empty, we're at root level.
   */
  const currentParent = useMemo(() => {
    if (!index || navigationStack.length === 0) return null;
    const topId = navigationStack[navigationStack.length - 1];
    return getNodeById(index, topId) || null;
  }, [index, navigationStack]);

  /**
   * Children of current parent — what the UI renders as cards/list.
   * At root level: show top-level children of the system root.
   *
   * IMPORTANT: We find the system root (MAA ERP) and show ITS children,
   * not the root node itself. Users see Industries + Common Modules.
   */
  const currentChildren = useMemo(() => {
    if (!index) return [];

    if (navigationStack.length === 0) {
      // Root level: show children of the system root
      // The system root is the one self-referencing node (Id === ParentId)
      if (index.roots.length === 1) {
        return getChildren(index, index.roots[0].Id);
      }
      // Multiple roots (shouldn't happen, but handle gracefully)
      return index.roots;
    }

    const topId = navigationStack[navigationStack.length - 1];
    return getChildren(index, topId);
  }, [index, navigationStack]);

  /**
   * Filtered children — after applying search query.
   */
  const filteredChildren = useMemo(() => {
    if (!searchQuery.trim()) return currentChildren;

    const lower = searchQuery.toLowerCase();
    return currentChildren.filter((c) =>
      c.Name.toLowerCase().includes(lower) ||
      (c.Description && c.Description.toLowerCase().includes(lower))
    );
  }, [currentChildren, searchQuery]);

  /**
   * Breadcrumb path — for "Root > Manufacturing > Food & Bev" navigation.
   */
  const breadcrumb = useMemo(() => {
    if (!index || navigationStack.length === 0) return [];

    const topId = navigationStack[navigationStack.length - 1];
    return getAncestorPath(index, topId);
  }, [index, navigationStack]);

  // ═══════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════

  /** Start the wizard from welcome screen */
  const startSetup = useCallback(() => {
    setPhase("browsing");
    setNavigationStack([]); // Start at root
    setSearchQuery("");
  }, []);

  /**
   * Drill into a node — push it onto the navigation stack.
   * This shows the node's children in the main view.
   */
  const drillInto = useCallback(
    (nodeId: string) => {
      if (!index) return;

      // Only drill if the node has children
      if (!nodeHasChildren(index, nodeId)) return;

      setNavigationStack((prev) => [...prev, nodeId]);
      setSearchQuery(""); // Reset search on navigation
    },
    [index]
  );

  /** Go back one level — pop the navigation stack */
  const goBack = useCallback(() => {
    setNavigationStack((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1);
    });
    setSearchQuery("");
  }, []);

  /** Jump to a specific breadcrumb level */
  const goToBreadcrumb = useCallback(
    (breadcrumbIndex: number) => {
      if (breadcrumbIndex < 0) {
        // "Root" clicked — go to top level
        setNavigationStack([]);
      } else if (breadcrumb[breadcrumbIndex]) {
        // Find this node in the navigation stack and slice to it
        const targetId = breadcrumb[breadcrumbIndex].Id;
        setNavigationStack((prev) => {
          const idx = prev.indexOf(targetId);
          if (idx >= 0) return prev.slice(0, idx + 1);
          return prev;
        });
      }
      setSearchQuery("");
    },
    [breadcrumb]
  );

  /** Toggle selection of a node */
  const toggleSelection = useCallback((nodeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  /** Select all currently visible children */
  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const child of filteredChildren) {
        next.add(child.Id);
      }
      return next;
    });
  }, [filteredChildren]);

  /** Deselect all currently visible children */
  const deselectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const child of filteredChildren) {
        next.delete(child.Id);
      }
      return next;
    });
  }, [filteredChildren]);

  /** Move to review phase */
  const goToReview = useCallback(() => {
    setPhase("review");
  }, []);

  /** Back from review to browsing */
  const backToSelection = useCallback(() => {
    setPhase("browsing");
  }, []);

  /** Confirm and save the business configuration */
  const confirmSetup = useCallback(async () => {
    try {
      await saveBusinessConfig(Array.from(selectedIds));
      setPhase("complete");
    } catch (err) {
      setError("Failed to save configuration");
    }
  }, [selectedIds]);

  /** Get descendant count for a node */
  const getDescendants = useCallback(
    (nodeId: string) => {
      if (!index) return 0;
      return getDescendantCount(index, nodeId);
    },
    [index]
  );

  /** Check if a node has children */
  const hasChildrenFn = useCallback(
    (nodeId: string) => {
      if (!index) return false;
      return nodeHasChildren(index, nodeId);
    },
    [index]
  );

  /**
   * Get selected items grouped by their parent.
   * Used in the review screen to show selections organized.
   */
  const getSelectedGrouped = useCallback(() => {
    const grouped = new Map<string, PayanarssType[]>();
    if (!index) return grouped;

    for (const id of selectedIds) {
      const node = getNodeById(index, id);
      if (!node) continue;

      const parentNode = getNodeById(index, node.ParentId);
      const groupKey = parentNode ? parentNode.Name : "Other";

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(node);
    }

    return grouped;
  }, [index, selectedIds]);

  // ═══════════════════════════════════════════════════
  // RETURN
  // ═══════════════════════════════════════════════════

  return {
    phase,
    loading,
    error,
    index,
    navigationStack,
    currentParent,
    currentChildren,
    breadcrumb,
    searchQuery,
    filteredChildren,
    selectedIds,
    selectedCount: selectedIds.size,
    drillInto,
    goBack,
    goToBreadcrumb,
    startSetup,
    toggleSelection,
    selectAll,
    deselectAll,
    goToReview,
    confirmSetup,
    backToSelection,
    setSearchQuery,
    getDescendants,
    hasChildren: hasChildrenFn,
    getSelectedGrouped,
  };
}
