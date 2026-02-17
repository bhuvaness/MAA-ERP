import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { MenuItem, RelatedType } from './types';
import { RELATED_FORMS, KNOWN_COLUMNS, EXT_COLORS } from './data/menuData';
import { useSetupFlow } from './hooks/useSetupFlow';
import { useChat } from './hooks/useChat';
import ContextPanel from './components/ContextPanel';
import WelcomeScreen from './components/WelcomeScreen';
import ChatInput from './components/ChatInput';
import ImportModal from './components/ImportModal';
import MessageList from './components/MessageList';
import {
  progressHTML, successHTML, setupSummaryHTML,
  employeeFormHTML, employeeSavedHTML,
  relatedFormHTML, relatedSavedHTML,
  exploreModulesHTML, attendanceReportHTML,
  importPreviewHTML,
} from './utils/htmlBuilders';

const App: React.FC = () => {
  const setup = useSetupFlow();
  const chat = useChat();
  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const handleBeginSetup = useCallback(async () => {
    setup.beginSetup();
    await chat.addVikiMessage(
      `<div class="msg-text">Let's register your business! 👋 I'll walk you through <strong>6 quick steps</strong>.</div>
      ${progressHTML(0)}
      <div class="msg-text" style="margin-top:12px"><strong>Step 1:</strong> What type of business do you run?</div>
      <div class="msg-actions">
        <button class="action-chip" data-action="industry" data-value="Restaurant"><span class="chip-icon">🍽</span> Restaurant</button>
        <button class="action-chip" data-action="industry" data-value="Construction"><span class="chip-icon">🏗</span> Construction</button>
        <button class="action-chip" data-action="industry" data-value="Retail"><span class="chip-icon">🛒</span> Retail</button>
        <button class="action-chip" data-action="industry" data-value="Hotel"><span class="chip-icon">🏠</span> Hotel</button>
        <button class="action-chip" data-action="industry" data-value="Gym & Fitness"><span class="chip-icon">🏋</span> Gym</button>
        <button class="action-chip" data-action="industry" data-value="Salon & Spa"><span class="chip-icon">✂</span> Salon</button>
        <button class="action-chip" data-action="industry" data-value="Clinic"><span class="chip-icon">🩺</span> Clinic</button>
        <button class="action-chip" data-action="industry" data-value="Facility Management"><span class="chip-icon">🔧</span> FM</button>
        <button class="action-chip" data-action="industry" data-value="Other"><span class="chip-icon">✚</span> Other</button>
      </div>`
    );
  }, [setup, chat]);

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
          <div class="form-card-body"><div class="fc-row"><div class="fc-field"><label class="fc-label">CR Number</label><input class="fc-input" id="crNo" placeholder="1234567"/></div><div class="fc-field"><label class="fc-label">Emirate</label><select class="fc-input"><option>Abu Dhabi</option><option>Dubai</option><option>Sharjah</option></select></div></div></div>
          <div class="form-card-footer"><button class="fc-save" data-action="next" data-step="commercial" data-input="crNo" data-default="1234567">Next →</button><button class="fc-skip" data-action="skip" data-step="commercial">Skip</button></div></div>`, 500);
    } else if (stepId === 'commercial') {
      setup.setCurrentStep(4);
      await chat.addVikiMessage(
        `${successHTML('CR saved')}${progressHTML(4)}
        <div class="msg-text" style="margin-top:12px"><strong>Step 5: Bank Account</strong></div>
        <div class="msg-form-card"><div class="form-card-header"><div class="form-card-dot" style="background:var(--green)"></div><h4>Bank Account</h4><span class="form-card-badge" style="background:var(--green-soft);color:var(--green)">FINANCE</span></div>
          <div class="form-card-body"><div class="fc-field"><label class="fc-label">Bank</label><select class="fc-input" id="bankName"><option value="">Select...</option><option>ADCB</option><option>Emirates NBD</option><option>FAB</option><option>ADIB</option><option>Mashreq</option></select></div><div class="fc-field"><label class="fc-label">IBAN</label><input class="fc-input" placeholder="AE XX XXXX..."/></div></div>
          <div class="form-card-footer"><button class="fc-save" data-action="next" data-step="bank" data-input="bankName" data-default="ADCB">Next →</button><button class="fc-skip" data-action="skip" data-step="bank">Skip</button></div></div>`, 500);
    } else if (stepId === 'bank') {
      setup.setCurrentStep(5);
      await chat.addVikiMessage(
        `${successHTML('Bank saved')}${progressHTML(5)}
        <div class="msg-text" style="margin-top:12px"><strong>Step 6: Tax Registration (VAT/GST)</strong></div>
        <div class="msg-form-card"><div class="form-card-header"><div class="form-card-dot" style="background:var(--yellow)"></div><h4>Tax Registration</h4><span class="form-card-badge" style="background:var(--yellow-soft);color:var(--yellow)">TAX</span></div>
          <div class="form-card-body"><div class="fc-row"><div class="fc-field"><label class="fc-label">TRN</label><input class="fc-input" id="trn" placeholder="100XXXXXXXXX003"/></div><div class="fc-field"><label class="fc-label">Type</label><select class="fc-input"><option>VAT (5%)</option><option>VAT Exempt</option><option>Not Registered</option></select></div></div></div>
          <div class="form-card-footer"><button class="fc-save" data-action="next" data-step="tax" data-input="trn" data-default="TRN-AUTO">Complete ✓</button><button class="fc-skip" data-action="skip" data-step="tax">Skip</button></div></div>`, 500);
    } else if (stepId === 'tax') {
      await handleCompleteSetup();
    }
  }, [setup, chat]);

  const handleSkip = useCallback(async (stepId: string) => {
    setup.updateSetupData(stepId, '(skipped)');
    chat.addUserMessage('Skip for now');
    await chat.addVikiMessage('<div class="msg-text" style="color:var(--text-3)">Skipped — you can complete this anytime.</div>', 300);
    if (stepId === 'tax') { await handleCompleteSetup(); }
    else {
      const nextMap: Record<string, string> = { license: 'license', commercial: 'commercial', bank: 'bank' };
      if (nextMap[stepId]) handleSetupAnswer(stepId, '(skipped)');
    }
  }, [setup, chat]);

  const handleCompleteSetup = useCallback(async () => {
    setup.completeSetup();
    const ind = setup.setupData.industry || 'Business';
    await chat.addVikiMessage(
      `<div class="msg-success" style="font-size:14px;padding:10px 18px">🎉 Business setup complete!</div>${progressHTML(6)}${setupSummaryHTML(setup.setupData)}`, 800);
    await chat.addVikiMessage(
      `<div class="msg-text"><strong>12 modules</strong> activated for <em>${ind}</em>. What's next?</div>
      <div class="msg-text" style="margin-top:4px;font-size:12px;color:var(--text-3)">💡 Tip: Start typing in the chatbox to discover all modules, actions &amp; reports</div>
      <div class="msg-actions">
        <button class="action-chip" data-action="add-employee"><span class="chip-icon">👤</span> Add employees</button>
        <button class="action-chip" data-action="open-import"><span class="chip-icon">📎</span> Import from Excel</button>
        <button class="action-chip" data-action="explore"><span class="chip-icon">🔍</span> Explore modules</button>
      </div>`, 500);
  }, [setup, chat]);

  /* ═══ POST-SETUP ═══ */
  const handlePostSetup = useCallback(async (type: string) => {
    setup.setShowChat(true);
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

  /* ═══ FREE TEXT ═══ */
  const handleSendMessage = useCallback(async (text: string) => {
    setup.setShowChat(true);
    chat.addUserMessage(text);
    const lower = text.toLowerCase();
    if (!setup.setupComplete) { handleBeginSetup(); return; }
    if (lower.includes('import') || lower.includes('excel') || lower.includes('csv')) { setTimeout(() => setImportOpen(true), 400); }
    else if (lower.includes('employee') || lower.includes('hire')) { setTimeout(() => handlePostSetup('employee'), 400); }
    else if (lower.includes('module') || lower.includes('explore')) { setTimeout(() => handlePostSetup('explore'), 400); }
    else if (lower.includes('attendance') || lower.includes('report')) { chat.updateContext('Reports', 'Analytics › Attendance'); setTimeout(async () => { await chat.addVikiMessage(attendanceReportHTML(), 800); }, 400); }
    else { setTimeout(async () => { await chat.addVikiMessage(`<div class="msg-text">What would you like to do?</div><div class="msg-actions"><button class="action-chip" data-action="add-employee">👤 Employees</button><button class="action-chip" data-action="open-import">📎 Import</button><button class="action-chip" data-action="explore">🔍 Explore</button></div>`); }, 400); }
  }, [setup, chat, handleBeginSetup, handlePostSetup]);

  /* ═══ MENU ACTION ═══ */
  const handleMenuAction = useCallback((item: MenuItem) => {
    setup.setShowChat(true);
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
          {!setup.showChat ? (
            <WelcomeScreen onBeginSetup={handleBeginSetup} />
          ) : (
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
