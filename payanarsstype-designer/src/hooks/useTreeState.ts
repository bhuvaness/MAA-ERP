import { useState, useCallback, useRef } from 'react';
import type { PTNode, NodeLevel } from '../types';
import { CHILD_LEVEL, LEVEL_ICONS, LEVEL_COLORS } from '../types';

let idCounter = 1000;
const newId = () => `node-${++idCounter}`;

const clone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

function findNode(nodes: PTNode[], id: string): PTNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function findParent(nodes: PTNode[], id: string, parent: PTNode | null = null): PTNode | null {
  for (const n of nodes) {
    if (n.id === id) return parent;
    const found = findParent(n.children, id, n);
    if (found) return found;
  }
  return null;
}

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

function countNodes(nodes: PTNode[]): number {
  let c = nodes.length;
  nodes.forEach(n => { c += countNodes(n.children); });
  return c;
}

function countByLevel(nodes: PTNode[]): Record<string, number> {
  const counts: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 };
  const walk = (arr: PTNode[]) => {
    arr.forEach(n => { counts[n.level] = (counts[n.level] || 0) + 1; walk(n.children); });
  };
  walk(nodes);
  return counts;
}

export function useTreeState() {
  const [root, setRoot] = useState<PTNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<PTNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const historyRef = useRef<PTNode[][]>([[]]);
  const historyIdxRef = useRef(0);

  const pushHistory = useCallback((newRoot: PTNode[]) => {
    const h = historyRef.current;
    historyRef.current = h.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(clone(newRoot));
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
  }, []);

  const updateRoot = useCallback((newRoot: PTNode[]) => {
    setRoot(newRoot);
    pushHistory(newRoot);
  }, [pushHistory]);

  // ── LOAD EXTERNAL DATA ──
  const loadTree = useCallback((data: PTNode[]) => {
    setRoot(data);
    historyRef.current = [clone(data)];
    historyIdxRef.current = 0;
    setIsLoading(false);
    setSelectedId(null);
  }, []);

  // ── SELECT ──
  const selectNode = useCallback((id: string | null) => { setSelectedId(id); }, []);

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
    if (!childLevel) return;
    const child: PTNode = {
      id: newId(), name: 'New Node', level: childLevel, code: '',
      typeCategory: 'Node', description: '',
      icon: LEVEL_ICONS[childLevel], color: LEVEL_COLORS[childLevel],
      children: [], expanded: false,
    };
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
      id: newId(), name: 'New Node', level: node.level, code: '',
      typeCategory: node.typeCategory, description: '',
      icon: LEVEL_ICONS[node.level], color: LEVEL_COLORS[node.level],
      children: [], expanded: false,
    };
    const parent = findParent(newRoot, nodeId);
    if (parent) {
      const idx = parent.children.findIndex(c => c.id === nodeId);
      parent.children.splice(idx + 1, 0, sibling);
    } else {
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
      id: newId(), name: 'New Module', level: 'L1', code: '',
      typeCategory: 'Root', description: '',
      icon: '📦', color: '#06B6D4',
      children: [], expanded: false,
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
    const reassignIds = (n: PTNode): PTNode => ({ ...n, id: newId(), children: n.children.map(c => reassignIds(c)) });
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

  // ── UPDATE NODE ──
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
    const reassignIds = (n: PTNode): PTNode => ({ ...n, id: newId(), children: n.children.map(c => reassignIds(c)) });
    const pasted = reassignIds(clone(clipboard));
    parent.children.push(pasted);
    parent.expanded = true;
    updateRoot(newRoot);
    setSelectedId(pasted.id);
  }, [root, clipboard, updateRoot]);

  // ── MOVE ──
  const moveNode = useCallback((dragId: string, dropId: string, position: 'before' | 'after' | 'inside') => {
    if (dragId === dropId) return;
    let newRoot = clone(root);
    const { tree, removed } = removeNode(newRoot, dragId);
    if (!removed) return;
    newRoot = tree;
    if (position === 'inside') {
      const dropNode = findNode(newRoot, dropId);
      if (!dropNode) return;
      dropNode.children.push(removed);
      dropNode.expanded = true;
    } else {
      const parent = findParent(newRoot, dropId);
      const siblings = parent ? parent.children : newRoot;
      const idx = siblings.findIndex(c => c.id === dropId);
      siblings.splice(position === 'before' ? idx : idx + 1, 0, removed);
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

  // ── EXPORT / IMPORT ──
  const exportJson = useCallback(() => JSON.stringify(root, null, 2), [root]);

  const importJson = useCallback((json: string) => {
    try { const parsed = JSON.parse(json) as PTNode[]; updateRoot(parsed); setSelectedId(null); return true; }
    catch { return false; }
  }, [updateRoot]);

  const clearTree = useCallback(() => { updateRoot([]); setSelectedId(null); }, [updateRoot]);

  const stats = {
    total: countNodes(root),
    byLevel: countByLevel(root),
  };

  return {
    root, selectedId, clipboard, searchQuery, showJson, stats, isLoading,
    setSearchQuery, setShowJson,
    selectNode, getSelected, toggleExpand,
    addChild, addSibling, addRootModule, deleteNode, duplicateNode,
    updateNode, copyNode, pasteInto, moveNode,
    undo, redo, expandAll, collapseAll,
    exportJson, importJson, clearTree, loadTree,
  };
}
