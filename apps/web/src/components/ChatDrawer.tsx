'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { Send, X, MessageSquare } from 'lucide-react';

export interface ChatMessage {
  id: string;
  senderName: string;
  senderRole: string;
  message: string;
  timestamp: string;
}

export interface ChatDrawerProps {
  rideId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole: 'RIDER' | 'DRIVER';
}

const QUICK_CHIPS = [
  "I'm at the pickup point",
  'Traffic is heavy, 2 mins delay',
  'Arriving shortly!',
  'Please wait near the gate',
];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  rideId,
  isOpen,
  onClose,
  currentUserRole,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rideId || !isOpen) return;

    const socket = getSocket();
    socket.emit('join:ride', { rideId });

    const handleMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('chat:message', handleMessage);

    return () => {
      socket.off('chat:message', handleMessage);
    };
  }, [rideId, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const socket = getSocket();
    socket.emit('chat:message', {
      rideId,
      message: text.trim(),
      senderRole: currentUserRole,
    });

    setInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="text-emerald-400" size={18} />
          <h3 className="font-semibold text-white">In-Trip Chat</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm mt-12">
            No messages yet. Send a message to coordinate pickup!
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMe = m.senderRole === currentUserRole;
            return (
              <div
                key={idx}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-zinc-500 mb-0.5">
                  {m.senderName || m.senderRole}
                </span>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                    isMe
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-zinc-800 text-zinc-100 rounded-bl-none'
                  }`}
                >
                  {m.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Chips */}
      <div className="px-3 py-2 flex gap-1.5 overflow-x-auto border-t border-zinc-900">
        {QUICK_CHIPS.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => sendMessage(chip)}
            className="shrink-0 text-xs px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-300 hover:border-zinc-600 transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-800 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
          placeholder="Type message..."
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
        />
        <button
          onClick={() => sendMessage(input)}
          className="p-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
