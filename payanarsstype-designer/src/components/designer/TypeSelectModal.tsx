import { useState } from "react";
import { X, Search, Check } from "lucide-react";
import { PayanarssType, ROOT_TYPE_IDS } from "@/types/PayanarssType";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface TypeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (typeId: string) => void;
  types: PayanarssType[];
  currentTypeId: string;
  title?: string;
}

// Base type IDs that should always appear pinned at the top
const ROOT_TYPE_ID_SET = new Set(Object.values(ROOT_TYPE_IDS));

export function TypeSelectModal({
  isOpen,
  onClose,
  onSelect,
  types,
  currentTypeId,
  title = "Select Type",
}: TypeSelectModalProps) {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const q = search.toLowerCase().trim();

  // Split into base types (pinned) and all others
  const baseTypes = types.filter((t) => ROOT_TYPE_ID_SET.has(t.Id));
  const otherTypes = types.filter((t) => !ROOT_TYPE_ID_SET.has(t.Id));

  const filterFn = (t: PayanarssType) =>
    !q ||
    t.Name.toLowerCase().includes(q) ||
    t.Id.toLowerCase().includes(q) ||
    (t.Description || "").toLowerCase().includes(q);

  const filteredBase = baseTypes.filter(filterFn);
  const filteredOther = otherTypes.filter(filterFn);

  const handleSelect = (typeId: string) => {
    onSelect(typeId);
    onClose();
    setSearch("");
  };

  const renderItem = (type: PayanarssType) => (
    <button
      key={type.Id}
      onClick={() => handleSelect(type.Id)}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm transition-colors gap-2",
        type.Id === currentTypeId
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted"
      )}
    >
      <div className="flex flex-col min-w-0">
        <span className="font-medium truncate">{type.Name}</span>
        {type.Description && (
          <span className="text-xs text-muted-foreground truncate">
            {type.Description.slice(0, 60)}
          </span>
        )}
      </div>
      {type.Id === currentTypeId && (
        <Check className="w-4 h-4 text-primary flex-shrink-0" />
      )}
    </button>
  );

  const totalShown = filteredBase.length + filteredOther.length;

  return (
    <div className="fixed inset-0 bg-foreground/40 flex justify-center items-center z-50">
      <div className="bg-card rounded-lg shadow-2xl w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">📘 {title}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {totalShown.toLocaleString()} type{totalShown !== 1 ? "s" : ""}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Type List */}
        <ScrollArea className="h-80">
          <div className="p-2">
            {totalShown === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No types found for "{search}"
              </div>
            ) : (
              <>
                {/* Base types — always pinned at top */}
                {filteredBase.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Base Types
                    </div>
                    {filteredBase.map(renderItem)}
                    {filteredOther.length > 0 && (
                      <div className="my-2 border-t border-border" />
                    )}
                  </>
                )}

                {/* All other types */}
                {filteredOther.length > 0 && (
                  <>
                    {!q && (
                      <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        All Types ({filteredOther.length.toLocaleString()})
                      </div>
                    )}
                    {filteredOther.map(renderItem)}
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
