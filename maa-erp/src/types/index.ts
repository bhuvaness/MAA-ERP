// ============================================================
// MAA ERP — Type Definitions
// ============================================================

export type MenuCategory = 'module' | 'action' | 'report' | 'import' | 'settings';

export interface MenuItem {
  cat: MenuCategory;
  icon: string;
  bg: string;
  color: string;
  name: string;
  desc: string;
  keywords: string;
  action: string;
}

export interface CategoryLabel {
  label: string;
  icon: string;
}

export interface SetupStep {
  id: string;
  short: string;
}

export interface SetupData {
  industry?: string;
  name?: string;
  license?: string;
  commercial?: string;
  bank?: string;
  tax?: string;
  [key: string]: string | undefined;
}

export interface ChatMessage {
  id: string;
  type: 'viki' | 'user';
  content: string;       // HTML string for rich content
}

export interface ContextInfo {
  value: string;
  path: string;
}

export interface ImportFileInfo {
  name: string;
  ext: string;
  size: string;
  rows: number | string;
  cols: string[];
  matched: ('matched' | 'unmatched')[];
  matchedCount: number;
  extColor: { bg: string; c: string; i: string };
}

export interface RelatedFormDef {
  title: string;
  dot: string;
  badge: string;
  bc: string;
  bcc: string;
  fields: string;        // HTML string for form fields
}

export type PostSetupType = 'employee' | 'explore';
export type RelatedType = 'salary' | 'address' | 'documents' | 'bank';
