// ============================================================
// Component: MessageList — Renders chat messages + typing
// ============================================================

import React from 'react';
import type { ChatMessage } from '../../types/index';

interface Props {
  messages: ChatMessage[];
  isTyping: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const TypingIndicator: React.FC = () => (
  <div className="msg">
    <div className="msg-avatar viki">V</div>
    <div className="msg-body">
      <div className="typing-indicator">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  </div>
);

const VikiMessage: React.FC<{ content: string }> = ({ content }) => (
  <div className="msg">
    <div className="msg-avatar viki">V</div>
    <div className="msg-body">
      <div className="msg-name viki-name">Viki</div>
      <div className="msg-content" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  </div>
);

const UserMessage: React.FC<{ content: string }> = ({ content }) => (
  <div className="msg">
    <div className="msg-avatar user">B</div>
    <div className="msg-body">
      <div className="msg-name user-name">You</div>
      <div className="msg-text" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  </div>
);

const MessageList: React.FC<Props> = ({ messages, isTyping, scrollRef }) => {
  return (
    <div className="chat-messages" ref={scrollRef}>
      <div className="chat-scroll-inner">
        {messages.map(msg =>
          msg.type === 'viki' ? (
            <VikiMessage key={msg.id} content={msg.content} />
          ) : (
            <UserMessage key={msg.id} content={msg.content} />
          )
        )}
        {isTyping && <TypingIndicator />}
      </div>
    </div>
  );
};

export default MessageList;
