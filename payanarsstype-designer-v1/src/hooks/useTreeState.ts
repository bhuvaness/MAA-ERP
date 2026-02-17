import { useState, useCallback, useRef } from 'react';
import type { PTNode, NodeLevel } from '../types';
import { CHILD_LEVEL, LEVEL_ICONS, LEVEL_COLORS } from '../types';
import { SAMPLE_TREE } from '../data/sampleData';

let idCounter = 1000;
const newId = () => `node-${++idCounter}`;

// Deep clone helper
const clone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

// Find node by id in tree
function findNode(nodes: PTNode[], id: string): PTNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

// Find parent of node
function findParent(nodes: PTNode[], id: string, parent: PTNode | null = null): PTNode | null {
  for (const n of nodes) {
    if (n.id === id) return parent;
    const found = findParent(n.children, id, n);
    if (found) return found;
  }
  return null;
}

// Remove node by id, returns removed node
function removeNode(nodes: PTNode[], id: string): { tree: PTNode[]; removed: PTNode | null } {
  let removed: PTNode | null = null;
  const filter = (arr: PTNode[]): PTNode[] => {
    return arr.filter(n => {
      if (n.id === id) { removed = n; return false; }
      n.children = filter(n.children);
      return true;
    });
  };
  const tree = filter(clone(nodes));
  return { tree, removed };
}

// Count all nodes
function countNodes(nodes: PTNode[]): number {
  let c = nodes.length;
  nodes.forEach(n => { c += countNodes(n.children); });
  return c;
}

// Count nodes by level
function countByLevel(nodes: PTNode[]): Record<string, number> {
  const counts: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
  const walk = (arr: PTNode[]) => {
    arr.forEach(n => { counts[n.level] = (counts[n.level] || 0) + 1; walk(n.children); });
  };
  walk(nodes);
  return counts;
}

// Collect unique type categories
function collectCategories(nodes: PTNode[]): string[] {
  const set = new Set<string>();
  const walk = (arr: PTNode[]) => {
    arr.forEach(n => { if (n.typeCategory) set.add(n.typeCategory); walk(n.children); });
  };
  walk(nodes);
  return Array.from(set).sort();
}

