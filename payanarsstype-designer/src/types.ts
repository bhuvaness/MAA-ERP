/* ============================================================
   PayanarssType Designer — Type Definitions
   ============================================================ */

export type NodeLevel = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export interface PTNode {
  id: string;
  name: string;
  level: NodeLevel;
  code: string;
  typeCategory: string;
  description: string;
  icon: string;
  color: string;
  children: PTNode[];
  expanded: boolean;
  // Level-specific
  tableName?: string;
  entityType?: string;
  columnName?: string;
  dataType?: string;
  required?: boolean;
  defaultValue?: string;
  maxLength?: number;
  // Raw PayanarssType data (from JSON import)
  rawAttributes?: (number | string)[];
  rawId?: string;
  rawParentId?: string;
  rawPayanarssTypeId?: string;
}

export const LEVEL_LABELS: Record<NodeLevel, string> = {
  L1: 'Module',
  L2: 'Process Group',
  L3: 'Business Use Case',
  L4: 'Entity / Table',
  L5: 'Field / Column',
};

export const LEVEL_COLORS: Record<NodeLevel, string> = {
  L1: '#06B6D4',
  L2: '#8B5CF6',
  L3: '#22C55E',
  L4: '#F59E0B',
  L5: '#EC4899',
};

export const LEVEL_ICONS: Record<NodeLevel, string> = {
  L1: '📦',
  L2: '⚙',
  L3: '📋',
  L4: '🗃',
  L5: '🔤',
};

export const CHILD_LEVEL: Record<NodeLevel, NodeLevel | null> = {
  L1: 'L2',
  L2: 'L3',
  L3: 'L4',
  L4: 'L5',
  L5: null,
};

export const PARENT_LEVEL: Record<NodeLevel, NodeLevel | null> = {
  L1: null,
  L2: 'L1',
  L3: 'L2',
  L4: 'L3',
  L5: 'L4',
};
