import { useState, useCallback, useRef, useEffect } from 'react';
import type { MenuItem } from '../types';
import { MENU_DATA, CAT_LABELS, CAT_ORDER } from '../data/menuData';

export interface CmdGroup {
  cat: string;
  label: string;
  icon: string;
  items: MenuItem[];
}

export function useCommandPopup(setupComplete: boolean) {
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState<MenuItem[]>([]);
  const [groups, setGroups] = useState<CmdGroup[]>([]);
  const [focusIdx, setFocusIdx] = useState(-1);
  const popupRef = useRef<HTMLDivElement>(null);

  const filter = useCallback((q: string) => {
    if (!q || !setupComplete) {
      setIsOpen(false);
      setFiltered([]);
      setGroups([]);
      setFocusIdx(-1);
      return;
    }
    const words = q.toLowerCase().split(/\s+/);
    const results = MENU_DATA.filter(item => {
      const hay = `${item.name} ${item.desc} ${item.keywords}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
    setFiltered(results);
    if (results.length === 0) {
      setGroups([]);
      setIsOpen(true);
      setFocusIdx(-1);
      return;
    }
    const grouped: Record<string, MenuItem[]> = {};
    results.forEach(item => {
      if (!grouped[item.cat]) grouped[item.cat] = [];
      grouped[item.cat].push(item);
    });
    const orderedGroups: CmdGroup[] = CAT_ORDER
      .filter(cat => grouped[cat])
      .map(cat => ({ cat, label: CAT_LABELS[cat].label, icon: CAT_LABELS[cat].icon, items: grouped[cat] }));
    setGroups(orderedGroups);
    setIsOpen(true);
    setFocusIdx(0);
  }, [setupComplete]);

  const close = useCallback(() => {
    setIsOpen(false);
    setFocusIdx(-1);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent): MenuItem | null => {
    if (!isOpen) return null;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(prev => Math.min(prev + 1, filtered.length - 1)); return null; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(prev => Math.max(prev - 1, 0)); return null; }
    if (e.key === 'Enter' && focusIdx >= 0 && focusIdx < filtered.length) { e.preventDefault(); const sel = filtered[focusIdx]; close(); return sel; }
    if (e.key === 'Escape') { close(); return null; }
    return null;
  }, [isOpen, focusIdx, filtered, close]);

  useEffect(() => {
    if (focusIdx < 0 || !popupRef.current) return;
    const el = popupRef.current.querySelector(`[data-idx="${focusIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [focusIdx]);

  const highlightMatch = useCallback((text: string, q: string): string => {
    const words = q.toLowerCase().split(/\s+/);
    let result = text;
    words.forEach(w => {
      if (!w) return;
      const regex = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      result = result.replace(regex, '<span class="cmd-match">$1</span>');
    });
    return result;
  }, []);

  return { isOpen, filtered, groups, focusIdx, setFocusIdx, filter, close, handleKeyDown, highlightMatch, popupRef };
}
