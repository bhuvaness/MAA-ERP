import React from 'react';
import type { ContextInfo } from '../types';

interface Props {
  context: ContextInfo;
  onImport: () => void;
}

const ContextPanel: React.FC<Props> = ({ context, onImport }) => {
  return (
    <aside className="context-panel">
      <div className="cp-header">
        <div className="cp-brand">
          <div className="cp-logo">M</div>
          <div className="cp-brand-text">
            <h2>MAA Platform</h2>
            <span>Powered by Viki AI</span>
          </div>
        </div>
        <div className="cp-context">
          <div className="cp-context-label">★ Current Context</div>
          <div className="cp-context-value">{context.value}</div>
          <div className="cp-context-path">{context.path}</div>
        </div>
      </div>
      <div className="cp-threads">
        <div className="cp-section-title">Conversations</div>
        <div className="cp-thread active">
          <div className="cp-thread-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>👤</div>
          <div className="cp-thread-info"><h4>HR &amp; Employees</h4><span>Add, import, manage</span></div>
        </div>
        <div className="cp-thread">
          <div className="cp-thread-icon" style={{ background: 'var(--yellow-soft)', color: 'var(--yellow)' }}>💵</div>
          <div className="cp-thread-info"><h4>Finance</h4><span>Invoices, payments</span></div>
        </div>
        <div className="cp-thread">
          <div className="cp-thread-icon" style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>📦</div>
          <div className="cp-thread-info"><h4>Procurement</h4><span>POs, vendors</span></div>
        </div>
      </div>
      <div className="cp-footer">
        <button className="cp-quick-btn" onClick={onImport}>📎 Import data (Excel, CSV)</button>
        <button className="cp-quick-btn">✚ New conversation</button>
        <button className="cp-quick-btn">⚙ Settings</button>
      </div>
    </aside>
  );
};

export default ContextPanel;
