import { ChevronRight, Home } from "lucide-react";
import { PayanarssType } from "@/types/PayanarssType";

interface BreadcrumbProps {
  path: PayanarssType[];
  onNavigate: (id: string | null) => void;
}

export function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  return (
    <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-1 text-sm overflow-x-auto">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
      >
        <Home className="w-4 h-4" />
        <span>Root</span>
      </button>

      {path.map((item, index) => (
        <div key={item.Id} className="flex items-center gap-1 shrink-0">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <button
            onClick={() => onNavigate(item.Id)}
            className={
              index === path.length - 1
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground transition-colors"
            }
          >
            {item.Name}
          </button>
        </div>
      ))}
    </div>
  );
}
