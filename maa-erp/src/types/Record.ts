/**
 * Record Types — Defines the shape of persisted form data.
 * Each record is saved as a JSON file: data/records/{id}.json
 * where id is a UUID v4 generated at save time.
 *
 * IMPORTANT: Data keys are PayanarssType column IDs (not human-readable names).
 * This keeps the data model aligned with the metadata architecture.
 */

/** Discriminator — what kind of form produced this record */
export type RecordType = 'employee' | 'salary' | 'address' | 'documents' | 'bank';

// ═══════════════════════════════════════════════════════════════
// TABLE IDs — PayanarssType IDs for each table
// ═══════════════════════════════════════════════════════════════

export const TABLE_IDS = {
  EMPLOYEE:          'TBL00000000000000000000004660000',
  EMPLOYEE_ADDRESS:  'TBL00000000000000000000004890000',
  EMPLOYEE_DOCUMENT: 'TBL00000000000000000000005040000',
  SALARY_STRUCTURE:  'TBL00000000000000000000008770000',
  BANK_ACCOUNT:      'TBL00000000000000000000000620000',
} as const;

// ═══════════════════════════════════════════════════════════════
// COLUMN IDs — PayanarssType IDs for each field (VALUE_TYPE / LOOKUP_TYPE)
// These are used as keys in saved data AND as HTML element IDs.
// ═══════════════════════════════════════════════════════════════

export const COL = {
  // ─── Employee ───────────────────────────────────
  EMP_CODE:        'COL00000000000000000000004670000',
  EMP_FIRST_NAME:  'COL00000000000000000000004680000',
  EMP_LAST_NAME:   'COL00000000000000000000004690000',
  EMP_EMAIL:       'COL00000000000000000000004700000',
  EMP_PHONE:       'COL00000000000000000000004710000',
  EMP_DOB:         'COL00000000000000000000004720000',
  EMP_DEPARTMENT:  'COL00000000000000000000004750000',
  EMP_DESIGNATION: 'COL00000000000000000000004760000',
  EMP_JOINING:     'COL00000000000000000000004770000',
  EMP_STATUS:      'COL00000000000000000000004780000',

  // ─── Salary Structure ──────────────────────────
  SAL_EMPLOYEE_ID:  'COL00000000000000000000008780000',
  SAL_BASIC:        'COL00000000000000000000008790000',
  SAL_HOUSING:      'COL00000000000000000000008800000',
  SAL_TRANSPORT:    'COL00000000000000000000008810000',
  SAL_OTHER:        'COL00000000000000000000008820000',
  SAL_TOTAL_GROSS:  'COL00000000000000000000008830000',
  SAL_CURRENCY:     'COL00000000000000000000008840000',
  SAL_EFFECTIVE:    'COL00000000000000000000008850000',

  // ─── Employee Address ──────────────────────────
  ADDR_EMPLOYEE_ID: 'COL00000000000000000000004900000',
  ADDR_TYPE:        'COL00000000000000000000004910000',
  ADDR_LINE1:       'COL00000000000000000000004920000',
  ADDR_CITY:        'COL00000000000000000000004930000',
  ADDR_STATE:       'COL00000000000000000000004940000',
  ADDR_COUNTRY:     'COL00000000000000000000004950000',
  ADDR_POSTAL:      'COL00000000000000000000004960000',

  // ─── Employee Document ─────────────────────────
  DOC_EMPLOYEE_ID:  'COL00000000000000000000005050000',
  DOC_TYPE:         'COL00000000000000000000005060000',
  DOC_NUMBER:       'COL00000000000000000000005070000',
  DOC_ISSUE_DATE:   'COL00000000000000000000005080000',
  DOC_EXPIRY:       'COL00000000000000000000005090000',
  DOC_ATTACHMENT:   'COL00000000000000000000005100000',

  // ─── Bank Account Setup ────────────────────────
  BANK_CONFIG_KEY:   'COL00000000000000000000000630000',
  BANK_CONFIG_VALUE: 'COL00000000000000000000000640000',
  BANK_CATEGORY:     'COL00000000000000000000000650000',
  BANK_DESCRIPTION:  'COL00000000000000000000000660000',
} as const;

