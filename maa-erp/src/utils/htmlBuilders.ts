import { SETUP_STEPS } from '../data/menuData';
import type { SetupData, RelatedFormDef } from '../types';
import type { PayanarssType } from '../types/PayanarssType';

const SEGMENT_ICONS: Record<string, string> = {
  'Bodybuilders': '💪',
  'General Fitness': '🏃',
  'Women-Only': '👩',
  'CrossFit / Functional Training': '🏋️',
  'Senior / Rehabilitation': '🧓',
  'Youth / Teen Fitness': '🧒',
  'Corporate / Office Workers': '💼',
  'Athletes / Sports Training': '⚽',
  '24-Hour / Budget': '🕐',
  'Boutique / Luxury': '✨',
};

export function progressHTML(activeIdx: number): string {
  const steps = SETUP_STEPS.map((s, i) => {
    const dot = i < activeIdx ? 'done' : i === activeIdx ? 'active' : '';
    const line = i < SETUP_STEPS.length - 1 ? `<div class="progress-line${i < activeIdx ? ' done' : ''}"></div>` : '';
    return `<div class="progress-step"><div class="progress-dot ${dot}">${i < activeIdx ? '✓' : i + 1}</div>${line}</div>`;
  }).join('');
  const labels = SETUP_STEPS.map((s, i) =>
    `<div class="progress-label ${i < activeIdx ? 'done' : i === activeIdx ? 'active' : ''}">${s.short}</div>`
  ).join('');
  return `<div class="msg-progress"><div class="progress-track">${steps}</div><div class="progress-labels">${labels}</div></div>`;
}

export function successHTML(text: string): string {
  return `<div class="msg-success">✓ ${text}</div>`;
}

export function setupSummaryHTML(data: SetupData): string {
  const name = data.name || 'My Business';
  const ind = data.industry || 'Business';
  const sk = (k: string) => data[k] === '(skipped)';
  const row = (label: string, key: string) => {
    const val = sk(key) ? 'Pending' : (data[key] || 'Saved');
    const st = sk(key) ? 'status-skip' : 'status-done';
    const stLabel = sk(key) ? 'Pending' : 'Done';
    return `<div class="data-row"><div class="data-row-info"><h5>${label}</h5><span>${val}</span></div><span class="data-row-status ${st}">${stLabel}</span></div>`;
  };
  return `<div class="msg-data-card" style="margin-top:12px"><div class="data-card-header">💼 ${name} <span class="data-card-count">${ind}</span></div>
    <div class="data-row"><div class="data-row-info"><h5>Business Name</h5><span>${name}</span></div><span class="data-row-status status-done">Done</span></div>
    ${row('Trade License', 'license')}${row('Commercial Reg', 'commercial')}${row('Bank Account', 'bank')}${row('Tax Registration', 'tax')}</div>`;
}

export function employeeFormHTML(): string {
  return `<div class="msg-form-card"><div class="form-card-header"><div class="form-card-dot" style="background:var(--green)"></div><h4>New Employee</h4><span class="form-card-badge" style="background:var(--green-soft);color:var(--green)">3 FIELDS</span></div>
    <div class="form-card-body">
      <div class="fc-field"><label class="fc-label">Employee Code</label><input class="fc-input prefilled" value="EMP-0001" readonly/></div>
      <div class="fc-row"><div class="fc-field"><label class="fc-label">Full Name</label><input class="fc-input" id="empName" placeholder="Ahmed Al Rashid"/></div><div class="fc-field"><label class="fc-label">Department</label><select class="fc-input" id="empDept"><option value="">Select...</option><option>Technical</option><option>Finance</option><option>Operations</option><option>Marketing</option><option>Kitchen</option><option>HR</option></select></div></div>
      <div class="fc-field"><label class="fc-label">Date of Birth</label><input class="fc-input" type="date"/></div>
    </div><div class="form-card-footer"><button class="fc-save" data-action="save-employee">Save &amp; Continue</button><span class="fc-autosave"><span class="fc-autosave-dot"></span> Auto-saves</span></div></div>`;
}

