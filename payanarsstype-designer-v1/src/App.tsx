import React, { useCallback, useEffect } from 'react';
import { useTreeState } from './hooks/useTreeState';
import Toolbar from './components/Toolbar';
import TreePanel from './components/TreePanel';
import PropertiesPanel from './components/PropertiesPanel';
import JsonPreview from './components/JsonPreview';
import './styles/designer.css';

const App: React.FC = () => {
  const tree = useTreeState();
  const selectedNode = tree.getSelected();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); tree.undo(); }
        if (e.key === 'y') { e.preventDefault(); tree.redo(); }
        if (e.key === 'c' && tree.selectedId) { tree.copyNode(tree.selectedId); }
        if (e.key === 'v' && tree.selectedId) { tree.pasteInto(tree.selectedId); }
        if (e.key === 'd' && tree.selectedId) { e.preventDefault(); tree.duplicateNode(tree.selectedId); }
      }
      if (e.key === 'Delete' && tree.selectedId) {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
        tree.deleteNode(tree.selectedId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tree]);

  // Export handler
  const handleExport = useCallback(() => {
    const json = tree.exportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payanarss-types.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [tree]);

  // Import handler
  const handleImport = useCallback((json: string) => {
    const ok = tree.importJson(json);
    if (!ok) alert('Invalid JSON file');
  }, [tree]);

  return (
    <div className="designer-app">
      <Toolbar
        stats={tree.stats}
        showJson={tree.showJson}
        canPaste={!!tree.clipboard}
        selectedId={tree.selectedId}
        onAddModule={tree.addRootModule}
        onAddChild={() => tree.selectedId && tree.addChild(tree.selectedId)}
        onAddSibling={() => tree.selectedId && tree.addSibling(tree.selectedId)}
        onDelete={() => tree.selectedId && tree.deleteNode(tree.selectedId)}
        onDuplicate={() => tree.selectedId && tree.duplicateNode(tree.selectedId)}
        onCopy={() => tree.selectedId && tree.copyNode(tree.selectedId)}
        onPaste={() => tree.selectedId && tree.pasteInto(tree.selectedId)}
        onUndo={tree.undo}
        onRedo={tree.redo}
        onExpandAll={tree.expandAll}
        onCollapseAll={tree.collapseAll}
        onToggleJson={() => tree.setShowJson(!tree.showJson)}
        onExport={handleExport}
        onImport={handleImport}
        onClear={tree.clearTree}
      />

      <div className="designer-body">
        <TreePanel
          root={tree.root}
          selectedId={tree.selectedId}
          searchQuery={tree.searchQuery}
          onSearchChange={tree.setSearchQuery}
          onSelect={tree.selectNode}
          onToggle={tree.toggleExpand}
          onAddChild={tree.addChild}
          onDelete={tree.deleteNode}
          onMove={tree.moveNode}
          onAddModule={tree.addRootModule}
        />

        <PropertiesPanel
          node={selectedNode}
          onUpdate={tree.updateNode}
          onAddChild={tree.addChild}
          onDuplicate={tree.duplicateNode}
          onDelete={tree.deleteNode}
        />

        {tree.showJson && (
          <JsonPreview root={tree.root} selectedId={tree.selectedId} />
        )}
      </div>
    </div>
  );
};

export default App;
