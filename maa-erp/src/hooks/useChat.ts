import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ContextInfo } from '../types';
import { searchModules, extractSectorKeyword, type ModuleResult } from "../services/ptSearchService";

let msgCounter = 0;

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [context, setContext] = useState<ContextInfo>({ value: 'Dashboard', path: 'Home' });
  const [sidebarModules, setSidebarModules] = useState<ModuleResult[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const addUserMessage = useCallback((text: string) => {
    msgCounter++;
    const msg: ChatMessage = { id: `msg-${msgCounter}`, type: 'user', content: text };
    setMessages(prev => [...prev, msg]);
    scrollToBottom();
  }, [scrollToBottom]);

  const addVikiMessage = useCallback((html: string, delay = 600): Promise<void> => {
    return new Promise(resolve => {
      setIsTyping(true);
      scrollToBottom();
      setTimeout(() => {
        setIsTyping(false);
        msgCounter++;
        const msg: ChatMessage = { id: `msg-${msgCounter}`, type: 'viki', content: html };
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
        resolve();
      }, delay);
    });
  }, [scrollToBottom]);

  const updateContext = useCallback((value: string, path: string) => {
    setContext({ value, path });
  }, []);

  // ─── sendMessage — main entry point for all user input ───────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // 1. Show user's message in chat
    addUserMessage(text);

    // 2. Check if it's a sector/business keyword search (e.g. "gym", "pest control")
    const sectorKeyword = extractSectorKeyword(text);

    if (sectorKeyword) {
      const modules = await searchModules(sectorKeyword);

      if (modules.length > 0) {
        // Update sidebar with matched modules
        setSidebarModules(modules);
        // Show module cards in chat
        await addVikiMessage(buildModuleCardsHtml(modules, sectorKeyword));
      } else {
        await addVikiMessage(
          `<p>I couldn't find any modules for <strong>${sectorKeyword}</strong> in the system. Try a different sector name, or type <em>help</em> to see available sectors.</p>`
        );
      }
      return; // ← do not fall through to Claude API
    }

    // 3. Not a sector search — your existing Claude API / ERP logic goes here
    // e.g. await callClaudeAPI(text);

  }, [addUserMessage, addVikiMessage]);

  return {
    messages,
    isTyping,
    context,
    scrollRef,
    sidebarModules,
    addUserMessage,
    addVikiMessage,
    updateContext,
    scrollToBottom,
    sendMessage,
  };
}

// ─── Module card HTML builder ────────────────────────────────
// Produces the HTML that addVikiMessage() renders in the chat.

function buildModuleCardsHtml(modules: ModuleResult[], keyword: string): string {
  const TYPE_ICON: Record<string, string> = {
    "10000000000000000000000000000011111": "🏢",
    "10000000000000000000000000000001111": "📦",
    "10000000000000000000000000000000111": "⚡",
    "100000000000000000000000000000004":   "📁",
    "100000000000000000000000000000001":   "🗂️",
  };

  const cards = modules.slice(0, 12).map(m => {
    const icon = TYPE_ICON[m.typeId] ?? "📄";
    const desc = m.description
      ? `<div class="pt-module-desc">${m.description}</div>`
      : "";
    const count = m.childCount > 0
      ? `<div class="pt-module-count">${m.childCount} items</div>`
      : "";
    return `
      <div class="pt-module-card">
        <div class="pt-module-icon">${icon}</div>
        <div class="pt-module-info">
          <div class="pt-module-name">${m.name}</div>
          ${desc}
          ${count}
        </div>
      </div>`;
  }).join("");

  return `
    <div class="pt-module-results">
      <div class="pt-module-results-header">
        Found <strong>${modules.length}</strong> module${modules.length !== 1 ? "s" : ""} for <strong>${keyword}</strong>
      </div>
      <div class="pt-module-grid">${cards}</div>
    </div>`;
}
