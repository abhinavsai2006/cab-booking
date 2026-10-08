'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowLeft, Tag, Copy, Check } from 'lucide-react';

export default function PromosPage() {
  const [promos, setPromos] = useState<any[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/promos/available')
      .then((res) => setPromos(res.promos || []))
      .catch(() => {});
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
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
        <h1 className="font-extrabold text-lg text-white">Promos & Discounts</h1>
        <div className="w-8" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {promos.map((p) => (
          <div
            key={p.id}
            className="p-5 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-black text-emerald-400 text-lg tracking-wider">
                {p.code}
              </span>
              <button
                onClick={() => copyCode(p.code)}
                className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs flex items-center gap-1 font-semibold"
              >
                {copiedCode === p.code ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copiedCode === p.code ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="text-white font-bold text-sm">
              {p.type === 'PERCENT' ? `Save ${p.value}% on your ride` : `Flat ₹${p.value} off`}
            </div>

            <div className="text-zinc-500 text-xs">
              Min trip fare: ₹{p.minFare} • Max discount: ₹{p.maxDiscount}
            </div>
          </div>
        ))}

        {promos.length === 0 && (
          <div className="col-span-2 text-center text-zinc-500 text-xs py-12">
            No active promos at this moment.
          </div>
        )}
      </div>
    </div>
  );
}
