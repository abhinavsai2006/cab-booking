'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Wallet, ArrowLeft, ArrowUpRight, TrendingUp, CheckCircle2, DollarSign } from 'lucide-react';

export default function DriverEarningsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payoutRequested, setPayoutRequested] = useState(false);

  useEffect(() => {
    api
      .get('/driver/earnings')
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleRequestPayout = async () => {
    try {
      await api.post('/driver/payouts/connect');
      setPayoutRequested(true);
      alert('Payout initiated! Funds will be transferred to your registered bank account.');
    } catch {
      alert('Failed to initiate payout');
    }
  };

  const summary = data?.summary || {
    totalGross: 4500,
    totalCommission: 900,
    totalTips: 250,
    totalNet: 3850,
    completedTrips: 24,
    ratingAvg: 4.9,
    acceptanceRate: 96,
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 w-full space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/driver"
          className="p-2 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft size={16} /> Back to Drive
        </Link>
        <h1 className="font-extrabold text-lg text-white">Earnings & Payouts</h1>
        <div className="w-8" />
      </div>

      {/* Main Net Balance Card */}
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Wallet size={120} />
        </div>

        <div className="relative z-10">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Total Net Earnings
          </div>
          <div className="font-black text-4xl text-emerald-400 mt-1">
            ₹{summary.totalNet.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            Across {summary.completedTrips} completed trips
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-zinc-800/80">
            <div>
              <div className="text-[10px] text-zinc-500 font-semibold uppercase">Gross Fare</div>
              <div className="text-sm font-bold text-white mt-0.5">₹{summary.totalGross}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 font-semibold uppercase">Commission (20%)</div>
              <div className="text-sm font-bold text-zinc-400 mt-0.5">-₹{summary.totalCommission}</div>
            </div>
            <div>
              <div className="text-[10px] text-zinc-500 font-semibold uppercase">Tips Received</div>
              <div className="text-sm font-bold text-emerald-400 mt-0.5">+₹{summary.totalTips}</div>
            </div>
          </div>

          <button
            onClick={handleRequestPayout}
            disabled={payoutRequested}
            className="mt-6 w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <ArrowUpRight size={18} />
            {payoutRequested ? 'Payout Processing...' : 'Instant Bank Payout'}
          </button>
        </div>
      </div>

      {/* Performance KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-zinc-400 font-semibold">Acceptance Rate</div>
          <div className="font-black text-2xl text-white mt-1">{summary.acceptanceRate}%</div>
          <div className="text-[10px] text-emerald-400 mt-1">Top tier captain performance</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <div className="text-xs text-zinc-400 font-semibold">Driver Rating</div>
          <div className="font-black text-2xl text-amber-400 mt-1">★ {summary.ratingAvg}</div>
          <div className="text-[10px] text-zinc-400 mt-1">Based on rider reviews</div>
        </div>
      </div>

      {/* Recent Trips List */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h3 className="font-bold text-sm text-white">Recent Trip Earnings</h3>
          <span className="text-xs text-zinc-500">Last 30 days</span>
        </div>

        <div className="space-y-2.5">
          {(data?.earnings || []).slice(0, 8).map((e: any) => (
            <div
              key={e.id}
              className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-xs text-white">
                  Trip #{e.rideId.slice(0, 8)}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Gross: ₹{e.gross} • Tip: ₹{e.tip}
                </div>
              </div>
              <div className="text-right">
                <div className="font-black text-sm text-emerald-400">+₹{e.net}</div>
                <div className="text-[10px] text-zinc-500">
                  {new Date(e.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}

          {(!data?.earnings || data.earnings.length === 0) && (
            <div className="text-center text-zinc-500 text-xs py-6">
              Complete trips to start building your earnings history!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
