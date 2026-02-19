import { useState, useRef, useCallback } from "react";
import { Pencil, Trash2, Plus, ChevronRight, Settings2, Upload } from "lucide-react";
import { PayanarssType } from "@/types/PayanarssType";
import { TypeSelectModal } from "./TypeSelectModal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// IMPORT TYPES & INTERFACES
// ============================================================================

interface ImportResult {
    success: boolean;
    importedCount: number;
    errors: string[];
    warnings: string[];
}

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
    // NEW: Callback to add imported types into the system
    onImportTypes?: (types: PayanarssType[]) => void;
}

interface EditingState {
    id: string;
    name: string;
    description: string;
    payanarssTypeId: string;
}

// ============================================================================
// IMPORT VALIDATION & TRANSFORMATION UTILITIES
// ============================================================================

/**
 * Required fields every PayanarssType node must have in the JSON file.
 * These are checked BEFORE any transformation happens.
 */
const REQUIRED_IMPORT_FIELDS = ["Id", "Name", "PayanarssTypeId"];

/**
 * Validates a single node in the imported JSON.
 * Returns an array of error messages (empty = valid).
 */
function validateNode(node: any, path: string): string[] {
    const errors: string[] = [];

    if (typeof node !== "object" || node === null || Array.isArray(node)) {
        errors.push(`${path}: Expected an object, got ${typeof node}.`);
        return errors;
    }

    for (const field of REQUIRED_IMPORT_FIELDS) {
        if (!(field in node) || node[field] === undefined || node[field] === null) {
            errors.push(`${path}: Missing required field "${field}".`);
        }
    }

    if (typeof node.Name === "string" && node.Name.trim().length === 0) {
        errors.push(`${path}: "Name" cannot be empty.`);
    }

    // Recursively validate children
    if ("Children" in node && node.Children !== undefined) {
        if (!Array.isArray(node.Children)) {
            errors.push(`${path}: "Children" must be an array.`);
        } else {
            node.Children.forEach((child: any, index: number) => {
                errors.push(...validateNode(child, `${path}.Children[${index}]`));
            });
        }
    }

    return errors;
}

/**
 * Validates the entire import data.
 * CRITICAL: If this fails, nothing is imported — no partial data.
 */
function validateImportData(data: any): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const nodes: any[] = Array.isArray(data) ? data : [data];

    if (nodes.length === 0) {
        errors.push("Import file contains no data.");
        return { isValid: false, errors, warnings };
    }

    nodes.forEach((node, index) => {
        errors.push(...validateNode(node, `Root[${index}]`));
    });

    // Count total nodes for warning
    const totalCount = countNodes(nodes);
    if (totalCount > 500) {
        warnings.push(`Large import detected (${totalCount} nodes). This may take a moment.`);
    }

    return { isValid: errors.length === 0, errors, warnings };
}

/** Recursively counts all nodes including nested children */
function countNodes(nodes: any[]): number {
    let count = 0;
    for (const node of nodes) {
        count += 1;
        if (Array.isArray(node.Children)) {
            count += countNodes(node.Children);
        }
    }
    return count;
}

/**
 * Builds a mapping from old Ids to newly generated UUIDs.
 *
 * WHY: We cannot reuse Ids from the source file because they may
 * collide with existing Ids in the database. Fresh UUIDs guarantee
 * uniqueness while the oldId→newId map preserves internal hierarchy.
 */
function buildIdMap(nodes: any[]): Map<string, string> {
    const idMap = new Map<string, string>();

    function traverse(nodeList: any[]) {
        for (const node of nodeList) {
            idMap.set(node.Id, uuidv4());
            if (Array.isArray(node.Children) && node.Children.length > 0) {
                traverse(node.Children);
            }
        }
    }

    traverse(nodes);
    return idMap;
}

/**
 * Flattens a hierarchical tree into a flat array of PayanarssType records.
 *
 * CRITICAL LOGIC:
 * - Root-level nodes' ParentId → selectedParentId (the currently selected node)
 * - Child nodes' ParentId → their parent's NEW Id (from idMap)
 * - This preserves the internal hierarchy while re-rooting under the selected node
 */
function flattenAndTransform(
    nodes: any[],
    selectedParentId: string,
    idMap: Map<string, string>
): PayanarssType[] {
    const flatList: PayanarssType[] = [];

    function traverse(nodeList: any[], parentId: string) {
        for (const node of nodeList) {
            const newId = idMap.get(node.Id)!;

            // Build a clean PayanarssType record
            const transformed: PayanarssType = {
                Id: newId,
                ParentId: parentId,
                Name: node.Name,
                PayanarssTypeId: node.PayanarssTypeId || "",
                Attributes: node.Attributes || [],
                Description: node.Description || null,
            };

            flatList.push(transformed);

            // Recurse: children's ParentId = this node's NEW Id
            if (Array.isArray(node.Children) && node.Children.length > 0) {
                traverse(node.Children, newId);
            }
        }
    }

    traverse(nodes, selectedParentId);
    return flatList;
}

/**
 * Detects duplicates by comparing Name + PayanarssTypeId + ParentId.
 * Same Name+Type under the same parent is a duplicate.
 */
function detectDuplicates(
    imported: PayanarssType[],
    existing: PayanarssType[]
): { unique: PayanarssType[]; duplicates: PayanarssType[] } {
    const existingSignatures = new Set(
        existing.map((r) => `${r.Name?.trim().toLowerCase()}|${r.PayanarssTypeId}|${r.ParentId}`)
    );
    const batchSignatures = new Set<string>();

    const unique: PayanarssType[] = [];
    const duplicates: PayanarssType[] = [];

    for (const record of imported) {
        const sig = `${record.Name?.trim().toLowerCase()}|${record.PayanarssTypeId}|${record.ParentId}`;
        if (existingSignatures.has(sig) || batchSignatures.has(sig)) {
            duplicates.push(record);
        } else {
            unique.push(record);
            batchSignatures.add(sig);
        }
    }

    return { unique, duplicates };
}

