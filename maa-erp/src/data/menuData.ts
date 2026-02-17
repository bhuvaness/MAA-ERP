import type { MenuItem, CategoryLabel, SetupStep, RelatedFormDef } from '../types';

export const MENU_DATA: MenuItem[] = [
  { cat: 'module', icon: '👤', bg: 'var(--green-soft)', color: 'var(--green)', name: 'HR & Payroll', desc: 'Employees, Attendance, Leave, Payroll', keywords: 'hr human resources payroll staff people team', action: 'employee' },
  { cat: 'module', icon: '💵', bg: 'var(--yellow-soft)', color: 'var(--yellow)', name: 'Finance & Accounting', desc: 'General Ledger, AP, AR, Bank, Tax', keywords: 'finance accounting money invoice billing ledger', action: 'finance' },
  { cat: 'module', icon: '📦', bg: 'var(--blue-soft)', color: 'var(--blue)', name: 'Procurement', desc: 'Purchase Orders, Vendors, GRN, RFQ', keywords: 'procurement purchase buy vendor supplier order', action: 'procurement' },
  { cat: 'module', icon: '📈', bg: 'var(--pink-soft)', color: 'var(--pink)', name: 'Sales & CRM', desc: 'Leads, Quotes, Orders, Customers', keywords: 'sales crm customer lead opportunity pipeline', action: 'sales' },
  { cat: 'module', icon: '🍽', bg: 'var(--accent-soft)', color: 'var(--accent)', name: 'POS & Billing', desc: 'Tables, Orders, KOT, Payments', keywords: 'pos point of sale billing register checkout', action: 'pos' },
  { cat: 'module', icon: '📦', bg: 'var(--teal-soft)', color: 'var(--teal)', name: 'Inventory & Warehouse', desc: 'Stock, Warehouse, Material Planning', keywords: 'inventory stock warehouse material goods item', action: 'inventory' },
  { cat: 'module', icon: '📄', bg: 'var(--blue-soft)', color: 'var(--blue)', name: 'Project Management', desc: 'Projects, Tasks, Timesheets, Billing', keywords: 'project task milestone timeline gantt', action: 'project' },
  { cat: 'module', icon: '📜', bg: 'var(--pink-soft)', color: 'var(--pink)', name: 'Compliance & Legal', desc: 'Documents, Contracts, Audit Trail', keywords: 'compliance legal contract document audit', action: 'compliance' },

  { cat: 'action', icon: '👤', bg: 'var(--green-soft)', color: 'var(--green)', name: 'Add Employee', desc: 'Register a new team member', keywords: 'add new employee hire staff person recruit', action: 'employee' },
  { cat: 'action', icon: '💰', bg: 'var(--yellow-soft)', color: 'var(--yellow)', name: 'Add Salary Structure', desc: 'Basic, Housing, Transport allowances', keywords: 'salary pay compensation wage allowance', action: 'salary' },
  { cat: 'action', icon: '📄', bg: 'var(--pink-soft)', color: 'var(--pink)', name: 'Upload Document', desc: 'Passport, Visa, Emirates ID, Contracts', keywords: 'upload document passport visa id card file', action: 'documents' },
  { cat: 'action', icon: '🏠', bg: 'var(--blue-soft)', color: 'var(--blue)', name: 'Add Address', desc: 'Employee or company address', keywords: 'address location city emirate street building', action: 'address' },
  { cat: 'action', icon: '🏦', bg: 'var(--teal-soft)', color: 'var(--teal)', name: 'Add Bank Account', desc: 'For WPS salary transfers', keywords: 'bank account iban wps transfer payment', action: 'bank' },
  { cat: 'action', icon: '📦', bg: 'var(--blue-soft)', color: 'var(--blue)', name: 'Create Purchase Order', desc: 'New PO for vendor procurement', keywords: 'purchase order po buy procurement request', action: 'po' },
  { cat: 'action', icon: '💵', bg: 'var(--yellow-soft)', color: 'var(--yellow)', name: 'Create Invoice', desc: 'Generate sales or service invoice', keywords: 'invoice bill receipt charge', action: 'invoice' },
  { cat: 'action', icon: '👥', bg: 'var(--accent-soft)', color: 'var(--accent)', name: 'Add Vendor', desc: 'Register new supplier or vendor', keywords: 'vendor supplier add new register', action: 'vendor' },
  { cat: 'action', icon: '📅', bg: 'var(--green-soft)', color: 'var(--green)', name: 'Record Attendance', desc: 'Mark employee attendance for today', keywords: 'attendance checkin checkout punch time clock', action: 'attendance' },
  { cat: 'action', icon: '📧', bg: 'var(--viki-soft)', color: 'var(--viki)', name: 'Schedule Report', desc: 'Email reports on a schedule', keywords: 'schedule email report recurring automatic', action: 'schedule' },

  { cat: 'report', icon: '📊', bg: 'var(--pink-soft)', color: 'var(--pink)', name: 'Attendance Report', desc: 'Daily, weekly, monthly attendance', keywords: 'attendance report present absent leave', action: 'report_attendance' },
  { cat: 'report', icon: '📈', bg: 'var(--green-soft)', color: 'var(--green)', name: 'Sales Summary', desc: 'Revenue, orders, top products', keywords: 'sales revenue summary total income', action: 'report_sales' },
  { cat: 'report', icon: '💵', bg: 'var(--yellow-soft)', color: 'var(--yellow)', name: 'Expense Report', desc: 'Spending by category, department', keywords: 'expense spend cost budget category', action: 'report_expense' },
  { cat: 'report', icon: '📦', bg: 'var(--teal-soft)', color: 'var(--teal)', name: 'Stock Levels', desc: 'Current inventory and reorder alerts', keywords: 'stock inventory level reorder low warehouse', action: 'report_stock' },
  { cat: 'report', icon: '💰', bg: 'var(--accent-soft)', color: 'var(--accent)', name: 'Payroll Report', desc: 'Salary breakdown by department', keywords: 'payroll salary wage department breakdown', action: 'report_payroll' },

  { cat: 'import', icon: '📗', bg: 'var(--green-soft)', color: 'var(--green)', name: 'Import Excel (.xlsx)', desc: 'Upload spreadsheet with auto column mapping', keywords: 'import excel xlsx spreadsheet upload', action: 'import_excel' },
  { cat: 'import', icon: '📄', bg: 'var(--blue-soft)', color: 'var(--blue)', name: 'Import CSV', desc: 'Comma-separated values file', keywords: 'import csv comma separated upload', action: 'import_csv' },
  { cat: 'import', icon: '📃', bg: 'var(--accent-soft)', color: 'var(--accent)', name: 'Import JSON', desc: 'Structured JSON data file', keywords: 'import json data upload structured', action: 'import_json' },

  { cat: 'settings', icon: '⚙', bg: 'var(--bg-elevated)', color: 'var(--text-3)', name: 'Business Settings', desc: 'Company info, trade license, tax', keywords: 'settings config company business profile', action: 'settings' },
  { cat: 'settings', icon: '👤', bg: 'var(--bg-elevated)', color: 'var(--text-3)', name: 'User Management', desc: 'Add users, roles, permissions', keywords: 'user role permission access admin', action: 'users' },
  { cat: 'settings', icon: '🎨', bg: 'var(--bg-elevated)', color: 'var(--text-3)', name: 'Module Configuration', desc: 'Enable, disable, customize modules', keywords: 'module config enable disable customize', action: 'modules' },
];

