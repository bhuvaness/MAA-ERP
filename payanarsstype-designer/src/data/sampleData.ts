import type { PTNode } from '../types';

let _id = 0;
const uid = () => `node-${++_id}`;

export const SAMPLE_TREE: PTNode[] = [
  {
    id: uid(), name: 'Business Setup', level: 'L1', code: 'BUC-100',
    typeCategory: 'ModuleType', description: 'Register company, trade license, tax, bank, legal entity, branches',
    icon: '💼', color: '#06B6D4', expanded: true,
    children: [
      {
        id: uid(), name: 'Register Company', level: 'L2', code: 'BUC-110',
        typeCategory: 'ProcessType', description: 'Define company identity and fiscal config',
        icon: '🏢', color: '#8B5CF6', expanded: true,
        children: [
          {
            id: uid(), name: 'Define Company Identity', level: 'L3', code: 'BUC-111',
            typeCategory: 'InputType', description: 'Company name EN/AR, type, industry, logo',
            icon: '📋', color: '#22C55E', expanded: false,
            children: [
              {
                id: uid(), name: 'COMPANY', level: 'L4', code: 'ENT-001',
                typeCategory: 'EntityType', description: 'Core company master table',
                icon: '🗃', color: '#F59E0B', expanded: false,
                tableName: 'COMPANY', entityType: 'Master',
                children: [
                  { id: uid(), name: 'company_name_en', level: 'L5', code: 'FLD-001', typeCategory: 'InputType', description: 'Company name in English', icon: '🔤', color: '#EC4899', expanded: false, children: [], columnName: 'company_name_en', dataType: 'NVARCHAR', required: true, maxLength: 200 },
                  { id: uid(), name: 'company_name_ar', level: 'L5', code: 'FLD-002', typeCategory: 'InputType', description: 'Company name in Arabic', icon: '🔤', color: '#EC4899', expanded: false, children: [], columnName: 'company_name_ar', dataType: 'NVARCHAR', required: false, maxLength: 200 },
                  { id: uid(), name: 'business_type', level: 'L5', code: 'FLD-003', typeCategory: 'LookupType', description: 'LLC, Sole Proprietor, Partnership, etc.', icon: '🔤', color: '#EC4899', expanded: false, children: [], columnName: 'business_type', dataType: 'VARCHAR', required: true, maxLength: 50 },
                  { id: uid(), name: 'industry_code', level: 'L5', code: 'FLD-004', typeCategory: 'LookupType', description: 'ISIC industry classification', icon: '🔤', color: '#EC4899', expanded: false, children: [], columnName: 'industry_code', dataType: 'VARCHAR', required: true, maxLength: 20 },
                  { id: uid(), name: 'establishment_date', level: 'L5', code: 'FLD-005', typeCategory: 'DateType', description: 'Date company was established', icon: '🔤', color: '#EC4899', expanded: false, children: [], columnName: 'establishment_date', dataType: 'DATE', required: false },
                  { id: uid(), name: 'logo_url', level: 'L5', code: 'FLD-006', typeCategory: 'FileType', description: 'Company logo image URL', icon: '🔤', color: '#EC4899', expanded: false, children: [], columnName: 'logo_url', dataType: 'VARCHAR', required: false, maxLength: 500 },
                ],
              },
            ],
          },
          {
            id: uid(), name: 'Register Contact Details', level: 'L3', code: 'BUC-112',
            typeCategory: 'InputType', description: 'Phone, email, website, social media',
            icon: '📋', color: '#22C55E', expanded: false, children: [],
          },
          {
            id: uid(), name: 'Register Company Address', level: 'L3', code: 'BUC-113',
            typeCategory: 'GeoType', description: 'Building, street, area, city, emirate, GPS',
            icon: '📋', color: '#22C55E', expanded: false, children: [],
          },
        ],
      },
      {
        id: uid(), name: 'Trade License Management', level: 'L2', code: 'BUC-120',
        typeCategory: 'ProcessType', description: 'License registration, renewal, amendments',
        icon: '📜', color: '#8B5CF6', expanded: false, children: [],
      },
      {
        id: uid(), name: 'Tax Registration (VAT/GST)', level: 'L2', code: 'BUC-130',
        typeCategory: 'ProcessType', description: 'TRN, tax rates, returns, compliance',
        icon: '💰', color: '#8B5CF6', expanded: false, children: [],
      },
    ],
  },
  {
    id: uid(), name: 'HR & Payroll', level: 'L1', code: 'BUC-200',
    typeCategory: 'ModuleType', description: 'Employees, attendance, leave, payroll, WPS',
    icon: '👤', color: '#22C55E', expanded: false, children: [],
  },
  {
    id: uid(), name: 'Finance & Accounting', level: 'L1', code: 'BUC-300',
    typeCategory: 'ModuleType', description: 'GL, AP, AR, bank reconciliation, tax',
    icon: '💵', color: '#F59E0B', expanded: false, children: [],
  },
];
