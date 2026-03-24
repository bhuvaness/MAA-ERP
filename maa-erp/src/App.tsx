import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MenuItem, RelatedType } from './types';
import { COL, TABLE_IDS } from './types/Record';
import { RELATED_FORMS, KNOWN_COLUMNS, EXT_COLORS } from './data/menuData';
import { useSetupFlow } from './hooks/useSetupFlow';
import { useChat } from './hooks/useChat';
import { saveRecord, saveBusinessConfig, loadBusinessConfig } from './services/recordService';
import { initPinecone, upsertToVector, queryVectors } from './services/pineconeService';
import ContextPanel from './components/ContextPanel';
import RightContextPanel from './components/RightContextPanel';
import WelcomeScreen from './components/WelcomeScreen';
import BusinessSetupWizard from './components/BusinessSetupWizard';
import ChatInput from './components/ChatInput';
import ImportModal from './components/ImportModal';
import MessageList from './components/MessageList';
import {
  progressHTML, successHTML, setupSummaryHTML,
  employeeFormHTML, employeeSavedHTML,
  relatedFormHTML, relatedSavedHTML,
  exploreModulesHTML, attendanceReportHTML,
  importPreviewHTML,
  searchResultsHTML, noResultsHTML,
} from './utils/htmlBuilders';
import VikiBusinessChat from './components/VikiBusinessChat';
import './styles/viki-chat.css';

