import { FolderTree } from "lucide-react";
import { PayanarssType } from "@/types/PayanarssType";
import { TreeNode } from "./TreeNode";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TreeSidebarProps {
  selectedId: string | null;
  expandedNodes: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  hasChildren: (id: string) => boolean;
  getChildren: (parentId: string) => PayanarssType[];
  onDelete: (id: string) => void;
}

export function TreeSidebar({
  selectedId,
  expandedNodes,
  onSelect,
  onToggle,
  hasChildren,
  getChildren,
  onDelete,
}: TreeSidebarProps) {
  // Get root nodes: getChildren("") — matches PHP getChildren("")
  let roots: PayanarssType[] = [];
  if (typeof getChildren === "function") {
    try {
      const result = getChildren("");
      roots = Array.isArray(result) ? result : [];
    } catch (err) {
      console.error("Error loading root nodes:", err);
      roots = [];
    }
  }

  return (
    <aside className="w-80 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm text-sidebar-foreground">
            Table Designs
          </h2>
          <span className="text-xs text-muted-foreground ml-auto">
            {roots.length} roots
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="py-2">
          {roots.map((node) => (
            <TreeNode
              key={node.Id}
              node={node}
              level={0}
              selectedId={selectedId}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggle={onToggle}
              hasChildren={hasChildren}
              getChildren={getChildren}
              onDelete={onDelete}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
