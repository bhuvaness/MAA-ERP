# PayanarssType Designer

Visual tree editor for the PayanarssType metadata architecture. Browse, edit, and manage 3,000+ type definitions with a hierarchical tree navigator and inline type editor.

## Tech Stack

- **Vite** + **React 18** + **TypeScript**
- **shadcn/ui** components (Radix UI primitives)
- **Tailwind CSS** with custom design tokens
- **Supabase** (AI generation via Edge Functions)
- **react-router-dom** for routing
- **lucide-react** icons

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Opens at `http://localhost:8080`

## Project Structure

```
src/
├── components/
│   ├── designer/          # Core designer components
│   │   ├── Header.tsx         # Top nav bar
│   │   ├── TreeSidebar.tsx    # Left tree navigator
│   │   ├── TreeNode.tsx       # Recursive tree node
│   │   ├── TypeEditor.tsx     # Main table editor
│   │   ├── Breadcrumb.tsx     # Path navigation
│   │   ├── AIPromptBar.tsx    # AI generation input
│   │   └── TypeSelectModal.tsx # Type picker modal
│   ├── agent/             # AI agent interface
│   ├── ui/                # shadcn/ui components
│   └── PayanarssTypeDesigner.tsx  # Main orchestrator
├── hooks/
│   └── usePayanarssTypes.ts   # Data loading, tree building, CRUD
├── types/
│   └── PayanarssType.ts       # Type definitions
├── services/
│   └── aiService.ts           # Supabase AI integration
├── pages/                 # Route pages
├── integrations/          # Supabase client
└── index.css              # Tailwind + custom design tokens
public/
└── data/
    ├── VanakkamPayanarssTypes.json      # 3,121 base types
    └── GymBusiness_PayanarssTypes.json  # Gym domain types
```

## Data Format

Each PayanarssType follows this structure:
```json
{
  "Id": "100000000000000000000000000000000",
  "ParentId": "100000000000000000000000000000000",
  "Name": "ValueType",
  "PayanarssTypeId": "100000000000000000000000000000000",
  "Attributes": [],
  "Description": null
}
```

- **Root nodes**: `Id === ParentId`
- **Tree sidebar** shows GroupType roots (PayanarssTypeId = GroupType ID)
- **Hierarchy**: Up to 5 levels deep via parent-child relationships