// ═══════════════════════════════════════════════════════════════
// Reverse mapping: Column ID → Human-readable label
// Used by Pinecone integration to build natural-language text
// for vector embeddings (Option C: Hybrid approach).
// ═══════════════════════════════════════════════════════════════

export const COL_LABELS: Record<string, string> = {
  [COL.EMP_CODE]:        'EmployeeCode',
  [COL.EMP_FIRST_NAME]:  'Name',
  [COL.EMP_LAST_NAME]:   'LastName',
  [COL.EMP_EMAIL]:       'Email',
  [COL.EMP_PHONE]:       'Phone',
  [COL.EMP_DOB]:         'DOB',
  [COL.EMP_DEPARTMENT]:  'Department',
  [COL.EMP_DESIGNATION]: 'Designation',
  [COL.EMP_JOINING]:     'JoiningDate',
  [COL.EMP_STATUS]:      'Status',

  [COL.SAL_EMPLOYEE_ID]:  'EmployeeId',
  [COL.SAL_BASIC]:        'Basic',
  [COL.SAL_HOUSING]:      'Housing',
  [COL.SAL_TRANSPORT]:    'Transport',
  [COL.SAL_OTHER]:        'OtherAllowance',
  [COL.SAL_TOTAL_GROSS]:  'TotalGross',
  [COL.SAL_CURRENCY]:     'Currency',
  [COL.SAL_EFFECTIVE]:    'EffectiveDate',

  [COL.ADDR_EMPLOYEE_ID]: 'EmployeeId',
  [COL.ADDR_TYPE]:        'AddressType',
  [COL.ADDR_LINE1]:       'Address',
  [COL.ADDR_CITY]:        'City',
  [COL.ADDR_STATE]:       'State',
  [COL.ADDR_COUNTRY]:     'Country',
  [COL.ADDR_POSTAL]:      'PostalCode',

  [COL.DOC_EMPLOYEE_ID]:  'EmployeeId',
  [COL.DOC_TYPE]:         'DocumentType',
  [COL.DOC_NUMBER]:       'DocumentNumber',
  [COL.DOC_ISSUE_DATE]:   'IssueDate',
  [COL.DOC_EXPIRY]:       'ExpiryDate',
  [COL.DOC_ATTACHMENT]:   'Attachment',

  [COL.BANK_CONFIG_KEY]:   'BankName',
  [COL.BANK_CONFIG_VALUE]: 'IBAN',
  [COL.BANK_CATEGORY]:     'Category',
  [COL.BANK_DESCRIPTION]:  'Description',
};

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  employee:  'Employee',
  salary:    'SalaryStructure',
  address:   'EmployeeAddress',
  documents: 'EmployeeDocument',
  bank:      'BankAccount',
};

// Module mapping for entity classification
export const RECORD_TYPE_MODULE: Record<RecordType, string> = {
  employee:  'HR',
  salary:    'HR',
  address:   'HR',
  documents: 'HR',
  bank:      'Finance',
};

// ═══════════════════════════════════════════════════════════════
// Record envelope
// ═══════════════════════════════════════════════════════════════

/**
 * Envelope wrapping every saved record.
 * The `id` field doubles as the filename (without .json extension).
 *
 * `tableId` links back to the PayanarssType TABLE_TYPE node.
 * `data` uses column PayanarssType IDs as keys:
 *   { "COL00000000000000000000004680000": "Ahmed", ... }
 */
export interface SavedRecord {
  /** UUID v4 — unique identifier, also the filename */
  id: string;
  /** What kind of form produced this record */
  recordType: RecordType;
  /** PayanarssType TABLE_TYPE Id this record belongs to */
  tableId: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last-modified timestamp */
  updatedAt: string;
  /** Optional parent record link (e.g., salary → employee) */
  parentRecordId?: string;
  /** Form data keyed by PayanarssType column IDs */
  data: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// API response shapes
// ═══════════════════════════════════════════════════════════════

export interface SaveRecordResponse {
  success: boolean;
  id: string;
  error?: string;
}

export interface ListRecordsResponse {
  success: boolean;
  records: SavedRecord[];
  count: number;
  error?: string;
}
