import { useState } from "react";
import { Pencil, Trash2, Plus, ChevronRight, Settings2 } from "lucide-react";
import { PayanarssType } from "@/types/PayanarssType";
import { TypeSelectModal } from "./TypeSelectModal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface TypeEditorProps {
  parentType: PayanarssType | null;
  children: PayanarssType[];
  selectableTypes: PayanarssType[];
  getTypeName: (id: string) => string;
  onAddType: () => void;
  onEditType: (type: PayanarssType) => void;
  onDeleteType: (id: string) => void;
  onDeleteChildren: () => void;
  onNavigateToChildren: (id: string) => void;
  isTypeOf: (type: PayanarssType, baseTypeName: string) => boolean;
}

interface EditingState {
  id: string;
  name: string;
  description: string;
  payanarssTypeId: string;
}

export function TypeEditor({
  parentType,
  children,
  selectableTypes,
  getTypeName,
  onAddType,
  onEditType,
  onDeleteType,
  onDeleteChildren,
  onNavigateToChildren,
  isTypeOf,
}: TypeEditorProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [typeSelectOpen, setTypeSelectOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const startEditing = (type: PayanarssType) => {
    setEditing({
      id: type.Id,
      name: type.Name,
      description: type.Description || "",
      payanarssTypeId: type.PayanarssTypeId,
    });
  };

  const saveEditing = () => {
    if (!editing) return;
    onEditType({
      Id: editing.id,
      ParentId: "", // Will be ignored
      Name: editing.name,
      PayanarssTypeId: editing.payanarssTypeId,
      Attributes: [],
      Description: editing.description || null,
    });
    setEditing(null);
  };

  const cancelEditing = () => {
    setEditing(null);
  };

  const canHaveChildren = (type: PayanarssType): boolean => {
    return (
      isTypeOf(type, "GroupType") ||
      isTypeOf(type, "TableType") ||
      isTypeOf(type, "ChildTableType") ||
      isTypeOf(type, "LookupType")
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Table Container */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          {/* Table Title */}
          <div className="px-4 py-3 border-b border-border bg-muted">
            <h3 className="font-semibold text-foreground">
              {parentType?.Name || "Payanarss Type Designer"}
            </h3>
          </div>

          {/* Action Bar */}
          <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center gap-2">
            <button
              onClick={onAddType}
              className="action-button-primary flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Type
            </button>
            <button
              onClick={() => {
                const json = JSON.stringify(children, null, 2);
                const blob = new Blob([json], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${parentType?.Name || "types"}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="action-button-success flex items-center gap-1"
            >
              Export JSON
            </button>
            {parentType && children.length > 0 && (
              <button
                onClick={() => setConfirmDeleteAll(true)}
                className="action-button-destructive flex items-center gap-1 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete All Children ({children.length})
              </button>
            )}
          </div>

          {/* Confirm Delete All Children Modal */}
          {confirmDeleteAll && (
            <div className="fixed inset-0 bg-foreground/40 flex justify-center items-center z-50">
              <div className="bg-card rounded-lg shadow-2xl w-full max-w-sm mx-4 animate-fade-in">
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5 text-destructive" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Delete All Children</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">This cannot be undone</p>
                    </div>
                  </div>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 mb-4">
                    <p className="text-sm text-foreground">
                      Delete all <strong>{children.length}</strong> children of <strong>"{parentType?.Name}"</strong> and
                      their descendants at every level?
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setConfirmDeleteAll(false)}
                      className="px-4 py-2 rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onDeleteChildren();
                        setConfirmDeleteAll(false);
                      }}
                      className="px-4 py-2 rounded-md text-sm font-medium bg-destructive text-destructive-foreground hover:opacity-90 transition-colors"
                    >
                      Delete All
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-border bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <div className="col-span-3">Name</div>
            <div className="col-span-4">Description</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-3">Actions</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border">
            {children.length === 0 ? (
              <div className="px-4 py-12 text-center text-muted-foreground text-sm">
                No types defined. Click "Add Type" to create one.
              </div>
            ) : (
              children.map((type) => {
                const isEditing = editing?.id === type.Id;

                return (
                  <div
                    key={type.Id}
                    className={cn(
                      "grid grid-cols-12 gap-4 px-4 py-3 items-center transition-colors",
                      isEditing && "bg-primary/5"
                    )}
                  >
                    {/* Name */}
                    <div className="col-span-3">
                      {isEditing ? (
                        <Input
                          value={editing.name}
                          onChange={(e) =>
                            setEditing({ ...editing, name: e.target.value })
                          }
                          className="h-8 text-sm"
                        />
                      ) : (
                        <span className="text-sm font-medium">{type.Name}</span>
                      )}
                    </div>

                    {/* Description */}
                    <div className="col-span-4">
                      {isEditing ? (
                        <Textarea
                          value={editing.description}
                          onChange={(e) =>
                            setEditing({ ...editing, description: e.target.value })
                          }
                          rows={2}
                          className="text-sm resize-none"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {type.Description || "—"}
                        </span>
                      )}
                    </div>

                    {/* Type */}
                    <div className="col-span-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-sm truncate">
                            {getTypeName(editing.payanarssTypeId)}
                          </span>
                          <button
                            onClick={() => setTypeSelectOpen(true)}
                            className="action-button-primary text-xs px-2"
                          >
                            Select
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {getTypeName(type.PayanarssTypeId)}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 flex items-center gap-1 flex-wrap">
                      {isEditing ? (
                        <>
                          <button
                            onClick={saveEditing}
                            className="action-button-success"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="action-button-secondary"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {canHaveChildren(type) && (
                            <button
                              onClick={() => onNavigateToChildren(type.Id)}
                              className="action-button-accent flex items-center gap-0.5"
                            >
                              <Plus className="w-3 h-3" />
                              Children
                            </button>
                          )}
                          <button
                            onClick={() => startEditing(type)}
                            className="action-button-warning"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this type?")) {
                                onDeleteType(type.Id);
                              }
                            }}
                            className="action-button-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Type Select Modal */}
      {editing && (
        <TypeSelectModal
          isOpen={typeSelectOpen}
          onClose={() => setTypeSelectOpen(false)}
          onSelect={(typeId) =>
            setEditing({ ...editing, payanarssTypeId: typeId })
          }
          types={selectableTypes}
          currentTypeId={editing.payanarssTypeId}
        />
      )}
    </div>
  );
}
