import React, { useRef, useCallback } from 'react';
import type { MenuItem } from '../types';
import { useCommandPopup } from '../hooks/useCommandPopup';
import CommandPopup from './CommandPopup';

interface Props {
  setupComplete: boolean;
  onSendMessage: (text: string) => void;
  onMenuAction: (item: MenuItem) => void;
  onImport: () => void;
  onTriggerFile: () => void;
}

const ChatInput: React.FC<Props> = ({ setupComplete, onSendMessage, onMenuAction, onImport, onTriggerFile }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { isOpen, filtered, groups, focusIdx, setFocusIdx, filter, close, handleKeyDown, highlightMatch, popupRef } = useCommandPopup(setupComplete);

  const handleInputChange = useCallback(() => {
    const val = inputRef.current?.value.trim().toLowerCase() || '';
    filter(val);
  }, [filter]);

  const handleFocus = useCallback(() => {
    const val = inputRef.current?.value.trim().toLowerCase() || '';
    if (val && setupComplete) filter(val);
  }, [filter, setupComplete]);

  const handleSend = useCallback(() => {
    close();
    const text = inputRef.current?.value.trim() || '';
    if (!text) return;
    if (inputRef.current) inputRef.current.value = '';
    onSendMessage(text);
  }, [close, onSendMessage]);

  const handleSelect = useCallback((idx: number) => {
    const item = filtered[idx];
    if (!item) return;
    close();
    if (inputRef.current) inputRef.current.value = '';
    onMenuAction(item);
  }, [filtered, close, onMenuAction]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const selected = handleKeyDown(e);
    if (selected) {
      if (inputRef.current) inputRef.current.value = '';
      onMenuAction(selected);
      return;
    }
    if (!isOpen && e.key === 'Enter') handleSend();
  }, [handleKeyDown, isOpen, handleSend, onMenuAction]);

  return (
    <div className="chat-input-area">
      <div className="chat-input-container">
        <CommandPopup
          isOpen={isOpen}
          query={inputRef.current?.value.trim() || ''}
          groups={groups}
          filteredCount={filtered.length}
          focusIdx={focusIdx}
          onSelect={handleSelect}
          onHover={setFocusIdx}
          highlightMatch={highlightMatch}
          popupRef={popupRef}
        />
        <div className="chat-input-row">
          <div className="chat-input-avatar">B</div>
          <div className="chat-input-box">
            <input ref={inputRef} className="chat-input" placeholder='Talk to Viki... "Add employee" or "Show report"' onInput={handleInputChange} onKeyDown={onKeyDown} onFocus={handleFocus} />
            <button className="chat-send" onClick={handleSend}>↑</button>
          </div>
        </div>
        {setupComplete && (
          <div className="chat-actions-strip">
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button className="chat-action-btn" onClick={onImport}><span className="btn-icon">📎</span> Attach</button>
              <button className="chat-action-btn" onClick={onImport}><span className="btn-icon">📊</span> Excel</button>
              <button className="chat-action-btn" onClick={onImport}><span className="btn-icon">📋</span> CSV</button>
              <button className="chat-action-btn" onClick={onTriggerFile}><span className="btn-icon">{'{ }'}</span> JSON</button>
            </div>
            <div className="chat-action-divider" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button className="chat-action-btn"><span className="btn-icon">📈</span> Reports</button>
              <button className="chat-action-btn"><span className="btn-icon">📅</span> Schedule</button>
            </div>
            <div className="chat-action-divider" />
            <button className="chat-action-btn" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>⌘K</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInput;
