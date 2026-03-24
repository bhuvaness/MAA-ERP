import type { PayanarssType } from "../../src/types/core";

export interface PayanarssTypeNode extends PayanarssType {
  children: PayanarssTypeNode[];
  level: number;
  childCount: number;
}

export interface HierarchyIndex {
  byId: Map<string, PayanarssType>;
  childrenOf: Map<string, PayanarssType[]>;
  roots: PayanarssType[];
  totalCount: number;
  descendantCount: Map<string, number>;
}

export function buildHierarchyIndex(types: PayanarssType[]): HierarchyIndex {
  const byId = new Map<string, PayanarssType>();
  const childrenOf = new Map<string, PayanarssType[]>();
  const roots: PayanarssType[] = [];
  for (const t of types) { byId.set(t.Id, t); }
  for (const t of types) {
    if (t.Id === t.ParentId) { roots.push(t); }
    else {
      const siblings = childrenOf.get(t.ParentId);
      if (siblings) { siblings.push(t); } else { childrenOf.set(t.ParentId, [t]); }
    }
  }
  const descendantCount = new Map<string, number>();
  function countDescendants(nodeId: string): number {
    const cached = descendantCount.get(nodeId);
    if (cached !== undefined) return cached;
    const children = childrenOf.get(nodeId) || [];
    let count = children.length;
    for (const child of children) { count += countDescendants(child.Id); }
    descendantCount.set(nodeId, count);
    return count;
  }
  for (const t of types) { countDescendants(t.Id); }
  return { byId, childrenOf, roots, totalCount: types.length, descendantCount };
}

export function getChildren(index: HierarchyIndex, parentId: string): PayanarssType[] {
  return index.childrenOf.get(parentId) || [];
}

export function getNodeById(index: HierarchyIndex, id: string): PayanarssType | undefined {
  return index.byId.get(id);
}

export function getAncestorPath(index: HierarchyIndex, nodeId: string): PayanarssType[] {
  const path: PayanarssType[] = [];
  let currentId: string | null = nodeId;
  while (currentId) {
    const node = index.byId.get(currentId);
    if (!node) break;
    path.unshift(node);
    if (node.Id === node.ParentId) break;
    currentId = node.ParentId;
  }
  return path;
}

export function getDescendantCount(index: HierarchyIndex, nodeId: string): number {
  return index.descendantCount.get(nodeId) || 0;
}

export function hasChildren(index: HierarchyIndex, nodeId: string): boolean {
  const children = index.childrenOf.get(nodeId);
  return !!children && children.length > 0;
}

export function getChildrenByType(index: HierarchyIndex, parentId: string, typeId: string): PayanarssType[] {
  return getChildren(index, parentId).filter((t) => t.PayanarssTypeId === typeId);
}

export function searchByName(index: HierarchyIndex, query: string, parentId?: string): PayanarssType[] {
  const lower = query.toLowerCase();
  if (parentId) {
    const results: PayanarssType[] = [];
    const searchSubtree = (pid: string) => {
      const children = getChildren(index, pid);
      for (const child of children) {
        if (child.Name.toLowerCase().includes(lower)) { results.push(child); }
        searchSubtree(child.Id);
      }
    };
    searchSubtree(parentId);
    return results;
  }
  const results: PayanarssType[] = [];
  index.byId.forEach((node) => {
    if (node.Name.toLowerCase().includes(lower)) { results.push(node); }
  });
  return results;
}
