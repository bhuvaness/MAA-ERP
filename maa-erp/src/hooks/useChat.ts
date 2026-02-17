import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, ContextInfo } from '../types';

let msgCounter = 0;

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [context, setContext] = useState<ContextInfo>({ value: 'Dashboard', path: 'Home' });
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

  return { messages, isTyping, context, scrollRef, addUserMessage, addVikiMessage, updateContext, scrollToBottom };
}
