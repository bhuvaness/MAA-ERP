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
            <h2>MAA ERP</h2>
            <span>Gym Business</span>
          </div>
        </div>
        <div className="cp-context">
          <div className="cp-context-label">Current Context</div>
          <div className="cp-context-value">{context.value}</div>
          <div className="cp-context-path">{context.path}</div>
        </div>
      </div>

      <div className="cp-search">
        <input placeholder="Search or ⌘K..." />
      </div>

      <div className="cp-threads">
        <div className="cp-section-title">Active</div>

        <div className="cp-thread active">
          <div className="cp-thread-icon" style={{ background: 'var(--accent-light)' }}>👤</div>
          <div className="cp-thread-info">
            <h4>HR &amp; Employees</h4>
            <span>Salary for Ahmed...</span>
          </div>
          <div className="cp-thread-badge">3</div>
        </div>

        <div className="cp-thread">
          <div className="cp-thread-icon" style={{ background: 'var(--amber-light)' }}>💰</div>
          <div className="cp-thread-info">
            <h4>Finance &amp; Accounts</h4>
            <span>Chart of accounts ready</span>
          </div>
          <div className="cp-thread-time">11:30</div>
        </div>

        <div className="cp-thread">
          <div className="cp-thread-icon" style={{ background: 'var(--green-light)' }}>🏋️</div>
          <div className="cp-thread-info">
            <h4>Gym Members</h4>
            <span>45 members imported</span>
          </div>
          <div className="cp-thread-badge">2</div>
        </div>

        <div className="cp-section-title">Earlier</div>

        <div className="cp-thread">
          <div className="cp-thread-icon" style={{ background: 'var(--bg-warm)' }}>⚙️</div>
          <div className="cp-thread-info">
            <h4>Business Setup</h4>
            <span>Modules configured</span>
          </div>
          <div className="cp-thread-time">Tue</div>
        </div>

        <div className="cp-thread">
          <div className="cp-thread-icon" style={{ background: 'var(--blue-light)' }}>📦</div>
          <div className="cp-thread-info">
            <h4>Equipment &amp; Inventory</h4>
            <span>Treadmills ordered</span>
          </div>
          <div className="cp-thread-time">Mon</div>
        </div>
      </div>

      <div className="cp-footer">
        <button className="cp-quick-btn" onClick={onImport}>+ New</button>
        <button className="cp-quick-btn">⚙ Settings</button>
        <button className="cp-quick-btn">▤ Data</button>
      </div>
    </aside>
  );
};

export default ContextPanel;
