import { useState, useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { usePayanarssTypes } from "@/hooks/usePayanarssTypes";
import { PayanarssType, ROOT_TYPE_IDS } from "@/types/PayanarssType";
import { Header } from "./designer/Header";
import { TreeSidebar } from "./designer/TreeSidebar";
import { TypeEditor } from "./designer/TypeEditor";
import { AIPromptBar } from "./designer/AIPromptBar";
import { Breadcrumb } from "./designer/Breadcrumb";
import { toast } from "@/hooks/use-toast";
import { generateTypes, GeneratedField } from "@/services/aiService";

export function PayanarssTypeDesigner() {
    const {
        types,
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
    } = usePayanarssTypes();

    // Current selected/active parent ID (what's shown in main content)
    const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

    // Get current parent type
    const currentParent = useMemo(() => {
        return selectedParentId ? getTypeById(selectedParentId) : null;
    }, [selectedParentId, getTypeById]);

    // Get children of current parent
    const currentChildren = useMemo(() => {
        if (!selectedParentId) {
            // Show root types
            return types.filter((t) => t.Id === t.ParentId);
        }
        return getChildren(selectedParentId);
    }, [selectedParentId, types, getChildren]);

    // Build breadcrumb path
    const breadcrumbPath = useMemo(() => {
        const path: PayanarssType[] = [];
        let currentId = selectedParentId;

        while (currentId) {
            const type = getTypeById(currentId);
            if (!type) break;

            path.unshift(type);

            if (type.Id === type.ParentId) break; // Root reached
            currentId = type.ParentId;
        }

        return path;
    }, [selectedParentId, getTypeById]);

    // Handle selecting a node from the tree
    const handleTreeSelect = useCallback(
        (id: string) => {
            setSelectedParentId(id);
            expandPathTo(id);
        },
        [expandPathTo]
    );

    // Handle navigating to children from the table
    const handleNavigateToChildren = useCallback(
        (id: string) => {
            setSelectedParentId(id);
            expandPathTo(id);
        },
        [expandPathTo]
    );

    // Handle breadcrumb navigation
    const handleBreadcrumbNavigate = useCallback((id: string | null) => {
        setSelectedParentId(id);
    }, []);

    // Handle adding new type
    const handleAddType = useCallback(() => {
        const parentId = selectedParentId || "";
        const newType = addType(parentId, "NewType");
        toast({
            title: "Type Created",
            description: `New type "${newType.Name}" has been created.`,
        });
    }, [selectedParentId, addType]);

    // Handle editing type
    const handleEditType = useCallback(
        (updates: Partial<PayanarssType> & { Id: string }) => {
            updateType(updates.Id, updates);
            toast({
                title: "Type Updated",
                description: "Changes have been saved.",
            });
        },
        [updateType]
    );

    // Handle deleting type
    const handleDeleteType = useCallback(
        (id: string) => {
            deleteType(id);
            if (selectedParentId === id) {
                setSelectedParentId(null);
            }
            toast({
                title: "Type Deleted",
                description: "The type and its children have been removed.",
                variant: "destructive",
            });
        },
        [deleteType, selectedParentId]
    );

    // Handle importing types from uploaded JSON
    const handleImportTypes = useCallback(
        (incoming: PayanarssType[]) => {
            const count = importTypes(incoming, selectedParentId || undefined);
            toast({
                title: "JSON Imported",
                description: `Added ${count} types with original hierarchy.`,
            });
        },
        [selectedParentId, importTypes]
    );

    // Handle deleting all children of current parent
    const handleDeleteChildren = useCallback(() => {
        if (!selectedParentId) return;
        const count = deleteChildren(selectedParentId);
        toast({
            title: "Children Deleted",
            description: `Removed ${count} descendant${count !== 1 ? "s" : ""} from "${currentParent?.Name}".`,
            variant: "destructive",
        });
    }, [selectedParentId, deleteChildren, currentParent?.Name]);

    // Handle AI prompt - calls the Lovable AI gateway
    const handleAIGenerate = useCallback(
        async (prompt: string): Promise<GeneratedField[]> => {
            return await generateTypes(prompt, currentParent?.Name);
        },
        [currentParent?.Name]
    );

    // Handle generated fields from AI
    const handleFieldsGenerated = useCallback(
        (fields: GeneratedField[]) => {
            const parentId = selectedParentId || "";
            let createdCount = 0;

            // Map AI type names to actual PayanarssTypeId values
            const typeNameToId: Record<string, string> = {
                GroupType: ROOT_TYPE_IDS.GROUP_TYPE,
                TableType: ROOT_TYPE_IDS.TABLE_TYPE,
                ChildTableType: ROOT_TYPE_IDS.CHILD_TABLE_TYPE,
                LookupType: ROOT_TYPE_IDS.LOOKUP_TYPE,
                ValueType: ROOT_TYPE_IDS.VALUE_TYPE,
                AttributeType: ROOT_TYPE_IDS.ATTRIBUTE_TYPE,
            };

            fields.forEach((field) => {
                const payanarssTypeId = typeNameToId[field.type] || ROOT_TYPE_IDS.VALUE_TYPE;
                addType(parentId, field.name, {
                    description: field.description,
                    payanarssTypeId,
                });
                createdCount++;
            });

            toast({
                title: "Types Generated by Claude AI",
                description: `Created ${createdCount} new type${createdCount !== 1 ? "s" : ""}.`,
            });
        },
        [selectedParentId, addType]
    );

    // Navigate home
    const handleNavigateHome = useCallback(() => {
        setSelectedParentId(null);
    }, []);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading types...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-destructive mb-2">
                        Error Loading Data
                    </h2>
                    <p className="text-muted-foreground">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Header */}
            <Header onNavigateHome={handleNavigateHome} />

            {/* Main Layout */}
            <div className="flex-1 flex min-h-0">
                {/* Left Sidebar - Tree Navigation */}
                <TreeSidebar
                    selectedId={selectedParentId}
                    expandedNodes={expandedNodes}
                    onSelect={handleTreeSelect}
                    onToggle={toggleNode}
                    hasChildren={hasChildren}
                    getChildren={getChildren}
                    onDelete={handleDeleteType}
                />

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col min-h-0 min-w-0">
                    {/* Breadcrumb */}
                    <Breadcrumb
                        path={breadcrumbPath}
                        onNavigate={handleBreadcrumbNavigate}
                    />

                    {/* Type Editor */}
                    <TypeEditor
                        parentType={currentParent || null}
                        children={currentChildren}
                        selectableTypes={selectableTypes}
                        getTypeName={getTypeName}
                        onAddType={handleAddType}
                        onEditType={handleEditType}
                        onDeleteType={handleDeleteType}
                        onImportTypes={handleImportTypes}
                        onDeleteChildren={handleDeleteChildren}
                        onNavigateToChildren={handleNavigateToChildren}
                        isTypeOf={isTypeOf}
                    />

                    {/* AI Prompt Bar - Fixed at bottom of main content */}
                    <AIPromptBar
                        onGenerate={handleAIGenerate}
                        onFieldsGenerated={handleFieldsGenerated}
                        parentName={currentParent?.Name}
                    />
                </main>
            </div>
        </div>
    );
}