const App: React.FC = () => {
  const setup = useSetupFlow();
  const chat = useChat();
  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Controls which screen is visible.
   *   'welcome' -> Viki welcome screen
   *   'wizard'  -> BusinessSetupWizard
   *   'chat'    -> Chat interface (post-setup)
   */
  const [screen, setScreen] = useState<'viki-setup' | 'welcome' | 'wizard' | 'chat'>('viki-setup');
  const [lastEmployeeId, setLastEmployeeId] = useState<string | null>(null);

  /* ═══════════════════════════════════════════════════════════
   * Refs for handlers — avoids stale closures in the global
   * click listener that is registered once (empty dep array).
   * ═══════════════════════════════════════════════════════════ */
  const handleSaveEmployeeRef = useRef<() => void>(() => {});
  const handlePostSetupRef = useRef<(type: string) => void>(() => {});
  const handleSavedRelatedRef = useRef<(type: RelatedType) => void>(() => {});
  const handleDoImportRef = useRef<(fn: string, rows: string) => void>(() => {});
  const handleSetupAnswerRef = useRef<(stepId: string, value: string) => void>(() => {});
  const handleSkipRef = useRef<(step: string) => void>(() => {});
  const handleAddRelatedRef = useRef<(type: RelatedType) => void>(() => {});

  /* ═══ Delegated click handlers for dynamic HTML ═══ */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const actionEl = target.closest('[data-action]') as HTMLElement | null;
      const relatedEl = target.closest('[data-related]') as HTMLElement | null;

      if (actionEl) {
        const action = actionEl.dataset.action;
        if (action === 'save-employee') handleSaveEmployeeRef.current();
        if (action === 'add-employee') handlePostSetupRef.current('employee');
        if (action === 'open-import') setImportOpen(true);
        if (action === 'explore') handlePostSetupRef.current('explore');
        if (action === 'save-related') {
          const type = actionEl.dataset.type as RelatedType;
          if (type) handleSavedRelatedRef.current(type);
        }
        if (action === 'do-import') {
          const fn = actionEl.dataset.fn || '';
          const rows = actionEl.dataset.rows || '0';
          handleDoImportRef.current(fn, rows);
        }
        if (action === 'industry') {
          const value = actionEl.dataset.value || '';
          handleSetupAnswerRef.current('industry', value);
        }
        if (action === 'skip') {
          const step = actionEl.dataset.step || '';
          handleSkipRef.current(step);
        }
        if (action === 'next') {
          const step = actionEl.dataset.step || '';
          const inputId = actionEl.dataset.input || '';
          const input = document.getElementById(inputId) as HTMLInputElement | null;
          const value = input?.value || actionEl.dataset.default || '';
          handleSetupAnswerRef.current(step, value);
        }
        if (action === 'drill-usecase') {
          const id = actionEl.dataset.id || '';
          if (id) handleDrillUseCase(id);
        }
        if (action === 'drill-segment') {
          const id = actionEl.dataset.id || '';
          if (id) handleDrillSegment(id);
        }
        if (action === 'back-segments') {
          handleBackToSegments();
        }
        if (action === 'select-segment') {
          const id = actionEl.dataset.id || '';
          if (id) handleSelectSegment(id);
        }
        if (action === 'tc-root') {
          handleTcRoot();
        }
        if (action === 'tc-nav') {
          const idx = parseInt(actionEl.dataset.index || '0', 10);
          handleTcNav(idx);
        }
      }

      if (relatedEl) {
        const type = relatedEl.dataset.related as RelatedType;
        if (type) handleAddRelatedRef.current(type);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  /* ═══ Pinecone init (fire-and-forget) ═══ */
  useEffect(() => {
    initPinecone().then(r => {
      if (r.success) console.log('Pinecone connected:', r.index);
      else console.warn('Pinecone init skipped:', r.error);
    });
  }, []);

  /* ═══ Load saved business config on mount ═══ */
  useEffect(() => {
    loadBusinessConfig().then(res => {
      if (res.success && res.exists && res.config?.setupComplete) {
        console.log('Restored business config from file system');
        setup.restoreSetup(res.config.setupData || {});
        setScreen('chat');
        const name = res.config.setupData?.name || 'Your Business';
        chat.addVikiMessage(
          `<div class="msg-text">Welcome back! 👋</div>
          ${successHTML(`<strong>${name}</strong> is configured and ready`)}
          <div class="msg-text" style="margin-top:12px">What would you like to do?</div>
          <div class="msg-actions">
            <button class="action-chip" data-action="add-employee"><span class="chip-icon">👤</span> Add Employee</button>
            <button class="action-chip" data-action="open-import"><span class="chip-icon">📎</span> Import Data</button>
            <button class="action-chip" data-action="explore"><span class="chip-icon">🔍</span> Explore Modules</button>
          </div>`
        );
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ═══ SETUP FLOW ═══ */

  const handleBeginSetup = useCallback(() => {
    setScreen('wizard');
  }, []);

  const handleWizardComplete = useCallback(async (selectedIds: string[]) => {
    setup.beginSetup();
    setup.setCurrentStep(6);
    setup.setShowChat(true);
    setScreen('chat');

    const count = selectedIds.length;
    await chat.addVikiMessage(
      `<div class="msg-text">Your business is configured! 🎉</div>
      ${successHTML(`<strong>${count} modules</strong> selected and activated`)}
      <div class="msg-text" style="margin-top:12px">
        Your MAA ERP workspace is ready. I've loaded all the selected modules,
        tables, and business rules. What would you like to do first?
      </div>
      <div class="msg-actions">
        <button class="action-chip" data-action="tc-root"><span class="chip-icon">🎯</span> Identify Target Customer</button>
        <button class="action-chip" data-action="add-employee"><span class="chip-icon">👤</span> Add Employee</button>
        <button class="action-chip" data-action="open-import"><span class="chip-icon">📎</span> Import Data</button>
        <button class="action-chip" data-action="explore"><span class="chip-icon">🔍</span> Explore Modules</button>
      </div>`
    );

    localStorage.setItem('maa-erp-business-config', JSON.stringify({
      selectedTypeIds: selectedIds,
      configuredAt: new Date().toISOString(),
    }));

    // Persist business config to file system
    saveBusinessConfig({
      setupComplete: true,
      setupData: setup.setupData,
      selectedTypeIds: selectedIds,
    }).then(r => r.success
      ? console.log('Business config saved to file system')
      : console.warn('Business config save skipped:', r.error)
    );
  }, [setup, chat]);

  const handleWizardCancel = useCallback(() => {
    setScreen('welcome');
  }, []);

  const handleSetupAnswer = useCallback(async (stepId: string, value: string) => {
    setup.updateSetupData(stepId, value);
    chat.addUserMessage(value);

    if (stepId === 'industry') {
      setup.setCurrentStep(1);
      await chat.addVikiMessage(
        `${successHTML(`Industry: <strong>${value}</strong> — 12 modules loaded`)}${progressHTML(1)}
        <div class="msg-text" style="margin-top:12px"><strong>Step 2: Business Name</strong></div>
        <div class="msg-form-card"><div class="form-card-header"><div class="form-card-dot" style="background:var(--accent)"></div><h4>Business Name</h4></div>
          <div class="form-card-body"><div class="fc-field"><label class="fc-label">Company Name (English)</label><input class="fc-input" id="companyName" placeholder="e.g., Flavor House Restaurant LLC"/></div><div class="fc-field"><label class="fc-label">Company Name (Arabic, optional)</label><input class="fc-input" placeholder="optional" dir="rtl"/></div></div>
          <div class="form-card-footer"><button class="fc-save" data-action="next" data-step="name" data-input="companyName" data-default="My Business">Next →</button><span class="fc-autosave"><span class="fc-autosave-dot"></span> Auto-saves</span></div></div>`, 500);
    } else if (stepId === 'name') {
      setup.setCurrentStep(2);
      await chat.addVikiMessage(
        `${successHTML(`Business: <strong>${value}</strong>`)}${progressHTML(2)}
        <div class="msg-text" style="margin-top:12px"><strong>Step 3: Trade License</strong></div>
        <div class="msg-form-card"><div class="form-card-header"><div class="form-card-dot" style="background:var(--blue)"></div><h4>Trade License</h4><span class="form-card-badge" style="background:var(--blue-soft);color:var(--blue)">LEGAL</span></div>
          <div class="form-card-body"><div class="fc-row"><div class="fc-field"><label class="fc-label">License Number</label><input class="fc-input" id="licNo" placeholder="CN-123456"/></div><div class="fc-field"><label class="fc-label">Authority</label><select class="fc-input"><option>DED Abu Dhabi</option><option>DED Dubai</option><option>ADGM</option><option>DMCC</option></select></div></div><div class="fc-row"><div class="fc-field"><label class="fc-label">Issue Date</label><input class="fc-input" type="date"/></div><div class="fc-field"><label class="fc-label">Expiry</label><input class="fc-input" type="date"/></div></div></div>
          <div class="form-card-footer"><button class="fc-save" data-action="next" data-step="license" data-input="licNo" data-default="CN-123456">Next →</button><button class="fc-skip" data-action="skip" data-step="license">Skip</button></div></div>`, 500);
    } else if (stepId === 'license') {
      setup.setCurrentStep(3);
      await chat.addVikiMessage(
        `${successHTML('Trade license saved')}${progressHTML(3)}
        <div class="msg-text" style="margin-top:12px"><strong>Step 4: Commercial Registration</strong></div>
        <div class="msg-form-card"><div class="form-card-header"><div class="form-card-dot" style="background:var(--pink)"></div><h4>Commercial Registration</h4><span class="form-card-badge" style="background:var(--pink-soft);color:var(--pink)">LEGAL</span></div>
          <div class="form-card-body"><div class="fc-row"><div class="fc-field"><label class="fc-label">CR Number</label><input class="fc-input" id="crNo" placeholder="1234567890"/></div><div class="fc-field"><label class="fc-label">Issuing Authority</label><select class="fc-input"><option>MoEC Abu Dhabi</option><option>MoEC Dubai</option></select></div></div><div class="fc-row"><div class="fc-field"><label class="fc-label">Issue Date</label><input class="fc-input" type="date"/></div><div class="fc-field"><label class="fc-label">Expiry</label><input class="fc-input" type="date"/></div></div></div>
          <div class="form-card-footer"><button class="fc-save" data-action="next" data-step="cr" data-input="crNo" data-default="1234567890">Next →</button><button class="fc-skip" data-action="skip" data-step="cr">Skip</button></div></div>`, 500);
    } else if (stepId === 'cr') {
      setup.setCurrentStep(4);
      await chat.addVikiMessage(
        `${successHTML('Commercial registration saved')}${progressHTML(4)}
        <div class="msg-text" style="margin-top:12px"><strong>Step 5: VAT Registration</strong></div>
        <div class="msg-form-card"><div class="form-card-header"><div class="form-card-dot" style="background:var(--green)"></div><h4>VAT Registration</h4><span class="form-card-badge" style="background:var(--green-soft);color:var(--green)">TAX</span></div>
          <div class="form-card-body"><div class="fc-row"><div class="fc-field"><label class="fc-label">TRN (Tax Registration Number)</label><input class="fc-input" id="trnNo" placeholder="100XXXXXXXXX"/></div><div class="fc-field"><label class="fc-label">VAT Rate</label><select class="fc-input"><option>5% (UAE Standard)</option><option>0% (Exempt)</option></select></div></div></div>
          <div class="form-card-footer"><button class="fc-save" data-action="next" data-step="vat" data-input="trnNo" data-default="100000000000">Next →</button><button class="fc-skip" data-action="skip" data-step="vat">Skip</button></div></div>`, 500);
    } else if (stepId === 'vat') {
      setup.setCurrentStep(5);
      await chat.addVikiMessage(
        `${successHTML('VAT registered')}${progressHTML(5)}
        <div class="msg-text" style="margin-top:12px"><strong>Step 6: Contact Information</strong></div>
        <div class="msg-form-card"><div class="form-card-header"><div class="form-card-dot" style="background:var(--accent)"></div><h4>Contact Details</h4></div>
          <div class="form-card-body"><div class="fc-row"><div class="fc-field"><label class="fc-label">Phone</label><input class="fc-input" id="phone" placeholder="+971 XX XXX XXXX"/></div><div class="fc-field"><label class="fc-label">Email</label><input class="fc-input" id="email" type="email" placeholder="info@company.ae"/></div></div><div class="fc-field"><label class="fc-label">Address</label><input class="fc-input" placeholder="Office 123, Tower A, Abu Dhabi"/></div></div>
          <div class="form-card-footer"><button class="fc-save" data-action="next" data-step="contact" data-input="phone" data-default="+971 50 123 4567">Complete Setup →</button></div></div>`, 500);
    } else if (stepId === 'contact') {
      setup.setCurrentStep(6);
      const d = setup.setupData;
      await chat.addVikiMessage(
        `${successHTML('All done!')}${progressHTML(6)}
      ${setupSummaryHTML(d)}
      <div class="msg-text" style="margin-top:12px">What would you like to do next?</div>
      <div class="msg-actions">
        <button class="action-chip" data-action="add-employee"><span class="chip-icon">👤</span> Add Employee</button>
        <button class="action-chip" data-action="open-import"><span class="chip-icon">📎</span> Import Data</button>
        <button class="action-chip" data-action="explore"><span class="chip-icon">🔍</span> Explore Modules</button>
      </div>`, 500);

      // Persist business config to file system (chat-based setup)
      saveBusinessConfig({
        setupComplete: true,
        setupData: { ...d, contact: value },
      }).then(r => r.success
        ? console.log('Business config saved to file system')
        : console.warn('Business config save skipped:', r.error)
      );
    }
  }, [setup, chat]);

  const handleSkip = useCallback((step: string) => {
    chat.addUserMessage('Skipped');
    if (step === 'license') handleSetupAnswer('license', '—');
    if (step === 'cr') handleSetupAnswer('cr', '—');
    if (step === 'vat') handleSetupAnswer('vat', '—');
  }, [chat, handleSetupAnswer]);

  /* ═══ POST-SETUP ═══ */
  const handlePostSetup = useCallback(async (type: string) => {
    setup.setShowChat(true);
    setScreen('chat');
    if (type === 'employee') {
      chat.updateContext('New Employee', 'HR › Employee Management');
      await chat.addVikiMessage(`<div class="msg-text">Let's add a new employee.</div>${employeeFormHTML()}`);
    }
    if (type === 'explore') await chat.addVikiMessage(exploreModulesHTML());
  }, [setup, chat]);

  const handleSaveEmployee = useCallback(async () => {
    const codeEl = document.getElementById(COL.EMP_CODE) as HTMLInputElement | null;
    const nameEl = document.getElementById(COL.EMP_FIRST_NAME) as HTMLInputElement | null;
    const deptEl = document.getElementById(COL.EMP_DEPARTMENT) as HTMLSelectElement | null;
    const dobEl = document.getElementById(COL.EMP_DOB) as HTMLInputElement | null;
    const code = codeEl?.value || 'EMP-0001';
    const name = nameEl?.value || 'Ahmed Al Rashid';
    const dept = deptEl?.value || 'Operations';
    const dob = dobEl?.value || '';

    // Show user message with the entered values
    chat.addUserMessage(
      `<strong>${name}</strong> · ${dept}${dob ? ` · DOB ${dob}` : ''} · ${code}`
    );

    // Persist to file system -> data/records/{uuid}.json
    // Keys are PayanarssType column IDs
    const result = await saveRecord('employee', {
      [COL.EMP_CODE]: code,
      [COL.EMP_FIRST_NAME]: name,
      [COL.EMP_DEPARTMENT]: dept,
      [COL.EMP_DOB]: dob,
    }, TABLE_IDS.EMPLOYEE);

    if (result.success) {
      setLastEmployeeId(result.id);
      console.log(`Employee saved -> ${result.id}.json`);
      // Fire-and-forget upsert to Pinecone
      upsertToVector(result.id, 'employee', TABLE_IDS.EMPLOYEE, {
        [COL.EMP_CODE]: code,
        [COL.EMP_FIRST_NAME]: name,
        [COL.EMP_DEPARTMENT]: dept,
        [COL.EMP_DOB]: dob,
      }).then(r => r.success
        ? console.log('Pinecone upsert OK:', result.id)
        : console.warn('Pinecone upsert skipped:', r.error)
      );
      await chat.addVikiMessage(employeeSavedHTML(name, code, dept), 600);
    } else {
      await chat.addVikiMessage(
        `<div class="msg-text" style="color:var(--rose)">Save failed: ${result.error || 'Unknown error'}</div>`, 300
      );
    }
  }, [chat]);

  const handleAddRelated = useCallback(async (type: RelatedType) => {
    const form = RELATED_FORMS[type];
    if (!form) return;
    chat.addUserMessage(`Add ${form.title.toLowerCase()}`);
    await chat.addVikiMessage(relatedFormHTML(form, type));
  }, [chat]);

  const handleSavedRelated = useCallback(async (type: RelatedType) => {
    const labels: Record<string, string> = { salary: 'Salary Structure', address: 'Address', documents: 'Document', bank: 'Bank Account' };

    // Map related type -> table ID
    const tableMap: Record<string, string> = {
      salary: TABLE_IDS.SALARY_STRUCTURE,
      address: TABLE_IDS.EMPLOYEE_ADDRESS,
      documents: TABLE_IDS.EMPLOYEE_DOCUMENT,
      bank: TABLE_IDS.BANK_ACCOUNT,
    };

    // Read form values using PayanarssType column IDs
    let formData: Record<string, unknown> = {};
    let summaryParts: string[] = [];

    if (type === 'salary') {
      const basic = (document.getElementById(COL.SAL_BASIC) as HTMLInputElement)?.value || '0';
      const housing = (document.getElementById(COL.SAL_HOUSING) as HTMLInputElement)?.value || '0';
      const transport = (document.getElementById(COL.SAL_TRANSPORT) as HTMLInputElement)?.value || '0';
      const effective = (document.getElementById(COL.SAL_EFFECTIVE) as HTMLInputElement)?.value || '';
      formData = {
        [COL.SAL_BASIC]: parseFloat(basic),
        [COL.SAL_HOUSING]: parseFloat(housing),
        [COL.SAL_TRANSPORT]: parseFloat(transport),
        [COL.SAL_EFFECTIVE]: effective,
        [COL.SAL_EMPLOYEE_ID]: lastEmployeeId || '',
      };
      summaryParts = [`Basic: ${basic}`, `Housing: ${housing}`, `Transport: ${transport}`];
      if (effective) summaryParts.push(`From: ${effective}`);
    } else if (type === 'address') {
      const line1 = (document.getElementById(COL.ADDR_LINE1) as HTMLInputElement)?.value || '';
      const city = (document.getElementById(COL.ADDR_CITY) as HTMLSelectElement)?.value || '';
      const country = (document.getElementById(COL.ADDR_COUNTRY) as HTMLSelectElement)?.value || '';
      formData = {
        [COL.ADDR_LINE1]: line1,
        [COL.ADDR_CITY]: city,
        [COL.ADDR_COUNTRY]: country,
        [COL.ADDR_EMPLOYEE_ID]: lastEmployeeId || '',
      };
      summaryParts = [line1, city, country].filter(Boolean);
    } else if (type === 'documents') {
      const docType = (document.getElementById(COL.DOC_TYPE) as HTMLSelectElement)?.value || '';
      const docNumber = (document.getElementById(COL.DOC_NUMBER) as HTMLInputElement)?.value || '';
      const expiry = (document.getElementById(COL.DOC_EXPIRY) as HTMLInputElement)?.value || '';
      formData = {
        [COL.DOC_TYPE]: docType,
        [COL.DOC_NUMBER]: docNumber,
        [COL.DOC_EXPIRY]: expiry,
        [COL.DOC_EMPLOYEE_ID]: lastEmployeeId || '',
      };
      summaryParts = [docType, docNumber];
      if (expiry) summaryParts.push(`Exp: ${expiry}`);
    } else if (type === 'bank') {
      const bank = (document.getElementById(COL.BANK_CONFIG_KEY) as HTMLSelectElement)?.value || '';
      const iban = (document.getElementById(COL.BANK_CONFIG_VALUE) as HTMLInputElement)?.value || '';
      formData = {
        [COL.BANK_CONFIG_KEY]: bank,
        [COL.BANK_CONFIG_VALUE]: iban,
      };
      summaryParts = [bank, iban].filter(Boolean);
    }

    // Show user message with the entered values
    chat.addUserMessage(`${labels[type]}: <strong>${summaryParts.join(' · ')}</strong>`);

    // Persist to file system, linked to last employee if available
    const result = await saveRecord(type, formData, tableMap[type], lastEmployeeId || undefined);

    if (result.success) {
      console.log(`${labels[type]} saved -> ${result.id}.json`);
      // Fire-and-forget upsert to Pinecone
      upsertToVector(result.id, type, tableMap[type], formData, lastEmployeeId || undefined)
        .then(r => r.success
          ? console.log('Pinecone upsert OK:', result.id)
          : console.warn('Pinecone upsert skipped:', r.error)
        );
      await chat.addVikiMessage(relatedSavedHTML(labels[type] || type, summaryParts.join(' · ')), 300);
    } else {
      await chat.addVikiMessage(
        `<div class="msg-text" style="color:var(--rose)">Save failed: ${result.error || 'Unknown error'}</div>`, 300
      );
    }
  }, [chat, lastEmployeeId]);

  /* ═══ Keep refs in sync with latest callbacks ═══ */
  handleSaveEmployeeRef.current = handleSaveEmployee;
  handlePostSetupRef.current = handlePostSetup;
  handleSavedRelatedRef.current = handleSavedRelated;
  handleDoImportRef.current = useCallback(async (fn: string, rows: string) => {
    chat.addUserMessage(`Import ${rows} rows`);
    await chat.addVikiMessage(`${successHTML(`Imported ${rows} records from <strong>${fn}</strong>`)}<div class="msg-actions" style="margin-top:6px"><button class="action-chip" data-action="open-import">📎 Import another</button><button class="action-chip" data-action="add-employee">👤 Add employee</button></div>`, 600);
  }, [chat]);
  handleSetupAnswerRef.current = handleSetupAnswer;
  handleSkipRef.current = handleSkip;
  handleAddRelatedRef.current = handleAddRelated;

  /* ═══ IMPORT ═══ */
  const handleFileSelected = useCallback((file: File) => {
    setup.setShowChat(true);
    setScreen('chat');
    const ext = file.name.split('.').pop()?.toUpperCase() || '';
    const size = (file.size / 1024).toFixed(1);
    const ec = EXT_COLORS[ext] || { bg: 'var(--bg-surface)', c: 'var(--text-3)', i: '📄' };
    chat.addUserMessage(`Import: <strong>${file.name}</strong>`);

    if (ext === 'CSV' || ext === 'TSV') {
      const reader = new FileReader();
      reader.onload = (e) => { const text = e.target?.result as string; const lines = text.trim().split('\n'); const cols = lines[0].split(',').map(h => h.trim().replace(/"/g, '')); showImport(file.name, ext, size, lines.length - 1, cols, ec); };
      reader.readAsText(file);
    } else if (ext === 'JSON') {
      const reader = new FileReader();
      reader.onload = (e) => { try { const data = JSON.parse(e.target?.result as string); const rows = Array.isArray(data) ? data.length : 1; const cols = Array.isArray(data) && data[0] ? Object.keys(data[0]) : []; showImport(file.name, ext, size, rows, cols, ec); } catch { showImport(file.name, ext, size, '?', [], ec); } };
      reader.readAsText(file);
    } else {
      showImport(file.name, ext, size, 45, ['EmpCode', 'Name', 'Dept', 'DOB', 'Salary', 'Phone', 'Email', 'Status'], ec);
    }
  }, [setup, chat]);

  const showImport = useCallback(async (fn: string, ext: string, size: string, rows: number | string, cols: string[], ec: { bg: string; c: string; i: string }) => {
    chat.updateContext('Import', `Import › ${fn}`);
    const matched = cols.map(c => KNOWN_COLUMNS.some(k => c.toLowerCase().replace(/[_\s-]/g, '').includes(k)) ? 'matched' : 'unmatched');
    const mc = matched.filter(m => m === 'matched').length;
    await chat.addVikiMessage(importPreviewHTML(fn, ext, size, rows, cols, matched, mc, ec), 800);
  }, [chat]);

  /* ═══ FREE TEXT ═══ */
  const handleSendMessage = useCallback(async (text: string) => {
    setup.setShowChat(true);
    setScreen('chat');
    chat.addUserMessage(text);
    const lower = text.toLowerCase();
    if (!setup.setupComplete) { handleBeginSetup(); return; }
    if (lower.includes('import') || lower.includes('excel') || lower.includes('csv')) {
      setTimeout(() => setImportOpen(true), 400);
    } else if (/\b(add|new|hire|create)\b/.test(lower) && /\bemployee\b/.test(lower)) {
      setTimeout(() => handlePostSetup('employee'), 400);
    } else if (lower.includes('module') || lower.includes('explore')) {
      setTimeout(() => handlePostSetup('explore'), 400);
    } else if (lower.includes('attendance') || lower.includes('report')) {
      chat.updateContext('Reports', 'Analytics › Attendance');
      setTimeout(async () => { await chat.addVikiMessage(attendanceReportHTML(), 800); }, 400);
    } else {
      // Vector search fallback — query Pinecone with user's text
      chat.updateContext('Search', `Search › "${text.slice(0, 30)}${text.length > 30 ? '…' : ''}"`);
      setTimeout(async () => {
        try {
          const res = await queryVectors(text, 5);
          if (res.success && res.results.length > 0) {
            await chat.addVikiMessage(searchResultsHTML(text, res.results));
          } else {
            await chat.addVikiMessage(noResultsHTML(text));
          }
        } catch {
          await chat.addVikiMessage(noResultsHTML(text));
        }
      }, 400);
    }
  }, [setup, chat, handleBeginSetup, handlePostSetup]);

  /* ═══ MENU ACTION ═══ */
  const handleMenuAction = useCallback((item: MenuItem) => {
    setup.setShowChat(true);
    setScreen('chat');
    chat.addUserMessage(item.name);
    if (item.action === 'employee') { handlePostSetup('employee'); return; }
    if (item.action === 'import_excel' || item.action === 'import_csv') { setImportOpen(true); return; }
    if (item.action === 'import_json') { fileInputRef.current?.click(); return; }
    if (['salary', 'address', 'documents', 'bank'].includes(item.action)) { handleAddRelated(item.action as RelatedType); return; }
    if (item.action === 'report_attendance') { chat.updateContext('Reports', 'Analytics › Attendance'); chat.addVikiMessage(attendanceReportHTML(), 800); return; }
    setTimeout(async () => {
      await chat.addVikiMessage(`<div class="msg-text">Opening <strong>${item.name}</strong>...</div><div class="msg-text" style="margin-top:4px;font-size:12px;color:var(--text-4)">${item.desc}</div><div class="msg-actions"><button class="action-chip" data-action="add-employee">👤 Employees</button><button class="action-chip" data-action="open-import">📎 Import</button></div>`);
    }, 200);
  }, [setup, chat, handlePostSetup, handleAddRelated]);

  /* ═══ DRAG DROP ═══ */
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFileSelected(e.dataTransfer.files[0]); }, [handleFileSelected]);

  /* ═══ RENDER ═══ */
  return (
    <>
      <div className={`app${!setup.setupComplete ? ' onboarding' : ''}`}>
        <ContextPanel context={chat.context} onImport={() => setImportOpen(true)} selectedModuleIds={configuredModuleIds} />
        <main className="conversation-panel" onDragOver={handleDragOver} onDrop={handleDrop}>

          {/* Conversation top bar */}
          {screen === 'chat' && (
            <div className="conv-top">
              <div className="conv-top-left">
                <div className="conv-top-av">V</div>
                <div className="conv-top-info">
                  <h3>{chat.context.value}</h3>
                  <p><span className="online-dot" /> Viki is ready · {chat.context.path}</p>
                </div>
              </div>
              <div className="conv-top-actions">
                <button className="top-btn active">🔍</button>
                <button className="top-btn">☰</button>
                <button className="top-btn">▤</button>
              </div>
            </div>
          )}

          {/* SCREEN SWITCHER */}
          {screen === 'viki-setup' && (
            <VikiBusinessChat />
          )}
          {screen === 'welcome' && (
            <WelcomeScreen onBeginSetup={handleBeginSetup} />
          )}
          {screen === 'wizard' && (
            <BusinessSetupWizard
              onComplete={handleWizardComplete}
              onCancel={handleWizardCancel}
            />
          )}
          {screen === 'chat' && (
            <MessageList messages={chat.messages} isTyping={chat.isTyping} scrollRef={chat.scrollRef} />
          )}

          <ChatInput setupComplete={setup.setupComplete} onSendMessage={handleSendMessage} onMenuAction={handleMenuAction} onImport={() => setImportOpen(true)} onTriggerFile={() => fileInputRef.current?.click()} />
        </main>
        {setup.setupComplete && <RightContextPanel />}
      </div>
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onFileSelected={handleFileSelected} />
      <input ref={fileInputRef} type="file" accept=".json,*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleFileSelected(e.target.files[0]); e.target.value = ''; }} />
    </>
  );
};

export default App;
