'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { ShieldAlert, AlertTriangle, X } from 'lucide-react';

export interface SosButtonProps {
  rideId?: string;
  currentLat?: number;
  currentLng?: number;
}

export const SosButton: React.FC<SosButtonProps> = ({
  rideId,
  currentLat = 12.9716,
  currentLng = 77.5946,
}) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);
  const [loading, setLoading] = useState(false);

  const triggerSos = async () => {
    setLoading(true);
    try {
      await api.post('/sos', {
        rideId,
        lat: currentLat,
        lng: currentLng,
        address: 'Current Live GPS Location',
      });

      const socket = getSocket();
      socket.emit('sos:trigger', { rideId, lat: currentLat, lng: currentLng });

      setIsTriggered(true);
    } catch (err: any) {
      alert(err.message || 'Failed to trigger SOS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsConfirmOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 font-bold text-xs rounded-xl transition-all shadow-sm"
        title="Emergency SOS"
      >
        <ShieldAlert size={14} className="text-red-500 animate-pulse" />
        <span>SOS</span>
      </button>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-950 border border-red-800/60 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-4 text-red-500 animate-pulse">
              <AlertTriangle size={28} />
            </div>

            {!isTriggered ? (
              <>
                <h3 className="text-xl font-bold text-white mb-2">Emergency Assistance</h3>
                <p className="text-zinc-400 text-xs mb-6">
                  This will broadcast your live GPS coordinates immediately to our 24/7 Safety
                  Command Center and notify your saved emergency contacts.
                </p>

                <div className="flex w-full gap-3">
                  <button
                    onClick={() => setIsConfirmOpen(false)}
                    className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-sm rounded-2xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={triggerSos}
                    disabled={loading}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-2xl transition-colors shadow-lg shadow-red-600/30"
                  >
                    {loading ? 'Alerting...' : 'TRIGGER SOS'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-emerald-400 mb-2">Help is Dispatched</h3>
                <p className="text-zinc-300 text-xs mb-6">
                  Emergency team alerted. Stay inside the vehicle and call local emergency services
                  if in immediate danger.
                </p>
                <a
                  href="tel:112"
                  className="w-full py-3 mb-3 bg-red-600 text-white font-bold text-sm rounded-2xl text-center block"
                >
                  Call National Emergency (112)
                </a>
                <button
                  onClick={() => {
                    setIsConfirmOpen(false);
                    setIsTriggered(false);
                  }}
                  className="w-full py-2.5 bg-zinc-900 text-zinc-400 text-xs rounded-xl"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
