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

function formatChatTime(timestamp: number | null): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
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
    <div className="flex flex-col h-full" role="log" aria-label="צ׳אט חי">
      <h3 className="text-sm font-semibold text-text-secondary mb-2 px-2">צ&apos;אט חי</h3>
      <div className="flex-1 overflow-y-auto space-y-0.5 max-h-64 mb-2">
        {messages.map((msg, i) => (
          <div key={`${msg.senderId}-${msg.timestamp}-${i}`} className="px-2 py-1">
            {msg.senderRole === 'system' ? (
              <div className="text-xs text-text-secondary/60 italic text-center py-1">{msg.message}</div>
            ) : msg.senderRole === 'auctioneer' ? (
              <div className="bg-accent-muted rounded-lg px-2.5 py-1.5 border border-accent/20">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-bold text-accent">{msg.senderName}</span>
                  <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">מנהל</span>
                  {msg.timestamp && (
                    <span className="text-[10px] text-text-secondary/40 mr-auto">{formatChatTime(msg.timestamp)}</span>
                  )}
                </div>
                <span className="text-sm text-accent-light">{msg.message}</span>
              </div>
            ) : (
              <div className="text-sm flex items-baseline gap-1.5">
                <span className="font-medium text-text-secondary text-xs">{msg.senderName}:</span>
                <span className="text-white/90">{msg.message}</span>
                {msg.timestamp && (
                  <span className="text-[10px] text-text-secondary/30 mr-auto flex-shrink-0">{formatChatTime(msg.timestamp)}</span>
                )}
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
            className="flex-1 bg-bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-text-secondary/50 focus:outline-none focus:border-accent transition-smooth"
            aria-label="הקלד הודעה"
            autoComplete="off"
          />
          <button
            onClick={sendMessage}
            className="bg-accent hover:bg-accent-hover text-bg-primary px-3 py-2 rounded-lg text-sm font-semibold transition-smooth"
            aria-label="שלח הודעה"
          >
            שלח
          </button>
        </div>
      )}
    </div>
  );
}
