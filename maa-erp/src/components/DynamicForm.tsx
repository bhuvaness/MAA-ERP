/**
 * DynamicForm.tsx
 * ===============
 * Renders a data entry form dynamically from PayanarssType hierarchy.
 *
 * HOW IT WORKS:
 *   1. Receives a tableId (TableType or ChildTableType node)
 *   2. Finds all child nodes of that table
 *   3. Filters: only column nodes (Text/Number/DateTime/Boolean/Blob/Lookup)
 *   4. Maps PayanarssTypeId → appropriate HTML input type
 *   5. Renders styled form matching MAA ERP dark theme
 *
 * PayanarssTypeId → Input mapping:
 *   006 (Text)     → <input type="text">
 *   007 (Number)   → <input type="number">
 *   008 (DateTime) → <input type="date"> or <input type="datetime-local">
 *   009 (Boolean)  → toggle switch
 *   010 (Blob)     → file upload
 *   003 (Lookup)   → <select> dropdown
 *
 * USAGE:
 *   <DynamicForm
 *     tableId="TBL00000000000000000000001230"
 *     allTypes={allPayanarssTypes}    // flat array from JSON
 *     onSave={(formData) => console.log(formData)}
 *     onCancel={() => goBack()}
 *   />
 */

import React, { useState, useMemo, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface PayanarssType {
  Id: string;
  ParentId: string;
  Name: string;
  PayanarssTypeId: string;
  Attributes: any[];
  Description: string | null;
}

interface DynamicFormProps {
  /** Id of the TableType/ChildTableType node whose children are columns */
  tableId: string;
  /** Full flat array of all PayanarssTypes (from JSON / API) */
  allTypes: PayanarssType[];
  /** Called with { columnName: value } when user saves */
  onSave: (formData: Record<string, any>) => void;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Optional: pre-filled values for editing existing record */
  initialValues?: Record<string, any>;
  /** Optional: title override (defaults to table Name) */
  title?: string;
}

// ═══════════════════════════════════════════════════════════════
// CORRECT PayanarssTypeId CONSTANTS
// ═══════════════════════════════════════════════════════════════

const P = {
  ValueType:       '100000000000000000000000000000000',
  TableType:       '100000000000000000000000000000001',
  ChildTableType:  '100000000000000000000000000000002',
  LookupType:      '100000000000000000000000000000003',
  GroupType:       '100000000000000000000000000000004',
  AttributeType:   '100000000000000000000000000000005',
  Text:            '100000000000000000000000000000006',
  Number:          '100000000000000000000000000000007',
  DateTime:        '100000000000000000000000000000008',
  Boolean:         '100000000000000000000000000000009',
  Blob:            '100000000000000000000000000000010',
  BusinessUseCase: '10000000000000000000000000000000111',
};

/** Which PayanarssTypeIds represent form-renderable columns */
const COLUMN_TYPE_IDS = new Set([
  P.Text, P.Number, P.DateTime, P.Boolean, P.Blob, P.LookupType
]);

/** Human-friendly labels for data types */
const TYPE_LABEL: Record<string, string> = {
  [P.Text]: 'Text',
  [P.Number]: 'Number',
  [P.DateTime]: 'Date/Time',
  [P.Boolean]: 'Yes/No',
  [P.Blob]: 'File',
  [P.LookupType]: 'Select',
};

/** Accent colors per data type (for field indicators) */
const TYPE_COLOR: Record<string, string> = {
  [P.Text]: '#8b5cf6',
  [P.Number]: '#06b6d4',
  [P.DateTime]: '#f59e0b',
  [P.Boolean]: '#10b981',
  [P.Blob]: '#ec4899',
  [P.LookupType]: '#3b82f6',
};

// ═══════════════════════════════════════════════════════════════
// HELPER: Extract lookup options from Description
// ═══════════════════════════════════════════════════════════════

/**
 * Parses lookup options from the Description field.
 * e.g., "Active/Pending/Expired/Cancelled" → ["Active", "Pending", ...]
 */
function parseLookupOptions(description: string | null): string[] {
  if (!description) return ['Option 1', 'Option 2', 'Option 3'];
  // Check if description contains slash-separated values
  if (description.includes('/')) {
    return description.split('/').map(s => s.trim()).filter(Boolean);
  }
  return ['Option 1', 'Option 2', 'Option 3'];
}

/**
 * Determines if a DateTime field is date-only or includes time.
 * Heuristic: if name contains "Time", "At", "Timestamp" → datetime-local
 */
function isDateTimeField(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('time') || lower.includes('timestamp') || lower.endsWith('at');
}

/**
 * Checks if a field should be auto-generated (not user-editable).
 * Audit fields and auto-number codes are read-only or auto-filled.
 */
function isAutoField(name: string): boolean {
  const auto = ['CreatedBy', 'CreatedOn', 'ModifiedBy', 'ModifiedOn'];
  return auto.includes(name);
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

const DynamicForm: React.FC<DynamicFormProps> = ({
  tableId, allTypes, onSave, onCancel, initialValues = {}, title
}) => {

  // ── Resolve table and columns ──
  const tableNode = useMemo(() => allTypes.find(t => t.Id === tableId), [allTypes, tableId]);

  const columns = useMemo(() => {
    return allTypes
      .filter(t => t.ParentId === tableId && t.Id !== t.ParentId)
      .filter(t => COLUMN_TYPE_IDS.has(t.PayanarssTypeId))  // Only data columns
      .filter(t => !isAutoField(t.Name));                    // Skip audit fields
  }, [allTypes, tableId]);

  const rules = useMemo(() => {
    return allTypes
      .filter(t => t.ParentId === tableId && t.PayanarssTypeId === P.GroupType)
      .map(t => t.Name);
  }, [allTypes, tableId]);

  // ── Form state ──
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    for (const col of columns) {
      if (initialValues[col.Name] !== undefined) {
        init[col.Name] = initialValues[col.Name];
      } else if (col.PayanarssTypeId === P.Boolean) {
        init[col.Name] = false;
      } else {
        init[col.Name] = '';
      }
    }
    return init;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = useCallback((name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
  }, []);

  // ── Validation ──
  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    // Check REQUIRED rules
    for (const rule of rules) {
      if (rule.startsWith('REQUIRED:')) {
        const fieldName = rule.replace('REQUIRED:', '').replace('is mandatory', '').trim();
        const col = columns.find(c => c.Name === fieldName);
        if (col && !formData[col.Name]) {
          errs[col.Name] = `${col.Name} is required`;
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [rules, columns, formData]);

  const handleSave = useCallback(() => {
    if (validate()) onSave(formData);
  }, [validate, formData, onSave]);

  // ── Count fields by type ──
  const fieldCount = columns.length;
  const formTitle = title || tableNode?.Name || 'New Record';

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════

  if (!tableNode) {
    return <div style={{ padding: 20, color: 'var(--text-4)' }}>Table not found: {tableId}</div>;
  }

  return (
    <div className="dynamic-form" style={styles.wrapper}>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerDot} />
          <h3 style={styles.headerTitle}>{formTitle}</h3>
        </div>
        <span style={styles.fieldCount}>{fieldCount} FIELDS</span>
      </div>

      {/* Form body */}
      <div style={styles.body}>
        {columns.map((col) => {
          const typeId = col.PayanarssTypeId;
          const color = TYPE_COLOR[typeId] || '#8b5cf6';
          const value = formData[col.Name] ?? '';
          const error = errors[col.Name];
          const isRequired = rules.some(r => r.includes(`REQUIRED: ${col.Name}`));
          const isAutoNum = rules.some(r => r.includes(`AUTO-NUMBER: ${col.Name}`));

          return (
            <div key={col.Id} style={styles.fieldGroup}>
              <label style={styles.label}>
                {col.Name}
                {isRequired && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                {isAutoNum && <span style={styles.autoBadge}>AUTO</span>}
              </label>

              {/* TEXT → text input */}
              {typeId === P.Text && (
                <input
                  type="text"
                  value={value}
                  onChange={e => updateField(col.Name, e.target.value)}
                  placeholder={col.Description || `Enter ${col.Name}`}
                  readOnly={isAutoNum}
                  style={{
                    ...styles.input,
                    ...(isAutoNum ? styles.inputAuto : {}),
                    ...(error ? styles.inputError : {}),
                    borderColor: isAutoNum ? 'var(--accent)' : undefined,
                    color: isAutoNum ? 'var(--accent)' : undefined,
                  }}
                />
              )}

              {/* NUMBER → number input */}
              {typeId === P.Number && (
                <input
                  type="number"
                  value={value}
                  onChange={e => updateField(col.Name, e.target.value)}
                  placeholder={col.Description || '0'}
                  step="any"
                  style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
                />
              )}

              {/* DATETIME → date or datetime-local */}
              {typeId === P.DateTime && (
                <input
                  type={isDateTimeField(col.Name) ? 'datetime-local' : 'date'}
                  value={value}
                  onChange={e => updateField(col.Name, e.target.value)}
                  style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
                />
              )}

              {/* BOOLEAN → toggle switch */}
              {typeId === P.Boolean && (
                <div
                  onClick={() => updateField(col.Name, !value)}
                  style={{ ...styles.toggle, background: value ? 'var(--accent)' : 'var(--bg-base)' }}
                >
                  <div style={{
                    ...styles.toggleKnob,
                    transform: value ? 'translateX(20px)' : 'translateX(2px)',
                  }} />
                  <span style={styles.toggleLabel}>{value ? 'Yes' : 'No'}</span>
                </div>
              )}

              {/* BLOB → file input */}
              {typeId === P.Blob && (
                <div style={styles.fileUpload}>
                  <input
                    type="file"
                    onChange={e => updateField(col.Name, e.target.files?.[0]?.name || '')}
                    style={styles.fileInput}
                  />
                  <span style={styles.filePlaceholder}>
                    {value ? `📎 ${value}` : `📎 Upload ${col.Description || col.Name}`}
                  </span>
                </div>
              )}

              {/* LOOKUP → select dropdown */}
              {typeId === P.LookupType && (
                <select
                  value={value}
                  onChange={e => updateField(col.Name, e.target.value)}
                  style={{ ...styles.input, ...styles.select, ...(error ? styles.inputError : {}) }}
                >
                  <option value="">Select {col.Name}...</option>
                  {parseLookupOptions(col.Description).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}

              {error && <span style={styles.errorText}>{error}</span>}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <button onClick={handleSave} style={styles.saveButton}>
          Save & Continue
        </button>
        {onCancel && (
          <button onClick={onCancel} style={styles.cancelButton}>
            Cancel
          </button>
        )}
        <span style={styles.autoSave}>
          <span style={styles.autoSaveDot} />
          Auto-saves
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES — matches MAA ERP dark theme using CSS variables
// ═══════════════════════════════════════════════════════════════

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    background: 'var(--bg-surface, #1a1a2e)',
    borderRadius: 12,
    border: '1px solid var(--border, #2a2a4a)',
    overflow: 'hidden',
    maxWidth: 640,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border, #2a2a4a)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--accent, #8b5cf6)',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-1, #e2e8f0)',
    margin: 0,
  },
  fieldCount: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--accent, #8b5cf6)',
    background: 'var(--bg-base, #0f0f23)',
    padding: '3px 8px',
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  body: {
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    color: 'var(--text-3, #94a3b8)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  autoBadge: {
    fontSize: 9,
    fontWeight: 600,
    color: 'var(--accent, #8b5cf6)',
    background: 'rgba(139,92,246,0.15)',
    padding: '1px 5px',
    borderRadius: 3,
    marginLeft: 6,
  },
  input: {
    padding: '9px 12px',
    fontSize: 13,
    color: 'var(--text-1, #e2e8f0)',
    background: 'var(--bg-base, #0f0f23)',
    border: '1px solid var(--border, #2a2a4a)',
    borderRadius: 6,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  },
  inputAuto: {
    borderColor: 'var(--accent, #8b5cf6)',
    color: 'var(--accent, #8b5cf6)',
    fontWeight: 500,
    cursor: 'default',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  select: {
    cursor: 'pointer',
    appearance: 'auto' as const,
  },
  toggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    width: 46,
    height: 24,
    borderRadius: 12,
    border: '1px solid var(--border, #2a2a4a)',
    cursor: 'pointer',
    position: 'relative' as const,
    transition: 'background 0.2s',
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.2s',
    position: 'absolute' as const,
  },
  toggleLabel: {
    fontSize: 11,
    color: 'var(--text-3)',
    marginLeft: 54,
  },
  fileUpload: {
    position: 'relative' as const,
    overflow: 'hidden',
  },
  fileInput: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  filePlaceholder: {
    display: 'block',
    padding: '9px 12px',
    fontSize: 13,
    color: 'var(--text-4, #64748b)',
    background: 'var(--bg-base, #0f0f23)',
    border: '1px dashed var(--border, #2a2a4a)',
    borderRadius: 6,
    cursor: 'pointer',
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 18px',
    borderTop: '1px solid var(--border, #2a2a4a)',
  },
  saveButton: {
    padding: '8px 20px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    background: 'var(--accent, #8b5cf6)',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  },
  cancelButton: {
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-3)',
    background: 'none',
    border: '1px solid var(--border, #2a2a4a)',
    borderRadius: 8,
    cursor: 'pointer',
  },
  autoSave: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: 'var(--accent, #8b5cf6)',
    marginLeft: 'auto',
  },
  autoSaveDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--accent, #8b5cf6)',
  },
};

export default DynamicForm;