export function employeeSavedHTML(name: string): string {
  return `${successHTML(`<strong>${name}</strong> saved (EMP-0001)`)}
    <div class="msg-text" style="margin-top:8px">Add more details?</div>
    <div class="msg-related"><div class="msg-related-title">★ Related</div><div class="related-options">
      <button class="related-opt" data-related="salary"><div class="related-opt-icon" style="background:var(--yellow-soft);color:var(--yellow)">💰</div><div class="related-opt-text"><h5>Salary</h5><span>Basic, Housing, Transport</span></div><span class="related-opt-arrow">›</span></button>
      <button class="related-opt" data-related="address"><div class="related-opt-icon" style="background:var(--blue-soft);color:var(--blue)">🏠</div><div class="related-opt-text"><h5>Address</h5><span>Home address</span></div><span class="related-opt-arrow">›</span></button>
      <button class="related-opt" data-related="documents"><div class="related-opt-icon" style="background:var(--pink-soft);color:var(--pink)">📄</div><div class="related-opt-text"><h5>Documents</h5><span>Passport, Visa, Emirates ID</span></div><span class="related-opt-arrow">›</span></button>
      <button class="related-opt" data-related="bank"><div class="related-opt-icon" style="background:var(--teal-soft);color:var(--teal)">🏦</div><div class="related-opt-text"><h5>Bank Account</h5><span>WPS salary transfer</span></div><span class="related-opt-arrow">›</span></button>
    </div></div>
    <div class="msg-actions" style="margin-top:8px"><button class="action-chip" data-action="add-employee">👤 Another employee</button><button class="action-chip" data-action="open-import">📎 Import from Excel</button></div>`;
}

export function relatedFormHTML(form: RelatedFormDef, type: string): string {
  return `<div class="msg-form-card"><div class="form-card-header"><div class="form-card-dot" style="background:${form.dot}"></div><h4>${form.title}</h4><span class="form-card-badge" style="background:${form.bc};color:${form.bcc}">${form.badge}</span></div>
    <div class="form-card-body">${form.fields}</div>
    <div class="form-card-footer"><button class="fc-save" data-action="save-related" data-type="${type}">Save</button><span class="fc-autosave"><span class="fc-autosave-dot"></span> Auto-saving</span></div></div>`;
}

export function relatedSavedHTML(label: string): string {
  return `${successHTML(`${label} saved`)}
    <div class="msg-actions" style="margin-top:6px"><button class="action-chip" data-related="salary">💰 Salary</button><button class="action-chip" data-related="address">🏠 Address</button><button class="action-chip" data-related="documents">📄 Docs</button><button class="action-chip" data-action="add-employee">👤 Another</button></div>`;
}

export function exploreModulesHTML(): string {
  return `<div class="msg-text">Here are your active modules:</div>
    <div class="msg-related"><div class="msg-related-title">⚙ Active Modules (12)</div><div class="related-options">
      <button class="related-opt" data-action="add-employee"><div class="related-opt-icon" style="background:var(--green-soft);color:var(--green)">👤</div><div class="related-opt-text"><h5>HR &amp; Payroll</h5><span>Employees, Attendance, Leave, Payroll</span></div><span class="related-opt-arrow">›</span></button>
      <button class="related-opt"><div class="related-opt-icon" style="background:var(--yellow-soft);color:var(--yellow)">💵</div><div class="related-opt-text"><h5>Finance &amp; Accounting</h5><span>GL, AP, AR, Bank, Tax</span></div><span class="related-opt-arrow">›</span></button>
      <button class="related-opt"><div class="related-opt-icon" style="background:var(--blue-soft);color:var(--blue)">📦</div><div class="related-opt-text"><h5>Procurement</h5><span>POs, Vendors, GRN</span></div><span class="related-opt-arrow">›</span></button>
      <button class="related-opt"><div class="related-opt-icon" style="background:var(--pink-soft);color:var(--pink)">📈</div><div class="related-opt-text"><h5>Sales &amp; CRM</h5><span>Leads, Quotes, Customers</span></div><span class="related-opt-arrow">›</span></button>
      <button class="related-opt"><div class="related-opt-icon" style="background:var(--accent-soft);color:var(--accent)">🍽</div><div class="related-opt-text"><h5>POS &amp; Billing</h5><span>Tables, Orders, KOT</span></div><span class="related-opt-arrow">›</span></button>
    </div></div>`;
}

export function attendanceReportHTML(): string {
  return `<div class="msg-text"><strong>Attendance Report</strong> — Feb 2026</div>
    <div class="msg-data-card"><div class="data-card-header">📅 Attendance <span class="data-card-count">24 staff</span></div>
      <div class="data-row"><div class="data-row-info" style="padding:4px 0"><h5>Present Today</h5><span>16 Feb 2026</span></div><span style="font-size:18px;font-weight:700;color:var(--green)">22</span></div>
      <div class="data-row"><div class="data-row-info" style="padding:4px 0"><h5>On Leave</h5><span>Annual + Sick</span></div><span style="font-size:18px;font-weight:700;color:var(--yellow)">2</span></div>
      <div class="data-row"><div class="data-row-info" style="padding:4px 0"><h5>Rate (MTD)</h5></div><span style="font-size:18px;font-weight:700;color:var(--text)">96.2%</span></div>
    </div><div class="msg-actions" style="margin-top:8px"><button class="action-chip">📄 Export PDF</button><button class="action-chip">📧 Email weekly</button></div>`;
}

