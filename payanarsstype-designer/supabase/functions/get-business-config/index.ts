import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Get Business Configuration
 * 
 * Called by MAA ERP (end-user app) after Viki recommends modules
 * and the user confirms their selection.
 * 
 * Returns the full PayanarssType tree for selected modules,
 * including all tables, columns, and rules — everything needed
 * to create the database schema and register Viki tools.
 * 
 * Also always includes Common Modules (HR, Finance, etc.).
 */

interface PayanarssType {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Attributes: (number | { Id: string; Value: string })[];
  Description: string | null;
}

interface TableConfig {
  id: string;
  name: string;
  description: string;
  useCase: string;
  columns: {
    name: string;
    type: string;
    description: string;
    isRequired: boolean;
    isLookup: boolean;
  }[];
}

interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  sector: string;
  subModules: {
    name: string;
    useCases: {
      name: string;
      tables: TableConfig[];
    }[];
  }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PINECONE_API_KEY = Deno.env.get('PINECONE_API_KEY');
    if (!PINECONE_API_KEY) throw new Error('PINECONE_API_KEY is not configured');

    const { selectedModuleIds, businessType, allTypes } = await req.json();

    if (!selectedModuleIds || !Array.isArray(selectedModuleIds)) {
      throw new Error('selectedModuleIds[] is required');
    }

    if (!allTypes || !Array.isArray(allTypes)) {
      throw new Error('allTypes[] is required (full PayanarssType JSON)');
    }

    const byId = new Map(allTypes.map((t: PayanarssType) => [t.Id, t]));
    const childrenMap = new Map<string, PayanarssType[]>();
    for (const t of allTypes) {
      if (t.ParentId && t.ParentId !== t.Id) {
        if (!childrenMap.has(t.ParentId)) childrenMap.set(t.ParentId, []);
        childrenMap.get(t.ParentId)!.push(t);
      }
    }

    // Find Common Modules root
    const commonModulesNode = allTypes.find((t: PayanarssType) => t.Name === 'Common Modules');

    // Extract full config for selected modules
    const selectedModules: ModuleConfig[] = selectedModuleIds.map((moduleId: string) => {
      const mod = byId.get(moduleId);
      if (!mod) return null;

      const ancestors = getAncestors(mod, byId);
      const sector = ancestors[1]?.Name || '';

      return extractModuleConfig(mod, sector, childrenMap);
    }).filter(Boolean);

    // Extract Common Modules (always included)
    const commonModules: ModuleConfig[] = [];
    if (commonModulesNode) {
      const commonChildren = childrenMap.get(commonModulesNode.Id) || [];
      for (const child of commonChildren) {
        commonModules.push(extractModuleConfig(child, 'Common Modules', childrenMap));
      }
    }

    // Generate Viki tool definitions from tables
    const vikiTools = [];
    const allModules = [...commonModules, ...selectedModules];
    for (const mod of allModules) {
      for (const sub of mod.subModules) {
        for (const uc of sub.useCases) {
          for (const table of uc.tables) {
            vikiTools.push(generateVikiTool(table, mod.name));
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        businessType,
        commonModules,
        selectedModules,
        vikiTools,
        summary: {
          totalModules: commonModules.length + selectedModules.length,
          totalTables: allModules.reduce((sum, m) =>
            sum + m.subModules.reduce((s, sm) =>
              s + sm.useCases.reduce((s2, uc) => s2 + uc.tables.length, 0), 0), 0),
          totalColumns: allModules.reduce((sum, m) =>
            sum + m.subModules.reduce((s, sm) =>
              s + sm.useCases.reduce((s2, uc) =>
                s2 + uc.tables.reduce((s3, t) => s3 + t.columns.length, 0), 0), 0), 0),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get business config error:', error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getAncestors(type: PayanarssType, byId: Map<string, PayanarssType>): PayanarssType[] {
  const ancestors: PayanarssType[] = [];
  let current = type;
  const visited = new Set<string>();
  while (current.ParentId && current.ParentId !== current.Id && !visited.has(current.ParentId)) {
    visited.add(current.Id);
    const parent = byId.get(current.ParentId);
    if (!parent) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

function inferColumnType(desc: string): string {
  const d = (desc || '').toUpperCase();
  if (d.includes('LOOKUP')) return 'LOOKUP';
  if (d.includes('DATETIME')) return 'DATETIME';
  if (d.includes('DATE')) return 'DATE';
  if (d.includes('BOOLEAN')) return 'BOOLEAN';
  if (d.includes('DECIMAL') || d.includes('INTEGER') || d.includes('INT')) return 'NUMBER';
  if (d.includes('FILE') || d.includes('BLOB')) return 'FILE';
  return 'STRING';
}

function extractModuleConfig(
  moduleNode: PayanarssType,
  sector: string,
  childrenMap: Map<string, PayanarssType[]>
): ModuleConfig {
  const subModuleNodes = childrenMap.get(moduleNode.Id) || [];

  const subModules = subModuleNodes.map(sm => {
    const useCaseNodes = childrenMap.get(sm.Id) || [];

    const useCases = useCaseNodes.map(uc => {
      const tableNodes = childrenMap.get(uc.Id) || [];

      const tables: TableConfig[] = tableNodes.map(table => {
        const columnNodes = childrenMap.get(table.Id) || [];

        return {
          id: table.Id,
          name: table.Name,
          description: table.Description || '',
          useCase: uc.Name,
          columns: columnNodes.map(col => ({
            name: col.Name,
            type: inferColumnType(col.Description || ''),
            description: col.Description || '',
            isRequired: (col.Description || '').toUpperCase().includes('REQUIRED'),
            isLookup: inferColumnType(col.Description || '') === 'LOOKUP',
          })),
        };
      });

      return { name: uc.Name, tables };
    });

    return { name: sm.Name, useCases };
  });

  return {
    id: moduleNode.Id,
    name: moduleNode.Name,
    description: moduleNode.Description || '',
    sector,
    subModules,
  };
}

/**
 * Auto-generate a Viki tool definition from a PayanarssType table.
 * This is what makes "every PayanarssType = a Viki capability" work.
 */
function generateVikiTool(table: TableConfig, moduleName: string) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const col of table.columns) {
    const fieldName = col.name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

    const prop: Record<string, unknown> = {
      description: col.description || col.name,
    };

    switch (col.type) {
      case 'NUMBER': prop.type = 'number'; break;
      case 'BOOLEAN': prop.type = 'boolean'; break;
      case 'DATE':
      case 'DATETIME': prop.type = 'string'; prop.format = 'date'; break;
      case 'LOOKUP': prop.type = 'string'; break;
      default: prop.type = 'string';
    }

    properties[fieldName] = prop;
    if (col.isRequired) required.push(fieldName);
  }

  return {
    name: `create_${table.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    description: `Create a new ${table.name} record (${moduleName} > ${table.useCase})`,
    input_schema: {
      type: 'object',
      properties,
      required,
    },
  };
}
