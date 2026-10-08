'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ArrowLeft, Clock, MapPin, Receipt, Star } from 'lucide-react';

export default function RideHistoryPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/rides')
      .then((res) => setRides(res.rides || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 w-full space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="p-2 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center gap-1.5 text-xs font-semibold"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <h1 className="font-extrabold text-lg text-white">Your Rides</h1>
        <div className="w-8" />
      </div>

      <div className="space-y-3">
        {rides.map((r) => (
          <div
            key={r.id}
            className="p-4 rounded-3xl bg-zinc-950 border border-zinc-800 shadow-xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
              <div>
                <span className="text-xs font-bold text-white uppercase">{r.vehicleType}</span>
                <span className="text-zinc-500 text-xs ml-2">#{r.id.slice(0, 8)}</span>
              </div>
              <div className="text-right">
                <div className="font-extrabold text-base text-emerald-400">
                  ₹{r.finalFare || r.estimatedFare}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Pickup & Drop */}
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate">{r.pickupAddress}</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span className="truncate">{r.dropoffAddress}</span>
              </div>
            </div>

            {/* Driver & receipt */}
            <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-xs">
              <div className="text-zinc-400">
                Captain: <span className="text-white font-medium">{r.driver?.user?.name || 'Assigned Driver'}</span>
              </div>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/rides/${r.id}/receipt`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
              >
                <Receipt size={14} /> Receipt
              </a>
            </div>
          </div>
        ))}

        {!loading && rides.length === 0 && (
          <div className="text-center text-zinc-500 text-xs py-12">
            No rides booked yet. Book your first ride from the home map!
          </div>
        )}
      </div>
    </div>
  );
}
