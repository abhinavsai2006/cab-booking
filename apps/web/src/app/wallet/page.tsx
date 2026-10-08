'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowLeft, Wallet, Plus, CreditCard, CheckCircle2 } from 'lucide-react';

export default function WalletPage() {
  const [balance, setBalance] = useState<number>(0);
  const [methods, setMethods] = useState<any[]>([]);
  const [topupAmount, setTopupAmount] = useState<number>(500);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const uRes = await api.get('/me');
      setBalance(uRes.user?.walletBalance || 0);

      const mRes = await api.get('/payments/methods');
      setMethods(mRes.methods || []);
    } catch {}
  };

  const handleTopup = async (amt = topupAmount) => {
    setLoading(true);
    try {
      const res = await api.post('/payments/wallet/topup', { amount: amt });
      setBalance(res.balance);
      alert(`Wallet topped up successfully! New balance: ₹${res.balance}`);
    } catch (err: any) {
      alert(err.message || 'Top-up failed');
    } finally {
      setLoading(false);
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
        <h1 className="font-extrabold text-lg text-white">Wallet & Payments</h1>
        <div className="w-8" />
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          CabHub Cash Balance
        </div>
        <div className="font-black text-4xl text-emerald-400 mt-2">
          ₹{balance.toFixed(2)}
        </div>
        <div className="text-xs text-zinc-500 mt-1">Instant 1-tap checkout for all rides</div>

        {/* Top-up options */}
        <div className="mt-6 pt-6 border-t border-zinc-800 space-y-3">
          <div className="text-xs font-semibold text-zinc-300">Quick Top-Up:</div>
          <div className="grid grid-cols-3 gap-2">
            {[100, 500, 1000].map((amt) => (
              <button
                key={amt}
                onClick={() => handleTopup(amt)}
                disabled={loading}
                className="py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded-xl text-xs font-bold transition-colors"
              >
                +₹{amt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Saved Payment Methods */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h3 className="font-bold text-sm text-white">Payment Methods</h3>
        </div>

        <div className="space-y-2.5">
          {methods.map((m) => (
            <div
              key={m.id}
              className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center text-white">
                  <CreditCard size={16} />
                </div>
                <div>
                  <div className="font-bold text-white">{m.brand || m.type}</div>
                  <div className="text-zinc-500 text-[10px]">•••• {m.last4 || '1234'}</div>
                </div>
              </div>

              {m.isDefault && (
                <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                  <CheckCircle2 size={12} /> Default
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
