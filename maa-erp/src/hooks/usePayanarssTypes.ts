import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { PayanarssType, PayanarssTypeNode, ROOT_TYPE_IDS } from "@/types/PayanarssType";

// ─── VALIDATION TYPES ───

export interface ValidationReport {
    duplicateIds: string[];
    orphanNodes: PayanarssType[];
    circularRefs: string[];
    valid: boolean;
    totalNodes: number;
    rootCount: number;
}

// ─── SAVE TO FILE ───

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

// ─── VALIDATION UTILITIES ───

/**
 * Detect duplicate Ids in a dataset.
 */
function findDuplicateIds(items: PayanarssType[]): string[] {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const item of items) {
        if (seen.has(item.Id)) {
            dupes.push(item.Id);
        }
        seen.add(item.Id);
    }
    return dupes;
}

/**
 * Detect circular references by walking up the parent chain.
 * If we visit the same node twice, there's a cycle.
 */
function findCircularRefs(items: PayanarssType[]): string[] {
    const idMap = new Map<string, PayanarssType>();
    items.forEach((t) => idMap.set(t.Id, t));

    const circular: string[] = [];
    const verified = new Set<string>(); // known non-circular

    for (const item of items) {
        if (verified.has(item.Id)) continue;
        if (item.Id === item.ParentId) {
            verified.add(item.Id);
            continue;
        }

        const visited = new Set<string>();
        let current: string | undefined = item.Id;

        while (current) {
            if (visited.has(current)) {
                circular.push(item.Id);
                break;
            }
            if (verified.has(current)) break;
            visited.add(current);
            const node = idMap.get(current);
            if (!node) break;
            if (node.Id === node.ParentId) break;
            current = node.ParentId;
        }

        if (!circular.includes(item.Id)) {
            visited.forEach((id) => verified.add(id));
        }
    }

    return circular;
}

// ─── MAIN HOOK ───

