'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Users,
  Car,
  TrendingUp,
  ShieldAlert,
  Settings,
  DollarSign,
  Tag,
  AlertTriangle,
  LifeBuoy,
  FileSpreadsheet,
  Check,
  X,
  Search,
  RefreshCw,
  Eye,
  Sliders,
} from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<
    'DASHBOARD' | 'DRIVERS_KYC' | 'RIDES' | 'USERS' | 'PRICING' | 'SURGE' | 'PROMOS' | 'SOS' | 'TICKETS' | 'AUDIT'
  >('DASHBOARD');

  const [stats, setStats] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [rides, setRides] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [fares, setFares] = useState<any[]>([]);
  const [surgeZones, setSurgeZones] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);
  const [sosAlerts, setSosAlerts] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Load stats and tab data
  useEffect(() => {
    loadTabContent(activeTab);
  }, [activeTab]);

  const loadTabContent = async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'DASHBOARD') {
        const res = await api.get('/admin/stats');
        setStats(res.kpis);
        const rRes = await api.get('/admin/rides');
        setRides(rRes.rides || []);
      } else if (tab === 'DRIVERS_KYC') {
        const res = await api.get('/admin/drivers');
        setDrivers(res.drivers || []);
      } else if (tab === 'RIDES') {
        const res = await api.get('/admin/rides');
        setRides(res.rides || []);
      } else if (tab === 'USERS') {
        const res = await api.get('/admin/users');
        setUsers(res.users || []);
      } else if (tab === 'PRICING') {
        const res = await api.get('/admin/fares');
        setFares(res.fares || []);
      } else if (tab === 'SURGE') {
        const res = await api.get('/admin/surge-zones');
        setSurgeZones(res.zones || []);
      } else if (tab === 'PROMOS') {
        const res = await api.get('/admin/promos');
        setPromos(res.promos || []);
      } else if (tab === 'SOS') {
        const res = await api.get('/admin/sos');
        setSosAlerts(res.alerts || []);
      } else if (tab === 'TICKETS') {
        const res = await api.get('/admin/tickets');
        setTickets(res.tickets || []);
      } else if (tab === 'AUDIT') {
        const res = await api.get('/admin/audit');
        setAuditLogs(res.logs || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleKycAction = async (driverId: string, action: 'APPROVE' | 'REJECT') => {
    try {
      await api.post(`/admin/drivers/${driverId}/kyc`, { action });
      loadTabContent('DRIVERS_KYC');
    } catch {
      alert('Action failed');
    }
  };

  const handleRefund = async (rideId: string) => {
    if (!confirm('Refund this trip to rider wallet?')) return;
    try {
      await api.post(`/admin/rides/${rideId}/refund`);
      alert('Trip refunded successfully!');
      loadTabContent('RIDES');
    } catch {
      alert('Refund failed');
    }
  };

  const handleResolveSos = async (sosId: string) => {
    try {
      await api.patch(`/admin/sos/${sosId}`, { status: 'RESOLVED' });
      loadTabContent('SOS');
    } catch {
      alert('Failed to resolve alert');
    }
  };

  return (
    <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Admin Title & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>Platform Admin Console</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              LIVE
            </span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Realtime operations, fleet dispatch, safety command, and financial oversight
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/admin/export/rides.csv`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300"
          >
            <FileSpreadsheet size={15} className="text-emerald-400" /> Export CSV
          </a>
          <button
            onClick={() => loadTabContent(activeTab)}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-zinc-300"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 border-b border-zinc-900 text-xs font-semibold">
        {[
          { id: 'DASHBOARD', label: 'Overview & KPIs', icon: TrendingUp },
          { id: 'DRIVERS_KYC', label: 'Drivers & KYC', icon: Car },
          { id: 'RIDES', label: 'Rides Feed', icon: Search },
          { id: 'USERS', label: 'Riders', icon: Users },
          { id: 'PRICING', label: 'Fare Configs', icon: Sliders },
          { id: 'SURGE', label: 'Surge Zones', icon: AlertTriangle },
          { id: 'PROMOS', label: 'Promotions', icon: Tag },
          { id: 'SOS', label: 'Safety SOS', icon: ShieldAlert },
          { id: 'TICKETS', label: 'Support Tickets', icon: LifeBuoy },
          { id: 'AUDIT', label: 'Audit Log', icon: FileSpreadsheet },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                isActive
                  ? 'bg-emerald-500 text-black font-extrabold shadow-sm'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & KPIS */}
      {activeTab === 'DASHBOARD' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
              <div className="text-xs text-zinc-400 font-semibold uppercase">Total Revenue</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                ₹{stats.todayRevenue.toLocaleString()}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">Platform GMV</div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
              <div className="text-xs text-zinc-400 font-semibold uppercase">Active Rides</div>
              <div className="text-2xl font-black text-white mt-1">{stats.activeRides}</div>
              <div className="text-[10px] text-blue-400 mt-0.5">Live trips in transit</div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
              <div className="text-xs text-zinc-400 font-semibold uppercase">Online Fleet</div>
              <div className="text-2xl font-black text-white mt-1">
                {stats.onlineDrivers} <span className="text-xs font-normal text-zinc-500">/ {stats.totalDrivers}</span>
              </div>
              <div className="text-[10px] text-emerald-400 mt-0.5">Available for dispatch</div>
            </div>
            <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-2xl">
              <div className="text-xs text-zinc-400 font-semibold uppercase">Completion Rate</div>
              <div className="text-2xl font-black text-white mt-1">{stats.completionRate}%</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{stats.completedRides} total completed</div>
            </div>
          </div>

          {/* Live Recent Rides Feed */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="font-bold text-sm text-white">Live Rides Feed</h3>
              <span className="text-xs text-zinc-500">Realtime activity</span>
            </div>
            <div className="divide-y divide-zinc-900 overflow-x-auto">
              {rides.slice(0, 10).map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between text-xs gap-4 min-w-[600px]">
                  <div>
                    <div className="font-semibold text-white">#{r.id.slice(0, 8)} • {r.vehicleType}</div>
                    <div className="text-zinc-500 text-[10px]">
                      {r.pickupAddress.slice(0, 20)}... → {r.dropoffAddress.slice(0, 20)}...
                    </div>
                  </div>
                  <div>
                    <span className="font-bold text-white">{r.rider?.name || 'Rider'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-300">{r.driver?.user?.name || 'Unassigned'}</span>
                  </div>
                  <div className="font-mono font-bold text-emerald-400">
                    ₹{r.finalFare || r.estimatedFare}
                  </div>
                  <div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300">
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DRIVERS & KYC QUEUE */}
      {activeTab === 'DRIVERS_KYC' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-white">Driver Partner & KYC Verification Queue</h3>
            <span className="text-xs text-zinc-400">{drivers.length} registered drivers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500 border-b border-zinc-800/80">
                <tr>
                  <th className="pb-2">Captain</th>
                  <th className="pb-2">Vehicle</th>
                  <th className="pb-2">Plate No</th>
                  <th className="pb-2">License</th>
                  <th className="pb-2">Rating</th>
                  <th className="pb-2">KYC Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {drivers.map((d) => (
                  <tr key={d.id} className="hover:bg-zinc-900/30">
                    <td className="py-3 font-semibold text-white">{d.user?.name}</td>
                    <td className="py-3 text-zinc-400">{d.vehicle?.make} {d.vehicle?.model} ({d.vehicle?.type})</td>
                    <td className="py-3 font-mono font-bold text-zinc-200">{d.vehicle?.plateNo}</td>
                    <td className="py-3 font-mono text-zinc-400">{d.licenseNo || 'DL-KA-2022'}</td>
                    <td className="py-3 text-amber-400 font-bold">★ {d.ratingAvg}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        d.kycStatus === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      }`}>
                        {d.kycStatus}
                      </span>
                    </td>
                    <td className="py-3 text-right space-x-1">
                      {d.kycStatus !== 'APPROVED' && (
                        <button
                          onClick={() => handleKycAction(d.id, 'APPROVE')}
                          className="px-2.5 py-1 bg-emerald-500 text-black font-bold rounded-lg text-[10px]"
                        >
                          Approve
                        </button>
                      )}
                      {d.kycStatus !== 'REJECTED' && (
                        <button
                          onClick={() => handleKycAction(d.id, 'REJECT')}
                          className="px-2.5 py-1 bg-red-600/20 text-red-400 rounded-lg text-[10px]"
                        >
                          Reject
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: RIDES */}
      {activeTab === 'RIDES' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-white">All Platform Rides ({rides.length})</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500 border-b border-zinc-800/80">
                <tr>
                  <th className="pb-2">Ride ID</th>
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Rider</th>
                  <th className="pb-2">Driver</th>
                  <th className="pb-2">Distance</th>
                  <th className="pb-2">Fare</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {rides.slice(0, 25).map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-900/30">
                    <td className="py-3 font-mono font-bold text-zinc-300">#{r.id.slice(0, 8)}</td>
                    <td className="py-3 font-semibold text-white">{r.vehicleType}</td>
                    <td className="py-3 text-zinc-300">{r.rider?.name}</td>
                    <td className="py-3 text-zinc-400">{r.driver?.user?.name || 'Unassigned'}</td>
                    <td className="py-3 text-zinc-400">{r.distanceKm} km</td>
                    <td className="py-3 font-bold text-emerald-400">₹{r.finalFare || r.estimatedFare}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300">
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {r.status === 'COMPLETED' && (
                        <button
                          onClick={() => handleRefund(r.id)}
                          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-[10px]"
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: RIDERS / USERS */}
      {activeTab === 'USERS' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-white">Registered Users ({users.length})</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500 border-b border-zinc-800/80">
                <tr>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Wallet</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-900/30">
                    <td className="py-3 font-semibold text-white">{u.name}</td>
                    <td className="py-3 text-zinc-400">{u.email}</td>
                    <td className="py-3 text-zinc-300">{u.role}</td>
                    <td className="py-3 font-bold text-emerald-400">₹{u.walletBalance}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: FARE CONFIGS */}
      {activeTab === 'PRICING' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-white">Vehicle Pricing & Fare Structure (Bangalore)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fares.map((f) => (
              <div key={f.id} className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-2 text-xs">
                <div className="font-extrabold text-base text-white">{f.vehicleType}</div>
                <div className="flex justify-between text-zinc-400"><span>Base Fare:</span><span className="font-bold text-white">₹{f.baseFare}</span></div>
                <div className="flex justify-between text-zinc-400"><span>Per Kilometer:</span><span className="font-bold text-white">₹{f.perKm}</span></div>
                <div className="flex justify-between text-zinc-400"><span>Per Minute:</span><span className="font-bold text-white">₹{f.perMinute}</span></div>
                <div className="flex justify-between text-zinc-400"><span>Minimum Fare:</span><span className="font-bold text-white">₹{f.minFare}</span></div>
                <div className="flex justify-between text-zinc-400"><span>Night Multiplier:</span><span className="font-bold text-amber-400">{f.nightMultiplier}x</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: SURGE ZONES */}
      {activeTab === 'SURGE' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-white">Active Surge Zones ({surgeZones.length})</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {surgeZones.map((z) => (
              <div key={z.id} className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-2">
                <div className="font-bold text-sm text-white">{z.name}</div>
                <div className="text-zinc-400">Multiplier: <span className="font-extrabold text-amber-400 text-base">{z.multiplier}x</span></div>
                <div className="text-[10px] text-zinc-500">Source: {z.source} • City: {z.city}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: PROMOTIONS */}
      {activeTab === 'PROMOS' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-white">Active Promo Codes ({promos.length})</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {promos.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-2">
                <div className="font-mono font-black text-emerald-400 text-base">{p.code}</div>
                <div className="text-zinc-300">
                  {p.type === 'PERCENT' ? `${p.value}% Off` : `₹${p.value} Flat Off`}
                </div>
                <div className="text-[10px] text-zinc-500">
                  Max Discount: ₹{p.maxDiscount} • Min Fare: ₹{p.minFare}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: SAFETY SOS */}
      {activeTab === 'SOS' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-white text-red-500 flex items-center gap-2">
              <ShieldAlert size={16} /> 24/7 Safety Command Center (SOS Alerts)
            </h3>
          </div>

          <div className="space-y-3">
            {sosAlerts.map((a) => (
              <div
                key={a.id}
                className="p-4 rounded-2xl bg-zinc-900/60 border border-red-900/40 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white">User: {a.user?.name} ({a.user?.phone || 'No phone'})</div>
                  <div className="text-zinc-400 text-[10px]">
                    Coordinates: ({a.lat.toFixed(4)}, {a.lng.toFixed(4)}) • Time: {new Date(a.createdAt).toLocaleTimeString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    a.status === 'ACTIVE' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {a.status}
                  </span>
                  {a.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleResolveSos(a.id)}
                      className="px-3 py-1 bg-emerald-500 text-black font-bold rounded-lg text-xs"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}

            {sosAlerts.length === 0 && (
              <div className="text-center text-zinc-500 text-xs py-8">
                No active SOS alerts. Fleet safety normal.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 9: SUPPORT TICKETS */}
      {activeTab === 'TICKETS' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-white">Help & Support Inquiries ({tickets.length})</h3>
          </div>

          <div className="space-y-2.5">
            {tickets.map((t) => (
              <div key={t.id} className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white">{t.subject}</div>
                  <div className="text-zinc-500 text-[10px]">
                    From: {t.user?.name} • Category: {t.category}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-300">
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 10: AUDIT LOG */}
      {activeTab === 'AUDIT' && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="font-bold text-sm text-white">System Audit Trail</h3>
          </div>

          <div className="space-y-2">
            {auditLogs.map((l) => (
              <div key={l.id} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-emerald-400">{l.action}</span> on {l.entity}
                </div>
                <div className="text-zinc-500 text-[10px]">{new Date(l.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
