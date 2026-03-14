import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MenuItem, RelatedType } from './types';
import { RELATED_FORMS, KNOWN_COLUMNS, EXT_COLORS } from './data/menuData';
import { useSetupFlow } from './hooks/useSetupFlow';
import { useChat } from './hooks/useChat';
import ContextPanel from './components/ContextPanel';
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
  businessUseCasesHTML, customerSegmentsHTML, segmentDetailHTML,
} from './utils/htmlBuilders';
import {
  fetchAllTypes, fetchChildren, findBusinessByName, getBusinessSchemaRoot,
} from './services/payanarssTypeService';

const App: React.FC = () => {
  const setup = useSetupFlow();
  const chat = useChat();
  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * NEW: Controls which screen is visible.
   *   'welcome' → Viki welcome screen (original)
   *   'wizard'  → BusinessSetupWizard (drill-down industry selector)
   *   'chat'    → Chat interface (post-setup)
   */
  const [screen, setScreen] = useState<'welcome' | 'wizard' | 'chat'>('welcome');

  /* ═══ Delegated click handlers for dynamic HTML ═══ */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const actionEl = target.closest('[data-action]') as HTMLElement | null;
      const relatedEl = target.closest('[data-related]') as HTMLElement | null;

      if (actionEl) {
        const action = actionEl.dataset.action;
        if (action === 'save-employee') handleSaveEmployee();
        if (action === 'add-employee') handlePostSetup('employee');
        if (action === 'open-import') setImportOpen(true);
        if (action === 'explore') handlePostSetup('explore');
        if (action === 'save-related') {
          const type = actionEl.dataset.type as RelatedType;
          if (type) handleSavedRelated(type);
        }
        if (action === 'do-import') {
          const fn = actionEl.dataset.fn || '';
          const rows = actionEl.dataset.rows || '0';
          handleDoImport(fn, rows);
        }
        if (action === 'industry') {
          const value = actionEl.dataset.value || '';
          handleSetupAnswer('industry', value);
        }
        if (action === 'skip') {
          const step = actionEl.dataset.step || '';
          handleSkip(step);
        }
        if (action === 'next') {
          const step = actionEl.dataset.step || '';
          const inputId = actionEl.dataset.input || '';
          const input = document.getElementById(inputId) as HTMLInputElement | null;
          const value = input?.value || actionEl.dataset.default || '';
          handleSetupAnswer(step, value);
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
      }

      if (relatedEl) {
        const type = relatedEl.dataset.related as RelatedType;
        if (type) handleAddRelated(type);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  /* ═══ SETUP FLOW ═══ */

  /**
   * CHANGED: "Set up my business" now opens the wizard
   * instead of the old hardcoded chat-based step flow.
   */
  const handleBeginSetup = useCallback(() => {
    setScreen('wizard');
  }, []);

  /**
   * NEW: Called when user completes the BusinessSetupWizard.
   * Receives the selected PayanarssType IDs, transitions to chat,
   * and shows a summary message from Viki.
   */
  const handleWizardComplete = useCallback(async (selectedIds: string[]) => {
    // Mark setup as complete in existing setup flow
    setup.completeSetup();
    setup.setShowChat(true);

    // Transition to chat screen
    setScreen('chat');

    // Show summary in chat
    const count = selectedIds.length;
    await chat.addVikiMessage(
      `<div class="msg-text">Your business is configured! 🎉</div>
      ${successHTML(`<strong>${count} modules</strong> selected and activated`)}
      <div class="msg-text" style="margin-top:12px">
        Your MAA ERP workspace is ready. I've loaded all the selected modules,
        tables, and business rules. What would you like to do first?
      </div>
      <div class="msg-actions">
        <button class="action-chip" data-action="add-employee"><span class="chip-icon">👤</span> Add Employee</button>
        <button class="action-chip" data-action="open-import"><span class="chip-icon">📎</span> Import Data</button>
        <button class="action-chip" data-action="explore"><span class="chip-icon">🔍</span> Explore Modules</button>
      </div>`
    );

    // Save selected IDs for later use
    localStorage.setItem('maa-erp-business-config', JSON.stringify({
      selectedTypeIds: selectedIds,
      configuredAt: new Date().toISOString(),
    }));
  }, [setup, chat]);

  /**
   * NEW: Called when user cancels the wizard.
   * Returns to Viki welcome screen.
   */
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
    const nameEl = document.getElementById('empName') as HTMLInputElement | null;
    const deptEl = document.getElementById('empDept') as HTMLSelectElement | null;
    const name = nameEl?.value || 'Ahmed Al Rashid';
    const dept = deptEl?.value || 'Operations';
    chat.addUserMessage(`Created: ${name}, ${dept}`);
    await chat.addVikiMessage(employeeSavedHTML(name), 600);
  }, [chat]);

  const handleAddRelated = useCallback(async (type: RelatedType) => {
    const form = RELATED_FORMS[type];
    if (!form) return;
    chat.addUserMessage(`Add ${form.title.toLowerCase()}`);
    await chat.addVikiMessage(relatedFormHTML(form, type));
  }, [chat]);

  const handleSavedRelated = useCallback(async (type: RelatedType) => {
    const labels: Record<string, string> = { salary: 'Salary Structure', address: 'Address', documents: 'Document', bank: 'Bank Account' };
    await chat.addVikiMessage(relatedSavedHTML(labels[type] || type), 300);
  }, [chat]);

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

  const handleDoImport = useCallback(async (fn: string, rows: string) => {
    chat.addUserMessage(`Import ${rows} rows`);
    await chat.addVikiMessage(`${successHTML(`Imported ${rows} records from <strong>${fn}</strong>`)}<div class="msg-actions" style="margin-top:6px"><button class="action-chip" data-action="open-import">📎 Import another</button><button class="action-chip" data-action="add-employee">👤 Add employee</button></div>`, 600);
  }, [chat]);

  /* ═══ BUSINESS IDENTIFICATION & DRILL-DOWN ═══ */

  const handleBusinessIdentification = useCallback(async (keyword: string) => {
    try {
      const matches = await findBusinessByName(keyword);
      if (matches.length === 0) {
        await chat.addVikiMessage(
          `<div class="msg-text">I couldn't find a business model matching "<strong>${keyword}</strong>". Try specifying an industry like Gym, Restaurant, or Salon.</div>`
        );
        return;
      }

      const sector = matches[0];
      const schemaRoot = await getBusinessSchemaRoot(sector.Id);
      if (!schemaRoot) {
        await chat.addVikiMessage(
          `<div class="msg-text">Found <strong>${sector.Name}</strong> but no detailed business model is available yet.</div>`
        );
        return;
      }

      chat.updateContext(sector.Name, `Business > ${sector.Name}`);
      const useCases = await fetchChildren(schemaRoot.Id);
      await chat.addVikiMessage(businessUseCasesHTML(sector.Name, useCases));
    } catch {
      await chat.addVikiMessage(
        `<div class="msg-text">Something went wrong loading the business data. Please try again.</div>`
      );
    }
  }, [chat]);

  const handleDrillUseCase = useCallback(async (useCaseId: string) => {
    try {
      const all = await fetchAllTypes();
      const useCase = all.find(t => t.Id === useCaseId);
      if (!useCase) return;

      const children = await fetchChildren(useCaseId);

      if (useCase.Name.toLowerCase().includes('identify target customer segment')) {
        chat.updateContext('Customer Segments', `Gym > ${useCase.Name}`);
        await chat.addVikiMessage(customerSegmentsHTML(children));
      } else {
        chat.updateContext(useCase.Name, `Gym > ${useCase.Name}`);
        await chat.addVikiMessage(businessUseCasesHTML(useCase.Name, children));
      }
    } catch (err) {
      console.error('Failed to drill into use case:', err);
    }
  }, [chat]);

  const handleDrillSegment = useCallback(async (segmentId: string) => {
    try {
      const all = await fetchAllTypes();
      const segment = all.find(t => t.Id === segmentId);
      if (!segment) return;

      const details = await fetchChildren(segmentId);
      chat.updateContext(segment.Name, `Gym > Customer Segments > ${segment.Name}`);
      await chat.addVikiMessage(segmentDetailHTML(segment, details));
    } catch (err) {
      console.error('Failed to load segment details:', err);
    }
  }, [chat]);

  const handleBackToSegments = useCallback(async () => {
    try {
      const children = await fetchChildren('GYM2000000000000000000000000002');
      chat.updateContext('Customer Segments', 'Gym > Identify Target Customer Segment');
      await chat.addVikiMessage(customerSegmentsHTML(children));
    } catch (err) {
      console.error('Failed to navigate back to segments:', err);
    }
  }, [chat]);

  const handleSelectSegment = useCallback(async (segmentId: string) => {
    try {
      const all = await fetchAllTypes();
      const segment = all.find(t => t.Id === segmentId);
      const name = segment?.Name || 'segment';
      chat.addUserMessage(`Selected: ${name}`);
      await chat.addVikiMessage(
        `${successHTML(`<strong>${name}</strong> selected as your target customer segment`)}
        <div class="msg-text" style="margin-top:8px">What would you like to do next?</div>
        <div class="msg-actions">
          <button class="action-chip" data-action="back-segments"><span class="chip-icon">🎯</span> Explore Other Segments</button>
          <button class="action-chip" data-action="add-employee"><span class="chip-icon">👤</span> Hire Staff</button>
          <button class="action-chip" data-action="explore"><span class="chip-icon">🔍</span> Explore Modules</button>
        </div>`
      );
    } catch (err) {
      console.error('Failed to select segment:', err);
    }
  }, [chat]);

  /* ═══ FREE TEXT ═══ */
  const handleSendMessage = useCallback(async (text: string) => {
    setup.setShowChat(true);
    setScreen('chat');
    chat.addUserMessage(text);
    const lower = text.toLowerCase();
    // Business identification — allow even before setup is complete
    if (
      /my\s+business\s+is/i.test(lower) ||
      /i\s+(run|have|own|operate)\s+a/i.test(lower) ||
      /\b(start|open)\s+(a\s+)?gym\b/i.test(lower) ||
      lower.includes('gym business') ||
      (lower.includes('gym') && lower.includes('business'))
    ) {
      setup.completeSetup();
      const businessMatch = text.match(/(?:my\s+business\s+is\s+(?:a\s+)?|i\s+(?:run|have|own|operate)\s+a\s+|start\s+(?:a\s+)?|open\s+(?:a\s+)?)(.+)/i);
      const keyword = businessMatch ? businessMatch[1].trim() : 'gym';
      setTimeout(async () => { await handleBusinessIdentification(keyword); }, 400);
    }
    else if (!setup.setupComplete) { handleBeginSetup(); return; }
    else if (lower.includes('import') || lower.includes('excel') || lower.includes('csv')) { setTimeout(() => setImportOpen(true), 400); }
    else if (lower.includes('employee') || lower.includes('hire')) { setTimeout(() => handlePostSetup('employee'), 400); }
    else if (lower.includes('module') || lower.includes('explore')) { setTimeout(() => handlePostSetup('explore'), 400); }
    else if (lower.includes('attendance') || lower.includes('report')) { chat.updateContext('Reports', 'Analytics › Attendance'); setTimeout(async () => { await chat.addVikiMessage(attendanceReportHTML(), 800); }, 400); }
    else { setTimeout(async () => { await chat.addVikiMessage(`<div class="msg-text">What would you like to do?</div><div class="msg-actions"><button class="action-chip" data-action="add-employee">👤 Employees</button><button class="action-chip" data-action="open-import">📎 Import</button><button class="action-chip" data-action="explore">🔍 Explore</button></div>`); }, 400); }
  }, [setup, chat, handleBeginSetup, handlePostSetup, handleBusinessIdentification]);

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
        <ContextPanel context={chat.context} onImport={() => setImportOpen(true)} />
        <main className="conversation-panel" onDragOver={handleDragOver} onDrop={handleDrop}>

          {/* SCREEN SWITCHER — Welcome → Wizard → Chat */}
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
      </div>
      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} onFileSelected={handleFileSelected} />
      <input ref={fileInputRef} type="file" accept=".json,*" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleFileSelected(e.target.files[0]); e.target.value = ''; }} />
    </>
  );
};

export default App;
