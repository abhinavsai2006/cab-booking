'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowLeft, LifeBuoy, Send, MessageCircle } from 'lucide-react';

export default function SupportPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [category, setCategory] = useState('PAYMENT');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const res = await api.get('/tickets');
      setTickets(res.tickets || []);
    } catch {}
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return;

    setSubmitting(true);
    try {
      await api.post('/tickets', {
        category,
        subject,
        message,
      });
      setSubject('');
      setMessage('');
      alert('Support ticket submitted! An agent will respond shortly.');
      loadTickets();
    } catch (err: any) {
      alert(err.message || 'Failed to submit ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="p-2 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="font-extrabold text-lg text-white">Help & Support</h1>
        <div className="w-8" />
      </div>

      {/* Ticket form */}
      <form
        onSubmit={handleCreateTicket}
        className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-4"
      >
        <h3 className="font-bold text-sm text-white">Open a Support Ticket</h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 font-semibold mb-1 block">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="PAYMENT">Payment or Fare Dispute</option>
              <option value="LOST_ITEM">Lost Item in Vehicle</option>
              <option value="DRIVER_BEHAVIOR">Captain Conduct / Feedback</option>
              <option value="SAFETY">Safety Concern</option>
              <option value="APP_BUG">App Issue or Bug</option>
              <option value="OTHER">General Inquiry</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-semibold mb-1 block">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-semibold mb-1 block">Details</label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe what happened..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-2xl transition-colors shadow-lg"
        >
          {submitting ? 'Submitting...' : 'Submit Inquiry'}
        </button>
      </form>

      {/* Ticket History */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-white">Your Past Tickets</h3>
        {tickets.map((t) => (
          <div
            key={t.id}
            className="p-4 rounded-3xl bg-zinc-950 border border-zinc-800 text-xs space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">{t.subject}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-900 text-emerald-400 border border-zinc-800">
                {t.status}
              </span>
            </div>
            <div className="text-zinc-500 text-[10px]">
              Category: {t.category} • {new Date(t.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
