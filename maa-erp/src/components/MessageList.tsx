import React from 'react';
import type { ChatMessage } from '../types';

interface Props {
  messages: ChatMessage[];
  isTyping: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const MessageList: React.FC<Props> = ({ messages, isTyping, scrollRef }) => {
  return (
    <div className="chat-messages" ref={scrollRef}>
      <div className="chat-scroll-inner">
        {messages.map(msg =>
          msg.type === 'viki' ? (
            <div className="msg" key={msg.id}>
              <div className="msg-avatar viki">V</div>
              <div className="msg-body">
                <div className="msg-name viki-name">Viki</div>
                <div className="msg-content" dangerouslySetInnerHTML={{ __html: msg.content }} />
              </div>
            </div>
          ) : (
            <div className="msg" key={msg.id}>
              <div className="msg-avatar user">B</div>
              <div className="msg-body">
                <div className="msg-name user-name">You</div>
                <div className="msg-text" dangerouslySetInnerHTML={{ __html: msg.content }} />
              </div>
            </div>
          )
        )}
        {isTyping && (
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
        )}
      </div>
    </div>
  );
};

export default MessageList;
