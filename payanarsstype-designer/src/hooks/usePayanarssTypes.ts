import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PayanarssType, PayanarssTypeNode, ROOT_TYPE_IDS } from "@/types/PayanarssType";

/** POST updated types to Vite dev server → writes to public/data/ */
async function saveToFile(types: PayanarssType[]): Promise<void> {
    try {
        const res = await fetch("/api/save-types", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ types }),
        });
        if (!res.ok) {
            const err = await res.json();
            console.error("Save failed:", err);
        } else {
            const result = await res.json();
            console.log(`💾 Saved ${result.count} types to file`);
        }
    } catch (err) {
        console.error("Save error:", err);
    }
}

export function usePayanarssTypes() {
    const [types, setTypes] = useState<PayanarssType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    // Track whether initial load is done (skip saving on first load)
    const isLoaded = useRef(false);
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load types from JSON
    useEffect(() => {
        const loadTypes = async () => {
            try {
                const [res1, res2] = await Promise.all([
                    fetch("/data/VanakkamPayanarssTypes.json"),
                    fetch("/data/GymBusiness_PayanarssTypes.json"),
                ]);
                if (!res1.ok) throw new Error("Failed to load base types");
                const baseData: PayanarssType[] = await res1.json();
                const gymData: PayanarssType[] = res2.ok ? await res2.json() : [];
                setTypes([...baseData, ...gymData]);
                setLoading(false);
                // Mark loaded after a tick so the save effect skips initial
                setTimeout(() => { isLoaded.current = true; }, 100);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unknown error");
                setLoading(false);
            }
        };
        loadTypes();
    }, []);

    // Auto-save to file whenever types change (debounced, skip initial load)
    useEffect(() => {
        if (!isLoaded.current) return;
        if (types.length === 0) return;

        // Debounce: save 500ms after last change
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
            saveToFile(types);
        }, 500);

        return () => {
            if (saveTimeout.current) clearTimeout(saveTimeout.current);
        };
    }, [types]);

    // Build hierarchical tree from flat structure
    const buildTree = useCallback((items: PayanarssType[]): PayanarssTypeNode[] => {
        const itemMap = new Map<string, PayanarssTypeNode>();

        // Create node for each item
        items.forEach((item) => {
            itemMap.set(item.Id, { ...item, children: [], isExpanded: expandedNodes.has(item.Id) });
        });

        // Build parent-child relationships
        items.forEach((item) => {
            const node = itemMap.get(item.Id)!;

            // Add non-root nodes to their parent's children
            if (item.Id !== item.ParentId) {
                const parent = itemMap.get(item.ParentId);
                if (parent) {
                    parent.children.push(node);
                }
            }
        });

        // Return root-level Group Type records
        const GROUP_TYPE_ID = "100000000000000000000000000000004";
        const BUSINESS_USE_CASE_ID = "10000000000000000000000000000000111";
        const ROOT_TYPE_IDS_SET = new Set([GROUP_TYPE_ID, BUSINESS_USE_CASE_ID]);
        const roots = items
            .filter((t) =>
                ROOT_TYPE_IDS_SET.has(t.PayanarssTypeId) &&
                t.Id === t.ParentId &&
                !ROOT_TYPE_IDS_SET.has(t.Id)
            )
            .map((t) => itemMap.get(t.Id)!)
            .filter(Boolean);

        return roots;
    }, [expandedNodes]);

    // Get hierarchical tree (auto-updates when types change)
    const tree = useMemo(() => buildTree(types), [types, buildTree]);

    // Get children of a specific parent
    const getChildren = useCallback((parentId: string): PayanarssType[] => {
        if (!parentId) {
            return types.filter((t) => t.Id === t.ParentId);
        }
        return types.filter((t) => t.ParentId === parentId && t.Id !== t.ParentId);
    }, [types]);

    // Get a type by ID
    const getTypeById = useCallback((id: string): PayanarssType | undefined => {
        return types.find((t) => t.Id === id);
    }, [types]);

    // Get type name from type ID
    const getTypeName = useCallback((typeId: string): string => {
        const type = types.find((t) => t.Id === typeId);
        return type?.Name || "Unknown";
    }, [types]);

    // Get selectable types (root types that can be assigned as PayanarssTypeId)
    const selectableTypes = useMemo(() => {
        return types.filter((t) => t.Id === t.ParentId);
    }, [types]);

    // Toggle node expansion
    const toggleNode = useCallback((nodeId: string) => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    }, []);

    // Expand path to a specific node
    const expandPathTo = useCallback((nodeId: string) => {
        const pathIds = new Set<string>();
        let currentId = nodeId;

        while (currentId) {
            const type = types.find((t) => t.Id === currentId);
            if (!type) break;

            pathIds.add(currentId);

            if (type.ParentId === type.Id) break;
            currentId = type.ParentId;
        }

        setExpandedNodes((prev) => new Set([...prev, ...pathIds]));
    }, [types]);

    // Generate unique ID
    const generateId = useCallback((): string => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }, []);

    // Add new type → auto-saved via useEffect
    const addType = useCallback((parentId: string, name: string = "NewType"): PayanarssType => {
        const newId = generateId();
        const newType: PayanarssType = {
            Id: newId,
            ParentId: parentId || newId,
            Name: name,
            PayanarssTypeId: ROOT_TYPE_IDS.VALUE_TYPE,
            Attributes: [],
            Description: null,
        };

        setTypes((prev) => [...prev, newType]);
        return newType;
    }, [generateId]);

    // Update type → auto-saved via useEffect
    const updateType = useCallback((id: string, updates: Partial<PayanarssType>) => {
        setTypes((prev) =>
            prev.map((t) => (t.Id === id ? { ...t, ...updates } : t))
        );
    }, []);

    // Delete type and all children (every level) → auto-saved via useEffect
    const deleteType = useCallback((id: string) => {
        setTypes((prev) => {
            const idsToDelete = new Set<string>();

            const collectDescendants = (typeId: string) => {
                idsToDelete.add(typeId);
                prev
                    .filter((t) => t.ParentId === typeId && t.Id !== typeId)
                    .forEach((t) => collectDescendants(t.Id));
            };

            collectDescendants(id);
            console.log(`🗑 Deleting "${id}" + ${idsToDelete.size - 1} descendants`);
            return prev.filter((t) => !idsToDelete.has(t.Id));
        });
    }, []);

    // Delete only children (all levels), keep the parent → auto-saved via useEffect
    const deleteChildren = useCallback((parentId: string) => {
        let count = 0;
        setTypes((prev) => {
            const idsToDelete = new Set<string>();

            const collectDescendants = (typeId: string) => {
                prev
                    .filter((t) => t.ParentId === typeId && t.Id !== typeId)
                    .forEach((t) => {
                        idsToDelete.add(t.Id);
                        collectDescendants(t.Id);
                    });
            };

            collectDescendants(parentId);
            count = idsToDelete.size;
            console.log(`🗑 Deleting ${count} children of "${parentId}"`);
            return prev.filter((t) => !idsToDelete.has(t.Id));
        });
        return count;
    }, []);

    // Check if type has children
    const hasChildren = useCallback((typeId: string): boolean => {
        return types.some((t) => t.ParentId === typeId && t.Id !== typeId);
    }, [types]);

    // Count all descendants recursively
    const getDescendantCount = useCallback((typeId: string): number => {
        let count = 0;
        const collect = (id: string) => {
            types.forEach((t) => {
                if (t.ParentId === id && t.Id !== id) {
                    count++;
                    collect(t.Id);
                }
            });
        };
        collect(typeId);
        return count;
    }, [types]);

    // Check if type is of a specific base type
    const isTypeOf = useCallback((type: PayanarssType, baseTypeName: string): boolean => {
        const baseType = types.find((t) => t.Name === baseTypeName && t.Id === t.ParentId);
        return baseType ? type.PayanarssTypeId === baseType.Id : false;
    }, [types]);

    // Export types as JSON
    const exportToJson = useCallback((): string => {
        return JSON.stringify(types, null, 2);
    }, [types]);

    return {
        types,
        tree,
        loading,
        error,
        expandedNodes,
        selectableTypes,
        getChildren,
        getTypeById,
        getTypeName,
        toggleNode,
        expandPathTo,
        addType,
        updateType,
        deleteType,
        deleteChildren,
        hasChildren,
        getDescendantCount,
        isTypeOf,
        exportToJson,
    };
}