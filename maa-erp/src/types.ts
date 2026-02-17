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
  [key: string]: string | undefined;
}

export interface ChatMessage {
  id: string;
  type: 'viki' | 'user';
  content: string;
}

export interface ContextInfo {
  value: string;
  path: string;
}

export interface RelatedFormDef {
  title: string;
  dot: string;
  badge: string;
  bc: string;
  bcc: string;
  fields: string;
}

export type RelatedType = 'salary' | 'address' | 'documents' | 'bank';