export function usePayanarssTypes() {
    const [types, setTypes] = useState<PayanarssType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * Wrapper: update types state AND schedule a debounced save to file.
     * Only called by mutation functions (add/update/delete/import).
     * NOT called on initial load — so no infinite reload loop.
     */
    const setTypesAndSave = useCallback(
        (updater: (prev: PayanarssType[]) => PayanarssType[]) => {
            setTypes((prev) => {
                const next = updater(prev);

                if (saveTimeout.current) clearTimeout(saveTimeout.current);
                saveTimeout.current = setTimeout(() => {
                    saveToFile(next);
                }, 500);

                return next;
            });
        },
        []
    );

    // ─── LOAD TYPES FROM JSON ───

    useEffect(() => {
        const loadTypes = async () => {
            try {
                const safeFetch = async (url: string): Promise<PayanarssType[]> => {
                    try {
                        const res = await fetch(url);
                        if (!res.ok) {
                            console.warn(`⚠️ ${url} returned ${res.status}`);
                            return [];
                        }
                        const contentType = res.headers.get("content-type") || "";
                        if (contentType.includes("text/html")) {
                            console.warn(`⚠️ ${url} returned HTML instead of JSON — file may be missing`);
                            return [];
                        }
                        const text = await res.text();
                        if (!text.trim() || text.trim() === "[]") {
                            console.warn(`⚠️ ${url} is empty`);
                            return [];
                        }
                        return JSON.parse(text);
                    } catch (err) {
                        console.warn(`⚠️ Failed to load ${url}:`, err);
                        return [];
                    }
                };

                const loaded = await safeFetch("/data/VanakkamPayanarssTypes.json");

                // Deduplicate by Id — first occurrence wins
                const idSet = new Set<string>();
                const combined: PayanarssType[] = [];
                for (const item of loaded) {
                    if (!idSet.has(item.Id)) {
                        idSet.add(item.Id);
                        combined.push(item);
                    }
                }

                if (combined.length === 0) {
                    setError(
                        "No types found. Check that public/data/VanakkamPayanarssTypes.json exists and contains valid JSON."
                    );
                    setLoading(false);
                    return;
                }

                // Validate on load
                const dupes = findDuplicateIds(combined);
                if (dupes.length > 0) {
                    console.warn(`⚠️ ${dupes.length} duplicate IDs detected on load`);
                }

                const circulars = findCircularRefs(combined);
                if (circulars.length > 0) {
                    console.warn(`⚠️ ${circulars.length} circular references detected on load`);
                }

                const allIds = new Set(combined.map((t) => t.Id));
                const orphans = combined.filter(
                    (t) => t.Id !== t.ParentId && !allIds.has(t.ParentId)
                );
                if (orphans.length > 0) {
                    console.warn(
                        `⚠️ ${orphans.length} orphan nodes detected on load:`,
                        orphans.map((n) => `${n.Name} (ParentId: ${n.ParentId})`)
                    );
                }

                setTypes(combined);
                setLoading(false);
            } catch (err) {
                console.error("Load failed:", err);
                setError(err instanceof Error ? err.message : "Unknown error");
                setLoading(false);
            }
        };
        loadTypes();
    }, []);

    // ─── BUILD TREE: pure Id → ParentId, only GroupType at root ───

    const GROUP_TYPE_ID = ROOT_TYPE_IDS.GROUP_TYPE; // "100000000000000000000000000000004"

    const buildTree = useCallback(
        (items: PayanarssType[]): PayanarssTypeNode[] => {
            const itemMap = new Map<string, PayanarssTypeNode>();
            const rawMap = new Map<string, PayanarssType>();
            const allIds = new Set<string>();

            // Phase 1: Create all nodes
            items.forEach((item) => {
                allIds.add(item.Id);
                rawMap.set(item.Id, item);
                itemMap.set(item.Id, {
                    ...item,
                    children: [],
                    isExpanded: expandedNodes.has(item.Id),
                });
            });

            // Phase 2: Find nearest valid ancestor for orphan nodes
            // Walks up the ParentId chain until it finds an existing node or gives up
            const findNearestAncestor = (
                parentId: string,
                visited: Set<string>
            ): string | null => {
                let current = parentId;
                while (current) {
                    if (visited.has(current)) return null; // circular ref
                    visited.add(current);
                    if (allIds.has(current)) return current; // found valid ancestor
                    // ParentId doesn't exist — can't walk further
                    return null;
                }
                return null;
            };

            // Phase 3: Attach children to parents using Id → ParentId
            items.forEach((item) => {
                // Skip self-referencing roots
                if (item.Id === item.ParentId) return;

                let parent = itemMap.get(item.ParentId);

                // If direct parent missing, try nearest valid ancestor
                if (!parent) {
                    const visited = new Set<string>([item.Id]);
                    const ancestorId = findNearestAncestor(item.ParentId, visited);
                    if (ancestorId) {
                        parent = itemMap.get(ancestorId);
                        if (parent) {
                            console.warn(
                                `⚠️ Orphan recovery: "${item.Name}" attached to nearest ancestor "${parent.Name}" (original ParentId ${item.ParentId} not found)`
                            );
                        }
                    }
                }

                if (parent) {
                    parent.children.push(itemMap.get(item.Id)!);
                }
            });

            // Phase 4: Determine visible roots
            // RULE: Only GroupType nodes (PayanarssTypeId === GROUP_TYPE_ID) appear at root level
            const roots = items
                .filter((t) => {
                    const isTopLevel = t.Id === t.ParentId || !allIds.has(t.ParentId);
                    if (!isTopLevel) return false;
                    // Root-level filter: only GroupType
                    return t.PayanarssTypeId === ROOT_TYPE_IDS.BUSINESS_SOLUTIONS;
                })
                .map((t) => itemMap.get(t.Id)!)
                .filter(Boolean);

            return roots;
        },
        [expandedNodes, GROUP_TYPE_ID]
    );

    const tree = useMemo(() => buildTree(types), [types, buildTree]);

    // ─── GETTERS ───

    const getChildren = useCallback(
        (parentId: string): PayanarssType[] => {
            if (!parentId) {
                // Root level: only GroupType nodes
                const allIds = new Set(types.map((t) => t.Id));
                return types.filter(
                    (t) =>
                        (t.Id === t.ParentId || !allIds.has(t.ParentId)) &&
                        t.PayanarssTypeId === ROOT_TYPE_IDS.BUSINESS_SOLUTIONS
                );
            }
            return types.filter(
                (t) => t.ParentId === parentId && t.Id !== parentId
            );
        },
        [types, GROUP_TYPE_ID]
    );

    const getTypeById = useCallback(
        (id: string): PayanarssType | undefined => {
            return types.find((t) => t.Id === id);
        },
        [types]
    );

    const getTypeName = useCallback(
        (typeId: string): string => {
            const type = types.find((t) => t.Id === typeId);
            return type?.Name || "Unknown";
        },
        [types]
    );

    const selectableTypes = useMemo(() => {
        const allIds = new Set(types.map((t) => t.Id));
        return types.filter(
            (t) =>
                (t.Id === t.ParentId || !allIds.has(t.ParentId)) &&
                t.PayanarssTypeId === ROOT_TYPE_IDS.BUSINESS_SOLUTIONS
        );
    }, [types, GROUP_TYPE_ID]);

    // ─── EXPAND / COLLAPSE ───

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

    const expandPathTo = useCallback(
        (nodeId: string) => {
            const pathIds = new Set<string>();
            let currentId = nodeId;
            const visited = new Set<string>(); // circular ref safety

            while (currentId) {
                if (visited.has(currentId)) break;
                visited.add(currentId);

                const type = types.find((t) => t.Id === currentId);
                if (!type) break;
                pathIds.add(currentId);
                if (type.ParentId === type.Id) break;
                currentId = type.ParentId;
            }

            setExpandedNodes((prev) => new Set([...prev, ...pathIds]));
        },
        [types]
    );

    // ─── ID GENERATION ───

    const generateId = useCallback((): string => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }, []);

    // ─── MUTATIONS: all use setTypesAndSave (saves to file) ───

    const addType = useCallback(
        (
            parentId: string,
            name: string = "NewType",
            options?: { description?: string; payanarssTypeId?: string }
        ): PayanarssType => {
            const newId = generateId();
            const newType: PayanarssType = {
                Id: newId,
                ParentId: parentId || newId,
                Name: name,
                PayanarssTypeId: options?.payanarssTypeId || ROOT_TYPE_IDS.VALUE_TYPE,
                Attributes: [],
                Description: options?.description || null,
            };
            setTypesAndSave((prev) => [...prev, newType]);
            return newType;
        },
        [generateId, setTypesAndSave]
    );

    const updateType = useCallback(
        (id: string, updates: Partial<PayanarssType>) => {
            setTypesAndSave((prev) =>
                prev.map((t) => (t.Id === id ? { ...t, ...updates } : t))
            );
        },
        [setTypesAndSave]
    );

    const deleteType = useCallback(
        (id: string) => {
            setTypesAndSave((prev) => {
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
        },
        [setTypesAndSave]
    );

    const deleteChildren = useCallback(
        (parentId: string) => {
            let count = 0;
            setTypesAndSave((prev) => {
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
        },
        [setTypesAndSave]
    );

    // ─── IMPORT: trust the JSON hierarchy as-is, replace existing nodes ───
    const importTypes = useCallback(
        (incoming: PayanarssType[], replaceChildrenOf?: string): number => {
            if (!incoming.length) return 0;

            let importedCount = 0;

            setTypesAndSave((prev) => {
                let base = prev;

                if (replaceChildrenOf) {
                    // Delete all descendants of parent (tree walk)
                    const idsToDelete = new Set<string>();
                    const collect = (typeId: string) => {
                        base.filter((t) => t.ParentId === typeId && t.Id !== typeId)
                            .forEach((t) => { idsToDelete.add(t.Id); collect(t.Id); });
                    };
                    collect(replaceChildrenOf);

                    // ALSO delete orphan nodes with empty ParentId (broken leftover data)
                    base.forEach((t) => {
                        if (t.ParentId === "" && t.Id !== t.ParentId) {
                            idsToDelete.add(t.Id);
                        }
                    });

                    base = base.filter((t) => !idsToDelete.has(t.Id));
                    console.log(`🗑 Removed ${idsToDelete.size} old nodes (descendants + orphans)`);
                }

                // Remove any nodes with matching IDs (for re-uploads)
                const incomingIds = new Set(incoming.map((t) => t.Id));
                base = base.filter((t) => !incomingIds.has(t.Id));

                importedCount = incoming.length;
                console.log(`📥 Import: adding ${incoming.length} nodes`);
                return [...base, ...incoming];
            });

            return importedCount;
        },
        [setTypesAndSave]
    );


    // ─── READ-ONLY HELPERS ───

    const hasChildren = useCallback(
        (typeId: string): boolean => {
            return types.some((t) => t.ParentId === typeId && t.Id !== typeId);
        },
        [types]
    );

    const getDescendantCount = useCallback(
        (typeId: string): number => {
            let count = 0;
            const visited = new Set<string>(); // circular ref safety
            const collect = (id: string) => {
                if (visited.has(id)) return;
                visited.add(id);
                types.forEach((t) => {
                    if (t.ParentId === id && t.Id !== id) {
                        count++;
                        collect(t.Id);
                    }
                });
            };
            collect(typeId);
            return count;
        },
        [types]
    );

    const isTypeOf = useCallback(
        (type: PayanarssType, baseTypeName: string): boolean => {
            const baseType = types.find(
                (t) => t.Name === baseTypeName && t.Id === t.ParentId
            );
            return baseType ? type.PayanarssTypeId === baseType.Id : false;
        },
        [types]
    );

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
        importTypes,
        hasChildren,
        getDescendantCount,
        isTypeOf,
        exportToJson,
    };
}