export function importPreviewHTML(fn: string, ext: string, size: string, rows: number | string, cols: string[], matched: string[], mc: number, ec: { bg: string; c: string; i: string }): string {
  const colTags = cols.map((c, i) => `<span class="import-col-tag ${matched[i]}">${matched[i] === 'matched' ? '✓ ' : '? '}${c}</span>`).join('');
  return `<div class="msg-text">Analyzed your file:</div>
    <div class="import-preview-card">
      <div class="import-preview-header"><div class="import-file-icon" style="background:${ec.bg};color:${ec.c}">${ec.i}</div><div class="import-file-info"><h4>${fn}</h4><span>${ext} · ${size} KB</span></div></div>
      <div class="import-preview-stats"><div class="import-stat"><div class="import-stat-value">${rows}</div><div class="import-stat-label">Rows</div></div><div class="import-stat"><div class="import-stat-value">${cols.length}</div><div class="import-stat-label">Columns</div></div><div class="import-stat"><div class="import-stat-value">${mc}/${cols.length}</div><div class="import-stat-label">Mapped</div></div></div>
      ${cols.length ? `<div class="import-preview-cols">${colTags}</div>` : ''}
      <div class="import-preview-footer"><button class="fc-save" data-action="do-import" data-fn="${fn}" data-rows="${rows}">Import ${rows} rows</button><button class="fc-skip">Map columns</button></div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// BUSINESS USE CASE — Gym metadata drill-down
// ═══════════════════════════════════════════════════════════════

export function businessUseCasesHTML(businessName: string, useCases: PayanarssType[]): string {
  const cards = useCases.map(uc =>
    `<button class="related-opt" data-action="drill-usecase" data-id="${uc.Id}">
      <div class="related-opt-icon" style="background:var(--accent-soft);color:var(--accent)">⚡</div>
      <div class="related-opt-text">
        <h5>${uc.Name}</h5>
        ${uc.Description ? `<span>${uc.Description}</span>` : ''}
      </div>
      <span class="related-opt-arrow">›</span>
    </button>`
  ).join('');

  return `<div class="msg-text">I've loaded the <strong>${businessName}</strong> business model.</div>
    <div class="msg-related" style="margin-top:10px">
      <div class="msg-related-title">⚡ Business Use Cases (${useCases.length})</div>
      <div class="related-options">${cards}</div>
    </div>`;
}

export function customerSegmentsHTML(segments: PayanarssType[]): string {
  const cards = segments.map(seg => {
    const icon = SEGMENT_ICONS[seg.Name] || '🎯';
    return `<button class="related-opt" data-action="drill-segment" data-id="${seg.Id}">
      <div class="related-opt-icon" style="background:var(--yellow-soft);color:var(--yellow)">${icon}</div>
      <div class="related-opt-text">
        <h5>${seg.Name}</h5>
        ${seg.Description ? `<span>${seg.Description}</span>` : ''}
      </div>
      <span class="related-opt-arrow">›</span>
    </button>`;
  }).join('');

  return `<div class="msg-text"><strong>Identify Target Customer Segment</strong></div>
    <div class="msg-text" style="margin-top:4px;font-size:12px;color:var(--text-4)">
      Choose a customer segment to see Equipment, Staffing, Facility, Marketing, Pricing, and Revenue Model details.
    </div>
    <div class="msg-related" style="margin-top:10px">
      <div class="msg-related-title">🎯 Customer Segments (${segments.length})</div>
      <div class="related-options">${cards}</div>
    </div>`;
}

export function segmentDetailHTML(segment: PayanarssType, details: PayanarssType[]): string {
  const rows = details.map(d =>
    `<div class="data-row">
      <div class="data-row-info">
        <h5>${d.Name}</h5>
        ${d.Description ? `<span>${d.Description}</span>` : '<span style="color:var(--text-4)">No details yet</span>'}
      </div>
    </div>`
  ).join('');

  return `<div class="msg-text"><strong>${segment.Name}</strong> — Segment Details</div>
    ${segment.Description ? `<div class="msg-text" style="margin-top:4px;font-size:12px;color:var(--text-4)">${segment.Description}</div>` : ''}
    <div class="msg-data-card" style="margin-top:10px">
      <div class="data-card-header">📋 ${segment.Name} <span class="data-card-count">${details.length} aspects</span></div>
      ${rows}
    </div>
    <div class="msg-actions" style="margin-top:8px">
      <button class="action-chip" data-action="back-segments"><span class="chip-icon">←</span> Back to Segments</button>
      <button class="action-chip" data-action="select-segment" data-id="${segment.Id}"><span class="chip-icon">✓</span> Select This Segment</button>
    </div>`;
}