export const CAT_LABELS: Record<string, CategoryLabel> = {
  module: { label: 'Modules', icon: '⚙' },
  action: { label: 'Actions', icon: '⚡' },
  report: { label: 'Reports', icon: '📊' },
  import: { label: 'Import', icon: '📎' },
  settings: { label: 'Settings', icon: '🔧' },
};

export const CAT_ORDER: string[] = ['action', 'module', 'report', 'import', 'settings'];

export const SETUP_STEPS: SetupStep[] = [
  { id: 'industry', short: 'Type' },
  { id: 'name', short: 'Name' },
  { id: 'license', short: 'License' },
  { id: 'commercial', short: 'CR' },
  { id: 'bank', short: 'Bank' },
  { id: 'tax', short: 'Tax' },
];

export const RELATED_FORMS: Record<string, RelatedFormDef> = {
  salary: {
    title: 'Salary Structure', dot: 'var(--yellow)', badge: 'FINANCE',
    bc: 'var(--yellow-soft)', bcc: 'var(--yellow)',
    fields: '<div class="fc-row"><div class="fc-field"><label class="fc-label">Basic (AED)</label><input class="fc-input" type="number" placeholder="0.00"/></div><div class="fc-field"><label class="fc-label">Housing</label><input class="fc-input" type="number" placeholder="0.00"/></div></div><div class="fc-row"><div class="fc-field"><label class="fc-label">Transport</label><input class="fc-input" type="number" placeholder="0.00"/></div><div class="fc-field"><label class="fc-label">Effective From</label><input class="fc-input" type="date"/></div></div>',
  },
  address: {
    title: 'Address', dot: 'var(--blue)', badge: 'PERSONAL',
    bc: 'var(--blue-soft)', bcc: 'var(--blue)',
    fields: '<div class="fc-field"><label class="fc-label">Address</label><input class="fc-input" placeholder="Building, Street, Area"/></div><div class="fc-row"><div class="fc-field"><label class="fc-label">City</label><select class="fc-input"><option>Abu Dhabi</option><option>Dubai</option><option>Sharjah</option></select></div><div class="fc-field"><label class="fc-label">Country</label><select class="fc-input"><option>UAE</option></select></div></div>',
  },
  documents: {
    title: 'Document', dot: 'var(--pink)', badge: 'COMPLIANCE',
    bc: 'var(--pink-soft)', bcc: 'var(--pink)',
    fields: '<div class="fc-row"><div class="fc-field"><label class="fc-label">Type</label><select class="fc-input"><option>Passport</option><option>Visa</option><option>Emirates ID</option></select></div><div class="fc-field"><label class="fc-label">Number</label><input class="fc-input" placeholder="Enter number"/></div></div><div class="fc-field"><label class="fc-label">Expiry</label><input class="fc-input" type="date"/></div>',
  },
  bank: {
    title: 'Bank Account', dot: 'var(--teal)', badge: 'WPS',
    bc: 'var(--teal-soft)', bcc: 'var(--teal)',
    fields: '<div class="fc-field"><label class="fc-label">Bank</label><select class="fc-input"><option>ADCB</option><option>Emirates NBD</option><option>FAB</option><option>ADIB</option></select></div><div class="fc-field"><label class="fc-label">IBAN</label><input class="fc-input" placeholder="AE XX XXXX..."/></div>',
  },
};

export const KNOWN_COLUMNS = ['name', 'employee', 'code', 'department', 'dept', 'salary', 'dob', 'date', 'phone', 'email', 'status', 'address', 'vendor', 'amount', 'product'];

export const EXT_COLORS: Record<string, { bg: string; c: string; i: string }> = {
  XLSX: { bg: 'var(--green-soft)', c: 'var(--green)', i: '📗' },
  CSV: { bg: 'var(--blue-soft)', c: 'var(--blue)', i: '📄' },
  JSON: { bg: 'var(--accent-soft)', c: 'var(--accent)', i: '📃' },
};
