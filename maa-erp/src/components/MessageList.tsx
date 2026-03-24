import React from 'react';
import type { ChatMessage } from '../types';

interface Props {
  messages: ChatMessage[];
  isTyping: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}

const formatTime = () => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
};

const MessageList: React.FC<Props> = ({ messages, isTyping, scrollRef }) => {
  return (
    <div className="chat-messages" ref={scrollRef}>
      <div className="chat-scroll-inner">
        {/* Date divider */}
        <div className="date-div">
          <span>Today · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>

        {messages.map(msg =>
          msg.type === 'viki' ? (
            <div className="msg viki-msg" key={msg.id}>
              <div className="msg-avatar viki">V</div>
              <div className="msg-body">
                <div className="msg-name viki-name">Viki <span className="msg-time">{formatTime()}</span></div>
                <div className="msg-content" dangerouslySetInnerHTML={{ __html: msg.content }} />
              </div>
            </div>
          ) : (
            <div className="msg user-msg" key={msg.id}>
              <div className="msg-body">
                <div className="msg-text" dangerouslySetInnerHTML={{ __html: msg.content }} />
              </div>
              <div className="msg-avatar user">B</div>
            </div>
          )
        )}
        {isTyping && (
          <div className="msg viki-msg">
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
