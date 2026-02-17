import React, { useMemo, useState } from 'react';
import type { PTNode } from '../types';

interface Props {
  root: PTNode[];
  selectedId: string | null;
}

// Find node by id
function findNode(nodes: PTNode[], id: string): PTNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

const JsonPreview: React.FC<Props> = ({ root, selectedId }) => {
  const [viewMode, setViewMode] = useState<'full' | 'selected'>('selected');
  const [copied, setCopied] = useState(false);

  const jsonData = useMemo(() => {
    if (viewMode === 'selected' && selectedId) {
      const node = findNode(root, selectedId);
      return node ? JSON.stringify(node, null, 2) : '// Select a node';
    }
    return JSON.stringify(root, null, 2);
  }, [root, selectedId, viewMode]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonData);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'payanarss-types.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="json-panel">
      <div className="json-header">
        <div className="json-header-title">{'{ }'} JSON Output</div>
        <div className="json-header-actions">
          <button className={`json-tab${viewMode === 'selected' ? ' active' : ''}`} onClick={() => setViewMode('selected')}>Selected</button>
          <button className={`json-tab${viewMode === 'full' ? ' active' : ''}`} onClick={() => setViewMode('full')}>Full Tree</button>
          <div className="json-divider" />
          <button className="json-action-btn" onClick={handleCopy}>{copied ? '✓ Copied' : '📋 Copy'}</button>
          <button className="json-action-btn" onClick={handleDownload}>↓ Download</button>
        </div>
      </div>
      <div className="json-scroll">
        <pre className="json-code">{jsonData}</pre>
      </div>
    </div>
  );
};

export default JsonPreview;
