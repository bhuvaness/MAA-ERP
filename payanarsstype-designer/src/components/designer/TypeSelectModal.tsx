import { useState } from "react";
import { X, Search, Check } from "lucide-react";
import { PayanarssType } from "@/types/PayanarssType";
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

  const filteredTypes = types.filter((t) =>
    t.Name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (typeId: string) => {
    onSelect(typeId);
    onClose();
    setSearch("");
  };

  return (
    <div className="fixed inset-0 bg-foreground/40 flex justify-center items-center z-50">
      <div className="bg-card rounded-lg shadow-2xl w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">📘 {title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Type List */}
        <ScrollArea className="max-h-64">
          <div className="p-2">
            {filteredTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No types found
              </div>
            ) : (
              filteredTypes.map((type) => (
                <button
                  key={type.Id}
                  onClick={() => handleSelect(type.Id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-left text-sm transition-colors",
                    type.Id === currentTypeId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted"
                  )}
                >
                  <span>{type.Name}</span>
                  {type.Id === currentTypeId && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
