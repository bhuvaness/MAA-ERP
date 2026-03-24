import React from 'react';

const RightContextPanel: React.FC = () => {
  return (
    <aside className="ctx-panel">
      <div className="ctx-hd">
        <h4>Context</h4>
        <button className="ctx-x">✕</button>
      </div>
      <div className="ctx-bd">
        {/* Quick Stats */}
        <div className="ctx-sec">
          <div className="ctx-sec-title">Quick Stats</div>
          <div className="ctx-stats">
            <div className="ctx-stat">
              <div className="ctx-stat-val green">3</div>
              <div className="ctx-stat-lbl">Employees</div>
            </div>
            <div className="ctx-stat">
              <div className="ctx-stat-val accent">22.5K</div>
              <div className="ctx-stat-lbl">Payroll (AED)</div>
            </div>
            <div className="ctx-stat">
              <div className="ctx-stat-val blue">2</div>
              <div className="ctx-stat-lbl">Departments</div>
            </div>
            <div className="ctx-stat">
              <div className="ctx-stat-val amber">65%</div>
              <div className="ctx-stat-lbl">Avg Complete</div>
            </div>
          </div>
        </div>

        {/* Interactive Checklist */}
        <div className="ctx-sec">
          <div className="ctx-sec-title">Ahmed Al Mansoori</div>
          <div className="ctx-todo-list">
            <div className="ctx-todo-item done">
              <div className="ctx-todo-check">✓</div>
              <span className="ctx-todo-text">Employee Profile</span>
              <span className="ctx-todo-arrow">→</span>
            </div>
            <div className="ctx-todo-item done">
              <div className="ctx-todo-check">✓</div>
              <span className="ctx-todo-text">Salary Structure</span>
              <span className="ctx-todo-arrow">→</span>
            </div>
            <div className="ctx-todo-item in-progress">
              <div className="ctx-todo-check">◐</div>
              <span className="ctx-todo-text">Documents</span>
              <span className="ctx-todo-arrow">→</span>
            </div>
            <div className="ctx-todo-item pending">
              <div className="ctx-todo-check" />
              <span className="ctx-todo-text">Bank Account</span>
              <span className="ctx-todo-arrow">→</span>
            </div>
            <div className="ctx-todo-item pending">
              <div className="ctx-todo-check" />
              <span className="ctx-todo-text">Emergency Contact</span>
              <span className="ctx-todo-arrow">→</span>
            </div>
            <div className="ctx-todo-item pending">
              <div className="ctx-todo-check" />
              <span className="ctx-todo-text">Leave Policy</span>
              <span className="ctx-todo-arrow">→</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="ctx-sec">
          <div className="ctx-sec-title">Quick Actions</div>
          <div className="ctx-quick-action">
            <div className="ctx-quick-action-icon">📄</div>
            Print Offer Letter
          </div>
          <div className="ctx-quick-action">
            <div className="ctx-quick-action-icon">📝</div>
            Generate Contract
          </div>
          <div className="ctx-quick-action">
            <div className="ctx-quick-action-icon">📊</div>
            Payroll Report
          </div>
          <div className="ctx-quick-action">
            <div className="ctx-quick-action-icon">📧</div>
            Send Welcome Email
          </div>
        </div>

        {/* Recent Activity */}
        <div className="ctx-sec">
          <div className="ctx-sec-title">Recent Activity</div>
          <div className="ctx-activity-item">
            <div className="ctx-activity-dot green" />
            <div>
              <div className="ctx-activity-text">Salary structure created for Ahmed</div>
              <div className="ctx-activity-time">2 min ago</div>
            </div>
          </div>
          <div className="ctx-activity-item">
            <div className="ctx-activity-dot accent" />
            <div>
              <div className="ctx-activity-text">45 gym members imported from CSV</div>
              <div className="ctx-activity-time">1 hour ago</div>
            </div>
          </div>
          <div className="ctx-activity-item">
            <div className="ctx-activity-dot amber" />
            <div>
              <div className="ctx-activity-text">Chart of accounts configured</div>
              <div className="ctx-activity-time">Yesterday</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default RightContextPanel;
