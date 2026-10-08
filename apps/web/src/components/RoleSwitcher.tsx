'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { resetSocket } from '@/lib/socket';
import { User, Car, Shield, Wallet, History, Tag, LifeBuoy, Bell } from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [activeRole, setActiveRole] = useState<string>('RIDER');
  const [userName, setUserName] = useState<string>('Demo Rider');
  const [walletBalance, setWalletBalance] = useState<number>(1000);

  useEffect(() => {
    const saved = localStorage.getItem('cab_active_role') || 'RIDER';
    setActiveRole(saved);

    // Fetch user info
    api
      .get('/me')
      .then((res) => {
        if (res.user) {
          setUserName(res.user.name);
          setWalletBalance(res.user.walletBalance);
          localStorage.setItem('cab_active_user_id', res.user.id);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const switchRole = async (role: 'RIDER' | 'DRIVER' | 'ADMIN') => {
    localStorage.setItem('cab_active_role', role);
    setActiveRole(role);
    resetSocket();

    try {
      const res = await api.post('/auth/demo-switch', { role });
      if (res.user) {
        localStorage.setItem('cab_active_user_id', res.user.id);
        setUserName(res.user.name);
        setWalletBalance(res.user.walletBalance);
      }
    } catch {}

    if (role === 'RIDER') router.push('/');
    else if (role === 'DRIVER') router.push('/driver');
    else if (role === 'ADMIN') router.push('/admin');
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center font-black text-black text-lg">
            C
          </div>
          <span className="font-bold text-lg tracking-tight text-white hidden sm:inline">
            Cab<span className="text-emerald-400">Hub</span>
          </span>
        </Link>

        {/* Quick navigation links */}
        <nav className="flex items-center gap-1 sm:gap-3 text-xs sm:text-sm font-medium">
          <button
            onClick={() => switchRole('RIDER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              pathname === '/' || pathname.startsWith('/history') || pathname.startsWith('/wallet')
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <User size={15} />
            <span className="hidden xs:inline">Rider</span>
          </button>

          <button
            onClick={() => switchRole('DRIVER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              pathname.startsWith('/driver')
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Car size={15} />
            <span className="hidden xs:inline">Driver</span>
          </button>

          <button
            onClick={() => switchRole('ADMIN')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
              pathname.startsWith('/admin')
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Shield size={15} />
            <span className="hidden xs:inline">Admin</span>
          </button>
        </nav>

        {/* User stats & actions */}
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/wallet"
            className="hidden sm:flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 px-2.5 py-1.5 rounded-xl font-semibold"
          >
            <Wallet size={14} />
            <span>₹{walletBalance.toFixed(0)}</span>
          </Link>

          <Link
            href="/history"
            title="Ride History"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            <History size={16} />
          </Link>

          <Link
            href="/promos"
            title="Promos"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            <Tag size={16} />
          </Link>

          <Link
            href="/support"
            title="Support"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            <LifeBuoy size={16} />
          </Link>

          <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-300 font-medium hidden md:inline truncate max-w-[120px]">
              {userName}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
