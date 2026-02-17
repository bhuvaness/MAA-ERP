import { FolderTree } from "lucide-react";
import { PayanarssTypeNode } from "@/types/PayanarssType";
import { TreeNode } from "./TreeNode";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TreeSidebarProps {
  tree: PayanarssTypeNode[];
  selectedId: string | null;
  expandedNodes: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  hasChildren: (id: string) => boolean;
}

export function TreeSidebar({
  tree,
  selectedId,
  expandedNodes,
  onSelect,
  onToggle,
  hasChildren,
}: TreeSidebarProps) {
  return (
    <aside className="w-80 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      {/* Sidebar Header */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm text-sidebar-foreground">
            Table Designs
          </h2>
          <span className="text-xs text-muted-foreground ml-auto">
            {tree.length} roots
          </span>
        </div>
      </div>

      {/* Tree View */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {tree.map((node) => (
            <TreeNode
              key={node.Id}
              node={node}
              level={0}
              selectedId={selectedId}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggle={onToggle}
              hasChildren={hasChildren}
            />
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
