import { SETUP_STEPS } from '../data/menuData';
import { COL } from '../types/Record';
import type { PineconeHit } from '../services/pineconeService';
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
      <div class="fc-field"><label class="fc-label">Employee Code</label><input class="fc-input prefilled" id="${COL.EMP_CODE}" value="EMP-0001" readonly/></div>
      <div class="fc-row"><div class="fc-field"><label class="fc-label">Full Name</label><input class="fc-input" id="${COL.EMP_FIRST_NAME}" placeholder="Ahmed Al Rashid"/></div><div class="fc-field"><label class="fc-label">Department</label><select class="fc-input" id="${COL.EMP_DEPARTMENT}"><option value="">Select...</option><option>Technical</option><option>Finance</option><option>Operations</option><option>Marketing</option><option>Kitchen</option><option>HR</option></select></div></div>
      <div class="fc-field"><label class="fc-label">Date of Birth</label><input class="fc-input" type="date" id="${COL.EMP_DOB}"/></div>
    </div><div class="form-card-footer"><button class="fc-save" data-action="save-employee">Save &amp; Continue</button><span class="fc-autosave"><span class="fc-autosave-dot"></span> Auto-saves</span></div></div>`;
}

export function employeeSavedHTML(name: string, code?: string, dept?: string): string {
  const details = [code || 'EMP-0001', dept].filter(Boolean).join(' · ');
  return `${successHTML(`<strong>${name}</strong> saved`)}
    <div class="msg-data-card" style="margin:8px 0"><div class="data-card-header">👤 ${name} <span class="data-card-count">${code || 'EMP-0001'}</span></div>
      ${dept ? `<div class="data-row"><div class="data-row-info"><h5>Department</h5><span>${dept}</span></div><span class="data-row-status status-done">Saved</span></div>` : ''}
      <div class="data-row"><div class="data-row-info"><h5>Employee Code</h5><span>${details}</span></div><span class="data-row-status status-done">Saved</span></div>
    </div>
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

