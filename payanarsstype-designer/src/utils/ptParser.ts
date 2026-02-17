/* ============================================================
   PayanarssType JSON Parser
   Converts flat array with Id/ParentId into nested tree
   ============================================================ */
import type { PTNode } from '../types';
import { LEVEL_COLORS } from '../types';

/** Raw shape from VanakkamPayanarssTypes.json */
export interface RawPTItem {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Attributes: (number | string)[];
  Description: string | null;
}

/** Icon mapping based on name patterns */
function inferIcon(name: string, depth: number): string {
  const n = name.toLowerCase();
  // Domain icons
  if (n.includes('hotel')) return '🏨';
  if (n.includes('tenancy') || n.includes('tenant') || n.includes('rental')) return '🏠';
  if (n.includes('gym') || n.includes('fitness')) return '🏋';
  if (n.includes('building') || n.includes('facility')) return '🏢';
  if (n.includes('employee') || n.includes('hr ') || n.includes('staff')) return '👤';
  if (n.includes('payroll') || n.includes('salary') || n.includes('pay')) return '💰';
  if (n.includes('accounting') || n.includes('finance') || n.includes('ledger')) return '💵';
  if (n.includes('procurement') || n.includes('purchase') || n.includes('supplier')) return '📦';
  if (n.includes('property')) return '🏘';
  if (n.includes('project') || n.includes('planning')) return '📋';
  if (n.includes('agent')) return '🤖';
  if (n.includes('user') || n.includes('person')) return '👥';
  if (n.includes('leave') || n.includes('attendance')) return '📅';
  if (n.includes('training')) return '📚';
  if (n.includes('performance') || n.includes('review')) return '📊';
  if (n.includes('recruitment') || n.includes('onboarding')) return '🎯';
  if (n.includes('document') || n.includes('license') || n.includes('certif')) return '📜';
  if (n.includes('address') || n.includes('location') || n.includes('geo')) return '📍';
  if (n.includes('contact') || n.includes('phone') || n.includes('email')) return '📧';
  if (n.includes('payment') || n.includes('invoice') || n.includes('bill')) return '💳';
  if (n.includes('report') || n.includes('balance') || n.includes('trial')) return '📈';
  if (n.includes('tax') || n.includes('vat')) return '🏛';
  if (n.includes('maintenance') || n.includes('repair')) return '🔧';
  if (n.includes('insurance')) return '🛡';
  if (n.includes('agreement') || n.includes('contract') || n.includes('lease')) return '📝';
  // Type-system icons
  if (n.includes('type') || n.includes('lookup')) return '🏷';
  if (n.includes('attribute')) return '⚙';
  if (n === 'id' || n.includes('uniqueid') || n.includes('guid')) return '🔑';
  if (n.includes('date') || n.includes('time')) return '📅';
  if (n.includes('status')) return '🔶';
  if (n.includes('name') || n.includes('text') || n.includes('description')) return '🔤';
  if (n.includes('number') || n.includes('amount') || n.includes('rate') || n.includes('price')) return '🔢';
  if (n.includes('boolean') || n.includes('is')) return '☑';
  // Depth-based defaults
  const defaults = ['📦', '⚙', '📋', '🗃', '🔤', '📎'];
  return defaults[Math.min(depth, defaults.length - 1)];
}

/** Color based on depth */
function depthColor(depth: number): string {
  const colors = [
    LEVEL_COLORS.L1, // cyan
    LEVEL_COLORS.L2, // purple
    LEVEL_COLORS.L3, // green
    LEVEL_COLORS.L4, // amber
    LEVEL_COLORS.L5, // pink
    '#6366F1',       // indigo for depth 5+
  ];
  return colors[Math.min(depth, colors.length - 1)];
}

/** Level based on depth */
function depthLevel(depth: number): 'L1' | 'L2' | 'L3' | 'L4' | 'L5' {
  const levels: ('L1' | 'L2' | 'L3' | 'L4' | 'L5')[] = ['L1', 'L2', 'L3', 'L4', 'L5'];
  return levels[Math.min(depth, 4)];
}

/**
 * Parse flat PayanarssType array into nested PTNode tree
 */
export function parsePTJson(raw: RawPTItem[]): PTNode[] {
  // Build lookup map
  const byId = new Map<string, RawPTItem>();
  raw.forEach(item => byId.set(item.Id, item));

  // Find root nodes (Id === ParentId)
  const rootItems = raw.filter(item => item.Id === item.ParentId);
  const childItems = raw.filter(item => item.Id !== item.ParentId);

  // Group children by ParentId
  const childrenOf = new Map<string, RawPTItem[]>();
  childItems.forEach(item => {
    const list = childrenOf.get(item.ParentId) || [];
    list.push(item);
    childrenOf.set(item.ParentId, list);
  });

  // Recursive builder
  function buildNode(item: RawPTItem, depth: number): PTNode {
    const children = childrenOf.get(item.Id) || [];
    return {
      id: item.Id,
      name: item.Name,
      level: depthLevel(depth),
      code: item.PayanarssTypeId !== item.Id ? item.PayanarssTypeId.slice(-8) : '',
      typeCategory: inferTypeCategory(item, depth),
      description: item.Description || '',
      icon: inferIcon(item.Name, depth),
      color: depthColor(depth),
      children: children.map(c => buildNode(c, depth + 1)),
      expanded: false,
      // Store raw attributes for display
      rawAttributes: item.Attributes,
      rawId: item.Id,
      rawParentId: item.ParentId,
      rawPayanarssTypeId: item.PayanarssTypeId,
    } as PTNode;
  }

  return rootItems.map(item => buildNode(item, 0));
}

/** Infer type category from context */
function inferTypeCategory(item: RawPTItem, depth: number): string {
  const n = item.Name.toLowerCase();
  if (n.includes('type')) return 'TypeDef';
  if (n.includes('agent')) return 'Agent';
  if (n.includes('table') || (depth >= 2 && item.Attributes.length === 0 && n.includes('_'))) return 'TableType';
  if (item.Attributes.length > 0 && depth >= 3) return 'FieldDef';
  if (depth === 0) return 'Root';
  if (depth === 1) return 'Group';
  if (depth === 2) return 'Entity';
  if (depth === 3) return 'Field';
  return 'Node';
}

/**
 * Get summary stats from raw data
 */
export function getPTStats(raw: RawPTItem[]) {
  const roots = raw.filter(item => item.Id === item.ParentId).length;
  const withAttrs = raw.filter(item => item.Attributes.length > 0).length;
  const withDesc = raw.filter(item => item.Description).length;
  return { total: raw.length, roots, withAttrs, withDesc };
}