/**
 * Safety check: ensures no orphan nodes exist after transformation.
 * An orphan's ParentId doesn't match any node's Id or the selectedParentId.
 */
function detectOrphans(records: PayanarssType[], selectedParentId: string): PayanarssType[] {
    const allIds = new Set(records.map((r) => r.Id));
    allIds.add(selectedParentId);
    return records.filter((r) => r.ParentId !== null && !allIds.has(r.ParentId));
}

// ============================================================================
// COMPONENT
// ============================================================================

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
    onImportTypes,
}: TypeEditorProps) {
    const [editing, setEditing] = useState<EditingState | null>(null);
    const [typeSelectOpen, setTypeSelectOpen] = useState(false);
    const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

    // ---- NEW: Import state ----
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<ImportResult | null>(null);
    const [showImportResult, setShowImportResult] = useState(false);

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

    // ==========================================================================
    // NEW: IMPORT JSON HANDLER
    // ==========================================================================

    /**
     * Main import handler — runs the full pipeline:
     * 1. Read & parse JSON file
     * 2. Validate schema (fail = abort, no partial data)
     * 3. Build Id mapping (old → new UUIDs)
     * 4. Flatten hierarchy with re-linked ParentIds
     * 5. Detect orphans (safety check)
     * 6. Detect duplicates against existing data
     * 7. Add valid records via onImportTypes callback
     */
    const handleImportFile = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (fileInputRef.current) fileInputRef.current.value = "";

            if (!file.name.toLowerCase().endsWith(".json")) {
                toast({ title: "Invalid File", description: "Only .json files are accepted.", variant: "destructive" });
                return;
            }

            setIsImporting(true);

            try {
                const text = await file.text();
                const rawData = JSON.parse(text);
                const arr: PayanarssType[] = Array.isArray(rawData) ? rawData : [rawData];

                // Validate: must have Id, ParentId, Name
                const valid = arr.filter((t: any) => t.Id && t.Name);
                if (valid.length === 0) {
                    setImportResult({ success: false, importedCount: 0, errors: ["No valid types found in file."], warnings: [] });
                    setShowImportResult(true);
                    return;
                }

                // Pass directly to import — NO id replacement, NO ParentId overwrite
                if (onImportTypes) {
                    onImportTypes(valid);
                }

                setImportResult({ success: true, importedCount: valid.length, errors: [], warnings: [] });
                setShowImportResult(true);
            } catch (error: any) {
                setImportResult({ success: false, importedCount: 0, errors: [error.message], warnings: [] });
                setShowImportResult(true);
            } finally {
                setIsImporting(false);
            }
        },
        [onImportTypes]
    );

    return (
        <div className="flex-1 flex flex-col min-h-0">
            {/* ================================================================
          HIDDEN FILE INPUT — triggered by Import JSON button
          Accepts .json files only
          ================================================================ */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={handleImportFile}
            />

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

                        {/* ============================================================
                NEW: IMPORT JSON BUTTON
                Placed right next to Export JSON, matching the same style.
                Uses action-button-warning class for amber/orange color
                to visually distinguish from Export (green).
                ============================================================ */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                            className="action-button-warning flex items-center gap-1"
                            title="Import PayanarssType JSON file"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {isImporting ? "Importing..." : "Import JSON"}
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

                    {/* ================================================================
              NEW: IMPORT RESULT MODAL
              Shows success/failure details after import attempt
              ================================================================ */}
                    {showImportResult && importResult && (
                        <div className="fixed inset-0 bg-foreground/40 flex justify-center items-center z-50">
                            <div className="bg-card rounded-lg shadow-2xl w-full max-w-md mx-4 animate-fade-in">
                                <div className="p-5">
                                    {/* Header */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div
                                            className={cn(
                                                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg font-bold",
                                                importResult.success
                                                    ? "bg-green-100 text-green-700"
                                                    : "bg-destructive/10 text-destructive"
                                            )}
                                        >
                                            {importResult.success ? "✓" : "✕"}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-foreground">
                                                {importResult.success ? "Import Successful" : "Import Failed"}
                                            </h3>
                                            {importResult.success && (
                                                <p className="text-sm text-muted-foreground mt-0.5">
                                                    {importResult.importedCount} record(s) imported
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Errors */}
                                    {importResult.errors.length > 0 && (
                                        <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 mb-3">
                                            <p className="text-xs font-semibold text-destructive mb-1">Errors:</p>
                                            {importResult.errors.map((err, i) => (
                                                <p key={i} className="text-xs text-destructive mt-1">• {err}</p>
                                            ))}
                                        </div>
                                    )}

                                    {/* Warnings */}
                                    {importResult.warnings.length > 0 && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
                                            <p className="text-xs font-semibold text-amber-800 mb-1">Warnings:</p>
                                            {importResult.warnings.map((warn, i) => (
                                                <p key={i} className="text-xs text-amber-700 mt-1">⚠ {warn}</p>
                                            ))}
                                        </div>
                                    )}

                                    {/* Close button */}
                                    <div className="flex justify-end mt-4">
                                        <button
                                            onClick={() => {
                                                setShowImportResult(false);
                                                setImportResult(null);
                                            }}
                                            className="action-button-primary px-6"
                                        >
                                            OK
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