export function relatedSavedHTML(label: string, summary?: string): string {
  const summaryLine = summary
    ? `<div class="msg-text" style="margin-top:4px;font-size:12px;color:var(--text-3)">${summary}</div>`
    : '';
  return `${successHTML(`${label} saved`)}${summaryLine}
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

// ═══════════════════════════════════════════════════════════════
// Pinecone Vector Search Results
// ═══════════════════════════════════════════════════════════════

const SEARCH_EMOJIS: Record<string, string> = {
  employee: '👤', salary: '💰', address: '🏠',
  documents: '📄', bank: '🏦',
};

const SEARCH_LABELS: Record<string, string> = {
  employee: 'Employee', salary: 'Salary Structure',
  address: 'Address', documents: 'Document', bank: 'Bank Account',
};

const SEARCH_COLORS: Record<string, { bg: string; c: string }> = {
  employee:  { bg: 'var(--green-soft)', c: 'var(--green)' },
  salary:    { bg: 'var(--yellow-soft)', c: 'var(--yellow)' },
  address:   { bg: 'var(--blue-soft)', c: 'var(--blue)' },
  documents: { bg: 'var(--pink-soft)', c: 'var(--pink)' },
  bank:      { bg: 'var(--teal-soft)', c: 'var(--teal)' },
};

// Metadata keys to show as rows (in priority order)
const DISPLAY_FIELDS: Record<string, string[]> = {
  employee:  ['Name', 'EmployeeCode', 'Department', 'Designation', 'DOB', 'Status'],
  salary:    ['Name', 'Basic', 'Housing', 'Transport', 'TotalGross', 'Currency'],
  address:   ['Name', 'Address', 'City', 'Country'],
  documents: ['Name', 'DocumentType', 'DocumentNumber', 'ExpiryDate'],
  bank:      ['BankName', 'IBAN'],
};

export function searchResultsHTML(query: string, hits: PineconeHit[]): string {
  const hitCards = hits.map((hit, i) => {
    const type = hit.fields?.entity_type || 'unknown';
    const emoji = SEARCH_EMOJIS[type] || '📋';
    const label = SEARCH_LABELS[type] || type;
    const score = Math.round((hit._score || 0) * 100);
    const colors = SEARCH_COLORS[type] || { bg: 'var(--bg-surface)', c: 'var(--text-3)' };

    // Build display rows from metadata fields
    const fieldKeys = DISPLAY_FIELDS[type] || Object.keys(hit.fields || {});
    const rows = fieldKeys
      .filter(k => hit.fields?.[k] !== undefined && hit.fields[k] !== '' && hit.fields[k] !== null)
      .slice(0, 5) // Max 5 fields per card
      .map(k => {
        const val = hit.fields[k];
        const displayVal = typeof val === 'number' ? val.toLocaleString() : String(val);
        return `<div class="data-row"><div class="data-row-info"><h5>${k}</h5><span>${displayVal}</span></div></div>`;
      })
      .join('');

    return `<div class="msg-data-card" style="margin-top:${i === 0 ? '8' : '6'}px">
      <div class="data-card-header"><span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:6px;background:${colors.bg};font-size:12px">${emoji}</span> ${label}</span> <span class="data-card-count">${score}% match</span></div>
      ${rows}
    </div>`;
  }).join('');

  return `<div class="msg-text">Found <strong>${hits.length}</strong> result${hits.length !== 1 ? 's' : ''} for "<em>${query}</em>"</div>
    ${hitCards}
    <div class="msg-actions" style="margin-top:8px">
      <button class="action-chip" data-action="add-employee"><span class="chip-icon">👤</span> Add Employee</button>
      <button class="action-chip" data-action="open-import"><span class="chip-icon">📎</span> Import Data</button>
    </div>`;
}

export function noResultsHTML(query: string): string {
  return `<div class="msg-text">No results found for "<em>${query}</em>"</div>
    <div class="msg-text" style="margin-top:4px;font-size:12px;color:var(--text-4)">Try a different search or add some records first.</div>
    <div class="msg-actions" style="margin-top:8px">
      <button class="action-chip" data-action="add-employee"><span class="chip-icon">👤</span> Add Employee</button>
      <button class="action-chip" data-action="open-import"><span class="chip-icon">📎</span> Import Data</button>
    </div>`;
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

// ═══════════════════════════════════════════════════════════════
// TARGET CUSTOMER TREE — Sequential table → column → rules view
// ═══════════════════════════════════════════════════════════════

import type { GymTreeNode } from '../data/gymBusinessData';
import { TYPE_DISPLAY, PTS_TYPE_IDS } from '../data/gymBusinessData';

function getInfo(typeId: string) {
  return TYPE_DISPLAY[typeId] || { label: 'Node', icon: '📄', color: '#6b7280' };
}

function isBranchType(typeId: string): boolean {
  return typeId === PTS_TYPE_IDS.CHILD_TABLE || typeId === PTS_TYPE_IDS.TABLE_TYPE;
}

/** Render columns as data rows with type badges */
function columnsHTML(columns: GymTreeNode[]): string {
  return columns.map(col => {
    const info = getInfo(col.typeId);
    return `<div class="data-row">
      <div class="data-row-info">
        <h5><span style="color:${info.color};margin-right:6px">${info.icon}</span> ${col.name}
          <span style="font-size:9px;font-weight:600;color:${info.color};background:${info.color}18;padding:1px 5px;border-radius:3px;margin-left:6px;text-transform:uppercase">${info.label}</span>
        </h5>
        ${col.description ? `<span>${col.description}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

/** Render rules as a compact list */
function rulesHTML(rules: GymTreeNode[]): string {
  if (rules.length === 0) return '';
  const items = rules.map(r => {
    const info = getInfo(r.typeId);
    return `<div class="data-row" style="padding:4px 0">
      <div class="data-row-info">
        <h5><span style="color:${info.color};margin-right:4px">${info.icon}</span> ${r.name}</h5>
        ${r.description ? `<span>${r.description}</span>` : ''}
      </div>
    </div>`;
  }).join('');
  return `<div class="msg-data-card" style="margin-top:10px">
    <div class="data-card-header">📏 Rules <span class="data-card-count">${rules.length}</span></div>
    ${items}
  </div>`;
}

/**
 * Show a branch of TargetCustomer: table → columns → rules → navigation
 * branchIndex: which branch (0=Identity, 1=Audit, etc.)
 * totalBranches: total count for navigation
 * rulesNode: the Rules branch (index 8) for showing associated rules
 */
export function targetCustomerBranchViewHTML(
  tree: GymTreeNode,
  branchIndex: number
): string {
  const branches = tree.children;
  const branch = branches[branchIndex];
  if (!branch) return '';

  const total = branches.length;
  const branchInfo = getInfo(branch.typeId);

  // Find the Rules branch
  const rulesBranch = branches.find(b => b.name === 'Rules');

  // Collect all leaf columns and sub-branches
  let columnsSection = '';
  let relatedRules: GymTreeNode[] = [];

  const hasSubBranches = branch.children.some(c => isBranchType(c.typeId) && c.children.length > 0);

  if (branch.name === 'Rules' && rulesBranch) {
    // Rules branch — show rule categories with their rules
    const sections = rulesBranch.children.map(cat => {
      const catRules = cat.children;
      const ruleItems = catRules.map(r => {
        const info = getInfo(r.typeId);
        return `<div class="data-row" style="padding:4px 0">
          <div class="data-row-info">
            <h5><span style="color:${info.color};margin-right:4px">${info.icon}</span> ${r.name}</h5>
            ${r.description ? `<span>${r.description}</span>` : ''}
          </div>
        </div>`;
      }).join('');
      return `<div class="msg-data-card" style="margin-top:8px">
        <div class="data-card-header">📂 ${cat.name} <span class="data-card-count">${catRules.length}</span></div>
        ${ruleItems}
      </div>`;
    }).join('');

    columnsSection = sections;
  } else if (branch.name === 'LookupValues') {
    // LookupValues — show value lists
    const sections = branch.children.map(lv => {
      const values = lv.children;
      const valueRows = values.map(v => {
        const info = getInfo(v.typeId);
        return `<div class="data-row" style="padding:3px 0">
          <div class="data-row-info">
            <h5><span style="color:${info.color};margin-right:4px">${info.icon}</span> ${v.name}</h5>
            ${v.description ? `<span>${v.description}</span>` : ''}
          </div>
        </div>`;
      }).join('');
      return `<div class="msg-data-card" style="margin-top:8px">
        <div class="data-card-header">🏷️ ${lv.name} <span class="data-card-count">${values.length} values</span></div>
        ${valueRows}
      </div>`;
    }).join('');
    columnsSection = sections;
  } else if (hasSubBranches) {
    // Has sub-branches (e.g., Demographics → SegmentProfile, AgeProfile, FitnessProfile)
    // Show each sub-branch with its columns inline
    const sections = branch.children.map(sub => {
      const subInfo = getInfo(sub.typeId);
      const cols = sub.children;
      return `<div class="msg-data-card" style="margin-top:8px">
        <div class="data-card-header"><span style="color:${subInfo.color}">${subInfo.icon}</span> ${sub.name} <span class="data-card-count">${cols.length} columns</span></div>
        ${sub.description ? `<div style="padding:4px 14px;font-size:11px;color:var(--text-4)">${sub.description}</div>` : ''}
        ${columnsHTML(cols)}
      </div>`;
    }).join('');
    columnsSection = sections;

    // Collect rules related to this branch's column names
    if (rulesBranch) {
      const colNames = new Set<string>();
      branch.children.forEach(sub => sub.children.forEach(col => colNames.add(col.name.toLowerCase())));
      rulesBranch.children.forEach(cat => {
        cat.children.forEach(rule => {
          const rName = rule.name.toLowerCase();
          if ([...colNames].some(cn => rName.includes(cn.toLowerCase()))) {
            relatedRules.push(rule);
          }
        });
      });
    }
  } else {
    // Direct leaf columns (e.g., Identity → Code, Name, Status)
    columnsSection = `<div class="msg-data-card" style="margin-top:8px">
      <div class="data-card-header">📋 ${branch.name} <span class="data-card-count">${branch.children.length} columns</span></div>
      ${columnsHTML(branch.children)}
    </div>`;

    // Collect rules related to these column names
    if (rulesBranch) {
      const colNames = new Set(branch.children.map(c => c.name.toLowerCase()));
      rulesBranch.children.forEach(cat => {
        cat.children.forEach(rule => {
          const rName = rule.name.toLowerCase();
          if ([...colNames].some(cn => rName.includes(cn.toLowerCase()))) {
            relatedRules.push(rule);
          }
        });
      });
    }
  }

  // Navigation buttons
  const prevBtn = branchIndex > 0
    ? `<button class="action-chip" data-action="tc-nav" data-index="${branchIndex - 1}"><span class="chip-icon">←</span> ${branches[branchIndex - 1].name}</button>`
    : '';
  const nextBtn = branchIndex < total - 1
    ? `<button class="action-chip" data-action="tc-nav" data-index="${branchIndex + 1}"><span class="chip-icon">→</span> ${branches[branchIndex + 1].name}</button>`
    : '';

  return `<div class="msg-text" style="margin-bottom:2px">
      <strong>🗃️ TargetCustomer</strong>
      <span style="font-size:11px;color:var(--text-4);margin-left:8px">Branch ${branchIndex + 1} of ${total}</span>
    </div>
    <div class="msg-text" style="font-size:12px;color:var(--text-4)">
      TargetCustomer › <strong style="color:var(--text-2)">${branch.name}</strong>
    </div>
    <div style="margin-top:8px;padding:10px 14px;background:var(--bg-surface);border-radius:var(--r);border:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:18px;color:${branchInfo.color}">${branchInfo.icon}</span>
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--text)">${branch.name}</div>
          ${branch.description ? `<div style="font-size:11px;color:var(--text-4);margin-top:2px">${branch.description}</div>` : ''}
        </div>
      </div>
    </div>
    ${columnsSection}
    ${relatedRules.length > 0 ? rulesHTML(relatedRules) : ''}
    <div class="msg-actions" style="margin-top:10px">
      ${prevBtn}
      ${nextBtn}
    </div>`;
}
