import { ChevronRight, Folder, FileType2 } from "lucide-react";
import { PayanarssTypeNode } from "@/types/PayanarssType";
import { cn } from "@/lib/utils";

interface TreeNodeProps {
  node: PayanarssTypeNode;
  level: number;
  selectedId: string | null;
  expandedNodes: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  hasChildren: (id: string) => boolean;
}

export function TreeNode({
  node,
  level,
  selectedId,
  expandedNodes,
  onSelect,
  onToggle,
  hasChildren,
}: TreeNodeProps) {
  const isExpanded = expandedNodes.has(node.Id);
  const isSelected = selectedId === node.Id;
  const nodeHasChildren = hasChildren(node.Id);
  const isRoot = node.Id === node.ParentId;

  return (
    <div className="animate-fade-in">
      <div
        className={cn(
          "tree-node flex items-center gap-1.5 select-none",
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
            "w-4 h-4 flex items-center justify-center rounded transition-transform duration-150",
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
        {isRoot ? (
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
      </div>

      {/* Children */}
      {isExpanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.Id}
              node={child}
              level={level + 1}
              selectedId={selectedId}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggle={onToggle}
              hasChildren={hasChildren}
            />
          ))}
        </div>
      )}
    </div>
  );
}
