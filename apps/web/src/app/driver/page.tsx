'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { CountdownRing } from '@cab-app/ui';
import { ChatDrawer } from '@/components/ChatDrawer';
import {
  Power,
  Navigation,
  CheckCircle2,
  XCircle,
  Phone,
  MessageSquare,
  ShieldAlert,
  Wallet,
  Clock,
  MapPin,
  Star,
  FileText,
  UserCheck,
} from 'lucide-react';
import type { MapMarker } from '@/components/MapComponent';

const MapComponent = dynamic(
  () => import('@/components/MapComponent').then((mod) => mod.MapComponent),
  { ssr: false }
);

export default function DriverPage() {
  const [isOnline, setIsOnline] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Incoming Ride Offer
  const [incomingOffer, setIncomingOffer] = useState<any>(null);

  // Active Trip State: 'IDLE' | 'NAVIGATING_TO_PICKUP' | 'WAITING_FOR_OTP' | 'ON_TRIP' | 'COMPLETED'
  const [tripState, setTripState] = useState<string>('IDLE');
  const [activeRide, setActiveRide] = useState<any>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Location
  const [coords, setCoords] = useState({ lat: 12.9716, lng: 77.5946 });

  useEffect(() => {
    fetchDriverStatus();

    const socket = getSocket();

    // Listen for new ride offers
    socket.on('offer:new', (offer: any) => {
      setIncomingOffer(offer);
    });

    socket.on('offer:expired', () => {
      setIncomingOffer(null);
    });

    socket.on('ride:updated', (ride: any) => {
      setActiveRide(ride);
      if (ride.status === 'DRIVER_ASSIGNED') setTripState('NAVIGATING_TO_PICKUP');
      else if (ride.status === 'DRIVER_ARRIVED') setTripState('WAITING_FOR_OTP');
      else if (ride.status === 'IN_PROGRESS') setTripState('ON_TRIP');
      else if (ride.status === 'COMPLETED') setTripState('COMPLETED');
      else if (ride.status.startsWith('CANCELLED')) {
        setActiveRide(null);
        setTripState('IDLE');
        alert(`Trip was cancelled: ${ride.cancelReason || 'Cancelled'}`);
      }
    });

    return () => {
      socket.off('offer:new');
      socket.off('offer:expired');
      socket.off('ride:updated');
    };
  }, []);

  const fetchDriverStatus = async () => {
    try {
      const res = await api.get('/driver/status');
      setProfile(res.profile);
      setIsOnline(res.profile?.isOnline || false);
      if (res.profile?.currentLat) {
        setCoords({ lat: res.profile.currentLat, lng: res.profile.currentLng });
      }

      // Check active rides
      const rideRes = await api.get('/rides/active');
      if (rideRes.ride && rideRes.ride.driver?.id === res.profile?.id) {
        setActiveRide(rideRes.ride);
        if (rideRes.ride.status === 'DRIVER_ASSIGNED') setTripState('NAVIGATING_TO_PICKUP');
        else if (rideRes.ride.status === 'DRIVER_ARRIVED') setTripState('WAITING_FOR_OTP');
        else if (rideRes.ride.status === 'IN_PROGRESS') setTripState('ON_TRIP');
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async () => {
    const socket = getSocket();
    if (isOnline) {
      await api.post('/driver/offline');
      socket.emit('driver:offline');
      setIsOnline(false);
    } else {
      await api.post('/driver/online', { lat: coords.lat, lng: coords.lng });
      socket.emit('driver:online', { lat: coords.lat, lng: coords.lng });
      setIsOnline(true);
    }
  };

  const handleAcceptOffer = () => {
    if (!incomingOffer) return;
    const socket = getSocket();
    socket.emit('offer:accept', { offerId: incomingOffer.offerId });
    setIncomingOffer(null);
    setTripState('NAVIGATING_TO_PICKUP');
  };

  const handleDeclineOffer = () => {
    if (!incomingOffer) return;
    const socket = getSocket();
    socket.emit('offer:decline', { offerId: incomingOffer.offerId });
    setIncomingOffer(null);
  };

  const handleArrived = () => {
    if (!activeRide) return;
    const socket = getSocket();
    socket.emit('ride:arrived', { rideId: activeRide.id });
    setTripState('WAITING_FOR_OTP');
  };

  const handleVerifyOtp = () => {
    if (!activeRide || otpInput.length !== 4) {
      setOtpError('Please enter valid 4-digit OTP');
      return;
    }
    const socket = getSocket();
    socket.emit('ride:start', { rideId: activeRide.id, otp: otpInput });
    setTripState('ON_TRIP');
    setOtpError('');
  };

  const handleCompleteTrip = () => {
    if (!activeRide) return;
    const socket = getSocket();
    socket.emit('ride:complete', { rideId: activeRide.id });
    setTripState('COMPLETED');
  };

  // Map markers
  const markers: MapMarker[] = [
    { id: 'driver-me', lat: coords.lat, lng: coords.lng, type: 'driver', title: 'My Vehicle' },
  ];
  if (activeRide) {
    markers.push({
      id: 'pickup',
      lat: activeRide.pickupLat,
      lng: activeRide.pickupLng,
      type: 'pickup',
      title: activeRide.pickupAddress,
    });
    markers.push({
      id: 'dropoff',
      lat: activeRide.dropoffLat,
      lng: activeRide.dropoffLng,
      type: 'dropoff',
      title: activeRide.dropoffAddress,
    });
  }

  return (
    <div className="relative flex-1 flex flex-col w-full h-[calc(100vh-57px)] overflow-hidden">
      {/* 1. Map */}
      <div className="absolute inset-0 z-0">
        <MapComponent
          center={[coords.lat, coords.lng]}
          markers={markers}
          routeCoordinates={activeRide?.routePolyline ? JSON.parse(activeRide.routePolyline) : []}
        />
      </div>

      {/* 2. Top Header Bar with Online Toggle & Today's Earnings */}
      <div className="absolute top-4 inset-x-4 max-w-lg mx-auto z-10 flex items-center justify-between gap-3">
        {/* Big Online/Offline Button */}
        <button
          onClick={toggleOnline}
          className={`flex-1 py-3 px-5 rounded-3xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-2xl transition-all border ${
            isOnline
              ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400 shadow-emerald-500/20'
              : 'bg-zinc-950/90 hover:bg-zinc-900 text-zinc-300 border-zinc-800'
          }`}
        >
          <Power size={18} className={isOnline ? 'text-black' : 'text-zinc-500'} />
          <span>{isOnline ? 'YOU ARE ONLINE' : 'GO ONLINE'}</span>
        </button>

        {/* Earnings Quick Badge */}
        <Link
          href="/driver/earnings"
          className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800 p-2.5 rounded-3xl flex items-center gap-2 text-xs font-semibold text-white shadow-xl hover:border-zinc-700"
        >
          <div className="w-8 h-8 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            ₹
          </div>
          <div className="hidden xs:block pr-2">
            <div className="text-[10px] text-zinc-400">Earnings</div>
            <div>View Summary</div>
          </div>
        </Link>
      </div>

      {/* 3. Driver Profile Mini-HUD (when idle) */}
      {tripState === 'IDLE' && profile && (
        <div className="absolute bottom-6 inset-x-4 max-w-lg mx-auto z-10 bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-3xl p-5 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl">
                👨‍✈️
              </div>
              <div>
                <div className="font-bold text-sm text-white">{profile.user?.name || 'Captain'}</div>
                <div className="text-xs text-zinc-400">
                  {profile.vehicle?.make} {profile.vehicle?.model} •{' '}
                  <span className="font-mono text-zinc-300 font-semibold">{profile.vehicle?.plateNo}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2.5 py-1 rounded-xl text-xs font-bold">
              <Star size={13} className="fill-amber-400" />
              <span>{profile.ratingAvg}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-800/80">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">Trips</div>
              <div className="font-extrabold text-sm text-white mt-0.5">{profile.completedTrips}</div>
            </div>
            <div className="bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-800/80">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">Acceptance</div>
              <div className="font-extrabold text-sm text-emerald-400 mt-0.5">{profile.acceptanceRate}%</div>
            </div>
            <div className="bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-800/80">
              <div className="text-[10px] text-zinc-400 uppercase font-semibold">Status</div>
              <div className="font-extrabold text-sm text-zinc-300 mt-0.5">
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Incoming Ride Offer Modal (15s Countdown Ring) */}
      {incomingOffer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center">
            {/* Animated 15s Countdown Ring */}
            <div className="my-2">
              <CountdownRing
                initialSeconds={incomingOffer.timeoutSeconds || 15}
                onTimeout={handleDeclineOffer}
                size={84}
                strokeWidth={7}
              />
            </div>

            <div className="text-center my-3">
              <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                NEW RIDE REQUEST
              </span>
              <div className="font-black text-2xl text-white mt-2">
                ₹{incomingOffer.estimatedFare}
              </div>
              <div className="text-xs text-zinc-400 mt-0.5">
                {incomingOffer.distanceKm} km • {incomingOffer.distanceToPickupKm} km to pickup
              </div>
            </div>

            {/* Pickup & Dropoff details */}
            <div className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 my-2 space-y-3">
              <div className="flex items-start gap-2.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1" />
                <div>
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase">Pickup</div>
                  <div className="font-medium text-white">{incomingOffer.pickup.address}</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-1" />
                <div>
                  <div className="text-[10px] text-zinc-500 font-semibold uppercase">Dropoff</div>
                  <div className="font-medium text-white">{incomingOffer.dropoff.address}</div>
                </div>
              </div>
            </div>

            {/* Accept & Decline Buttons */}
            <div className="w-full flex gap-3 mt-4">
              <button
                onClick={handleDeclineOffer}
                className="flex-1 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-sm rounded-2xl transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptOffer}
                className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-2xl transition-colors shadow-lg shadow-emerald-500/30"
              >
                ACCEPT RIDE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Navigating to Pickup State */}
      {tripState === 'NAVIGATING_TO_PICKUP' && activeRide && (
        <div className="absolute bottom-6 inset-x-4 max-w-lg mx-auto z-20 bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400">
                NAVIGATING TO PICKUP
              </span>
              <div className="font-bold text-sm text-white mt-0.5">{activeRide.pickupAddress}</div>
            </div>
            <button
              onClick={() => setIsChatOpen(true)}
              className="p-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200"
            >
              <MessageSquare size={16} />
            </button>
          </div>

          <div className="py-3 flex items-center justify-between text-xs text-zinc-400">
            <div>Rider: <span className="font-bold text-white">{activeRide.rider?.name}</span></div>
            <div>Fare: <span className="font-bold text-emerald-400">₹{activeRide.estimatedFare}</span></div>
          </div>

          <button
            onClick={handleArrived}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-2xl transition-colors shadow-lg"
          >
            I HAVE ARRIVED AT PICKUP
          </button>
        </div>
      )}

      {/* 6. Waiting for Rider OTP */}
      {tripState === 'WAITING_FOR_OTP' && activeRide && (
        <div className="absolute bottom-6 inset-x-4 max-w-lg mx-auto z-20 bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-3">
            <UserCheck size={24} />
          </div>

          <h3 className="font-extrabold text-base text-white">Enter Rider OTP</h3>
          <p className="text-zinc-400 text-xs mt-1 mb-4">
            Ask {activeRide.rider?.name} for their 4-digit verification code to start the ride.
          </p>

          <input
            type="text"
            maxLength={4}
            value={otpInput}
            onChange={(e) => setOtpInput(e.target.value)}
            placeholder="● ● ● ●"
            className="w-48 text-center font-mono font-black text-2xl tracking-widest bg-zinc-900 border border-zinc-800 rounded-2xl py-3 text-white focus:outline-none focus:border-emerald-500 mb-2"
          />

          {otpError && <div className="text-xs text-red-500 mb-2">{otpError}</div>}

          <button
            onClick={handleVerifyOtp}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-2xl transition-colors shadow-lg shadow-emerald-500/20"
          >
            VERIFY & START TRIP
          </button>
        </div>
      )}

      {/* 7. On Trip State */}
      {tripState === 'ON_TRIP' && activeRide && (
        <div className="absolute bottom-6 inset-x-4 max-w-lg mx-auto z-20 bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400">
                DRIVING TO DESTINATION
              </span>
              <div className="font-bold text-sm text-white mt-0.5">{activeRide.dropoffAddress}</div>
            </div>
            <div className="text-right font-black text-lg text-emerald-400">
              ₹{activeRide.estimatedFare}
            </div>
          </div>

          <div className="py-3 flex items-center justify-between text-xs text-zinc-400">
            <div>Distance: <span className="text-white font-bold">{activeRide.distanceKm} km</span></div>
            <div>Payment: <span className="text-white font-bold">{activeRide.paymentMethod}</span></div>
          </div>

          <button
            onClick={handleCompleteTrip}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm rounded-2xl transition-colors shadow-lg"
          >
            COMPLETE TRIP
          </button>
        </div>
      )}

      {/* 8. Trip Completed Summary */}
      {tripState === 'COMPLETED' && activeRide && (
        <div className="absolute bottom-6 inset-x-4 max-w-lg mx-auto z-20 bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-2 text-xl font-bold">
            ✓
          </div>
          <h3 className="font-extrabold text-lg text-white">Trip Completed</h3>
          <div className="font-black text-2xl text-emerald-400 mt-1">
            +₹{Math.round((activeRide.finalFare || activeRide.estimatedFare) * 0.8)} Net Earning
          </div>
          <div className="text-xs text-zinc-400 mt-0.5">
            Gross: ₹{activeRide.finalFare || activeRide.estimatedFare} • Commission (20%): ₹
            {Math.round((activeRide.finalFare || activeRide.estimatedFare) * 0.2)}
          </div>

          <button
            onClick={() => {
              setActiveRide(null);
              setTripState('IDLE');
            }}
            className="mt-5 w-full py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm rounded-2xl"
          >
            Ready for Next Ride
          </button>
        </div>
      )}

      {/* In-trip chat drawer */}
      {activeRide && (
        <ChatDrawer
          rideId={activeRide.id}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          currentUserRole="DRIVER"
        />
      )}
    </div>
  );
}
