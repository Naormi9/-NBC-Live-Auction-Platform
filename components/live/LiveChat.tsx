'use client';

import { useState, useRef, useEffect } from 'react';
import { ref, push, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';
import { ChatMessage } from '@/lib/types';

interface LiveChatProps {
  auctionId: string;
  messages: ChatMessage[];
  registered: boolean;
}

export default function LiveChat({ auctionId, messages, registered }: LiveChatProps) {
  const { user, profile } = useAuth();
  const [text, setText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !user) return;
    await push(ref(db, `live_chat/${auctionId}`), {
      senderId: user.uid,
      senderName: profile?.displayName || 'משתתף',
      senderRole: profile?.role === 'admin' || profile?.role === 'house_manager' ? 'auctioneer' : 'user',
      message: text.trim(),
      timestamp: serverTimestamp(),
    });
    setText('');
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-semibold text-text-secondary mb-2 px-2">צ&apos;אט חי</h3>
      <div className="flex-1 overflow-y-auto space-y-1 max-h-64 mb-2">
        {messages.map((msg, i) => (
          <div key={i} className="px-2 py-1">
            {msg.senderRole === 'system' ? (
              <div className="text-xs text-text-secondary italic">{msg.message}</div>
            ) : (
              <div className="text-sm">
                <span className={`font-semibold ${msg.senderRole === 'auctioneer' ? 'text-accent' : 'text-text-secondary'}`}>
                  {msg.senderName}:
                </span>{' '}
                <span className={msg.senderRole === 'auctioneer' ? 'text-accent' : ''}>{msg.message}</span>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      {user && registered && (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="שלח הודעה..."
            className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-text-secondary focus:outline-none focus:border-accent"
          />
          <button
            onClick={sendMessage}
            className="bg-accent hover:bg-accent-hover text-white px-3 py-2 rounded-lg text-sm transition-smooth"
          >
            שלח
          </button>
        </div>
      )}
    </div>
  );
}