export function useTreeState() {
  const [root, setRoot] = useState<PTNode[]>(clone(SAMPLE_TREE));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<PTNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showJson, setShowJson] = useState(false);
  const historyRef = useRef<PTNode[][]>([clone(SAMPLE_TREE)]);
  const historyIdxRef = useRef(0);

  const pushHistory = useCallback((newRoot: PTNode[]) => {
    const h = historyRef.current;
    // Trim future
    historyRef.current = h.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(clone(newRoot));
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
  }, []);

  const updateRoot = useCallback((newRoot: PTNode[]) => {
    setRoot(newRoot);
    pushHistory(newRoot);
  }, [pushHistory]);

  // ── SELECT ──
  const selectNode = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const getSelected = useCallback((): PTNode | null => {
    if (!selectedId) return null;
    return findNode(root, selectedId);
  }, [root, selectedId]);

  // ── TOGGLE EXPAND ──
  const toggleExpand = useCallback((id: string) => {
    const newRoot = clone(root);
    const node = findNode(newRoot, id);
    if (node) node.expanded = !node.expanded;
    setRoot(newRoot);
  }, [root]);

  // ── ADD CHILD ──
  const addChild = useCallback((parentId: string) => {
    const newRoot = clone(root);
    const parent = findNode(newRoot, parentId);
    if (!parent) return;
    const childLevel = CHILD_LEVEL[parent.level];
    if (!childLevel) return; // L5 can't have children

    const child: PTNode = {
      id: newId(),
      name: 'New Node',
      level: childLevel,
      code: '',
      typeCategory: childLevel === 'L4' ? 'EntityType' : 'InputType',
      description: '',
      icon: LEVEL_ICONS[childLevel],
      color: LEVEL_COLORS[childLevel],
      children: [],
      expanded: false,
    };
    if (childLevel === 'L4') { child.tableName = ''; child.entityType = 'Master'; }
    if (childLevel === 'L5') { child.columnName = ''; child.dataType = 'VARCHAR'; child.required = false; }

    parent.children.push(child);
    parent.expanded = true;
    updateRoot(newRoot);
    setSelectedId(child.id);
  }, [root, updateRoot]);

  // ── ADD SIBLING ──
  const addSibling = useCallback((nodeId: string) => {
    const newRoot = clone(root);
    const node = findNode(newRoot, nodeId);
    if (!node) return;

    const sibling: PTNode = {
      id: newId(),
      name: 'New Node',
      level: node.level,
      code: '',
      typeCategory: node.typeCategory,
      description: '',
      icon: LEVEL_ICONS[node.level],
      color: LEVEL_COLORS[node.level],
      children: [],
      expanded: false,
    };
    if (node.level === 'L4') { sibling.tableName = ''; sibling.entityType = 'Master'; }
    if (node.level === 'L5') { sibling.columnName = ''; sibling.dataType = 'VARCHAR'; sibling.required = false; }

    const parent = findParent(newRoot, nodeId);
    if (parent) {
      const idx = parent.children.findIndex(c => c.id === nodeId);
      parent.children.splice(idx + 1, 0, sibling);
    } else {
      // Root level
      const idx = newRoot.findIndex(c => c.id === nodeId);
      newRoot.splice(idx + 1, 0, sibling);
    }
    updateRoot(newRoot);
    setSelectedId(sibling.id);
  }, [root, updateRoot]);

  // ── ADD ROOT MODULE ──
  const addRootModule = useCallback(() => {
    const newRoot = clone(root);
    const mod: PTNode = {
      id: newId(),
      name: 'New Module',
      level: 'L1',
      code: '',
      typeCategory: 'ModuleType',
      description: '',
      icon: '📦',
      color: '#06B6D4',
      children: [],
      expanded: false,
    };
    newRoot.push(mod);
    updateRoot(newRoot);
    setSelectedId(mod.id);
  }, [root, updateRoot]);

  // ── DELETE ──
  const deleteNode = useCallback((id: string) => {
    const { tree } = removeNode(root, id);
    updateRoot(tree);
    if (selectedId === id) setSelectedId(null);
  }, [root, selectedId, updateRoot]);

  // ── DUPLICATE ──
  const duplicateNode = useCallback((id: string) => {
    const newRoot = clone(root);
    const node = findNode(newRoot, id);
    if (!node) return;

    const reassignIds = (n: PTNode): PTNode => {
      const copy = { ...n, id: newId(), children: n.children.map(c => reassignIds(c)) };
      return copy;
    };
    const dup = reassignIds(clone(node));
    dup.name = `${dup.name} (copy)`;

    const parent = findParent(newRoot, id);
    if (parent) {
      const idx = parent.children.findIndex(c => c.id === id);
      parent.children.splice(idx + 1, 0, dup);
    } else {
      const idx = newRoot.findIndex(c => c.id === id);
      newRoot.splice(idx + 1, 0, dup);
    }
    updateRoot(newRoot);
    setSelectedId(dup.id);
  }, [root, updateRoot]);

  // ── UPDATE NODE PROPERTIES ──
  const updateNode = useCallback((id: string, updates: Partial<PTNode>) => {
    const newRoot = clone(root);
    const node = findNode(newRoot, id);
    if (!node) return;
    Object.assign(node, updates);
    updateRoot(newRoot);
  }, [root, updateRoot]);

  // ── COPY / PASTE ──
  const copyNode = useCallback((id: string) => {
    const node = findNode(root, id);
    if (node) setClipboard(clone(node));
  }, [root]);

  const pasteInto = useCallback((parentId: string) => {
    if (!clipboard) return;
    const newRoot = clone(root);
    const parent = findNode(newRoot, parentId);
    if (!parent) return;
    const childLevel = CHILD_LEVEL[parent.level];
    if (!childLevel || childLevel !== clipboard.level) return;

    const reassignIds = (n: PTNode): PTNode => ({ ...n, id: newId(), children: n.children.map(c => reassignIds(c)) });
    const pasted = reassignIds(clone(clipboard));
    parent.children.push(pasted);
    parent.expanded = true;
    updateRoot(newRoot);
    setSelectedId(pasted.id);
  }, [root, clipboard, updateRoot]);

  // ── MOVE (drag-drop) ──
  const moveNode = useCallback((dragId: string, dropId: string, position: 'before' | 'after' | 'inside') => {
    if (dragId === dropId) return;
    let newRoot = clone(root);

    // Remove dragged node
    const { tree, removed } = removeNode(newRoot, dragId);
    if (!removed) return;
    newRoot = tree;

    if (position === 'inside') {
      const dropNode = findNode(newRoot, dropId);
      if (!dropNode) return;
      const childLevel = CHILD_LEVEL[dropNode.level];
      if (!childLevel) return;
      removed.level = childLevel;
      dropNode.children.push(removed);
      dropNode.expanded = true;
    } else {
      const parent = findParent(newRoot, dropId);
      const siblings = parent ? parent.children : newRoot;
      const idx = siblings.findIndex(c => c.id === dropId);
      const insertIdx = position === 'before' ? idx : idx + 1;
      siblings.splice(insertIdx, 0, removed);
    }
    updateRoot(newRoot);
  }, [root, updateRoot]);

  // ── UNDO / REDO ──
  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    setRoot(clone(historyRef.current[historyIdxRef.current]));
  }, []);

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    setRoot(clone(historyRef.current[historyIdxRef.current]));
  }, []);

  // ── EXPAND / COLLAPSE ALL ──
  const expandAll = useCallback(() => {
    const newRoot = clone(root);
    const walk = (arr: PTNode[]) => { arr.forEach(n => { n.expanded = true; walk(n.children); }); };
    walk(newRoot);
    setRoot(newRoot);
  }, [root]);

  const collapseAll = useCallback(() => {
    const newRoot = clone(root);
    const walk = (arr: PTNode[]) => { arr.forEach(n => { n.expanded = false; walk(n.children); }); };
    walk(newRoot);
    setRoot(newRoot);
  }, [root]);

  // ── IMPORT / EXPORT ──
  const exportJson = useCallback(() => {
    return JSON.stringify(root, null, 2);
  }, [root]);

  const importJson = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as PTNode[];
      updateRoot(parsed);
      setSelectedId(null);
      return true;
    } catch { return false; }
  }, [updateRoot]);

  // ── LOAD NEW (clear) ──
  const clearTree = useCallback(() => {
    const empty: PTNode[] = [];
    updateRoot(empty);
    setSelectedId(null);
  }, [updateRoot]);

  // ── STATS ──
  const stats = {
    total: countNodes(root),
    byLevel: countByLevel(root),
    categories: collectCategories(root),
  };

  return {
    root, selectedId, clipboard, searchQuery, showJson, stats,
    setSearchQuery, setShowJson,
    selectNode, getSelected, toggleExpand,
    addChild, addSibling, addRootModule, deleteNode, duplicateNode,
    updateNode, copyNode, pasteInto, moveNode,
    undo, redo, expandAll, collapseAll,
    exportJson, importJson, clearTree,
  };
}
