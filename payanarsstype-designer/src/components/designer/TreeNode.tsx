import { useState } from "react";
import { ChevronRight, Folder, FileType2, Trash2 } from "lucide-react";
import { PayanarssType } from "@/types/PayanarssType";
import { cn } from "@/lib/utils";

interface TreeNodeProps {
  node: PayanarssType;
  level: number;
  selectedId: string | null;
  expandedNodes: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  hasChildren: (id: string) => boolean;
  getChildren: (parentId: string) => PayanarssType[];
  onDelete: (id: string) => void;
}

export function TreeNode({
  node,
  level,
  selectedId,
  expandedNodes,
  onSelect,
  onToggle,
  hasChildren: hasChildrenFn,
  getChildren: getChildrenFn,
  onDelete,
}: TreeNodeProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  // Safety: if node is somehow null/undefined, render nothing
  if (!node || !node.Id) return null;

  const isExpanded = expandedNodes?.has(node.Id) ?? false;
  const isSelected = selectedId === node.Id;
  const nodeHasChildren = hasChildrenFn ? hasChildrenFn(node.Id) : false;
  const isFolder = node.Id === node.ParentId || nodeHasChildren;

  // Lazy load children ONLY when expanded
  let children: PayanarssType[] = [];
  if (isExpanded && nodeHasChildren && typeof getChildrenFn === "function") {
    try {
      const result = getChildrenFn(node.Id);
      children = Array.isArray(result) ? result : [];
    } catch (err) {
      console.error(`Error loading children for "${node.Name}":`, err);
      children = [];
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeHasChildren) {
      setShowConfirm(true);
    } else {
      onDelete(node.Id);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "tree-node group flex items-center gap-1.5 select-none pr-2",
          isSelected && "tree-node-active"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {/* Expand/Collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (nodeHasChildren) onToggle(node.Id);
          }}
          className={cn(
            "w-4 h-4 flex items-center justify-center rounded transition-transform duration-150 shrink-0",
            nodeHasChildren ? "hover:bg-secondary" : "invisible"
          )}
        >
          <ChevronRight
            className={cn(
              "w-3 h-3 text-muted-foreground transition-transform duration-150",
              isExpanded && "rotate-90"
            )}
          />
        </button>

        {/* Icon */}
        {isFolder ? (
          <Folder className="w-4 h-4 text-primary shrink-0" />
        ) : (
          <FileType2 className="w-4 h-4 text-muted-foreground shrink-0" />
        )}

        {/* Name */}
        <span
          onClick={() => onSelect(node.Id)}
          className={cn(
            "flex-1 truncate text-sm cursor-pointer",
            isSelected ? "text-primary font-medium" : "text-foreground"
          )}
        >
          {node.Name}
        </span>

        {/* Delete button */}
        <button
          onClick={handleDeleteClick}
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-destructive/20 transition-all shrink-0"
          title={`Delete ${node.Name}`}
        >
          <Trash2 className="w-3 h-3 text-destructive" />
        </button>
      </div>

      {/* Confirm delete */}
      {showConfirm && (
        <div
          className="flex items-center gap-2 py-1.5 px-3 bg-destructive/10 border-y border-destructive/20 text-xs"
          style={{ paddingLeft: `${level * 12 + 28}px` }}
        >
          <span className="text-destructive font-medium truncate flex-1">
            Delete "{node.Name}" + all children?
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.Id);
              setShowConfirm(false);
            }}
            className="px-2 py-0.5 rounded bg-destructive text-destructive-foreground font-medium hover:opacity-90 shrink-0"
          >
            Yes, delete
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowConfirm(false);
            }}
            className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 shrink-0"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Children — lazy loaded via getChildren(node.Id) */}
      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.Id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggle={onToggle}
              hasChildren={hasChildrenFn}
              getChildren={getChildrenFn}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
