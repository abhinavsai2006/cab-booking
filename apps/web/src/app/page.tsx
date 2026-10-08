'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { ChatDrawer } from '@/components/ChatDrawer';
import { SosButton } from '@/components/SosButton';
import {
  Search,
  MapPin,
  Navigation,
  Clock,
  Shield,
  CreditCard,
  Tag,
  Share2,
  Phone,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  X,
  Star,
  Receipt,
  Plus,
} from 'lucide-react';
import type { VehicleEstimate, PlaceSuggestion } from '@cab-app/shared';
import type { MapMarker } from '@/components/MapComponent';

// Dynamic import of Map to prevent SSR Leaflet window errors
const MapComponent = dynamic(
  () => import('@/components/MapComponent').then((mod) => mod.MapComponent),
  { ssr: false }
);

export default function RiderPage() {
  // UI Steps: 'IDLE' | 'SEARCHING_DESTINATION' | 'SELECTING_VEHICLE' | 'SEARCHING_DRIVER' | 'DRIVER_ASSIGNED' | 'ON_TRIP' | 'COMPLETED'
  const [step, setStep] = useState<string>('IDLE');

  // Locations
  const [pickup, setPickup] = useState({
    address: 'Indiranagar 100ft Road',
    lat: 12.9784,
    lng: 77.6408,
  });
  const [dropoff, setDropoff] = useState({
    address: 'MG Road Metro Station',
    lat: 12.9756,
    lng: 77.6066,
  });
  const [stops, setStops] = useState<Array<{ address: string; lat: number; lng: number }>>([]);
  const [searchField, setSearchField] = useState<'pickup' | 'dropoff'>('dropoff');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);

  // Route & Estimates
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [estimates, setEstimates] = useState<VehicleEstimate[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('SEDAN');
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1.0);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'UPI' | 'CARD' | 'CASH'>('WALLET');

  // Active Ride Data
  const [activeRide, setActiveRide] = useState<any>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<MapMarker[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  // Load active ride on mount
  useEffect(() => {
    fetchActiveRide();
    fetchNearbyDrivers();

    const socket = getSocket();

    socket.on('ride:updated', (ride: any) => {
      setActiveRide(ride);
      if (ride.status === 'SEARCHING') setStep('SEARCHING_DRIVER');
      else if (ride.status === 'DRIVER_ASSIGNED' || ride.status === 'DRIVER_ARRIVED') setStep('DRIVER_ASSIGNED');
      else if (ride.status === 'IN_PROGRESS') setStep('ON_TRIP');
      else if (ride.status === 'COMPLETED') setStep('COMPLETED');
      else if (ride.status.startsWith('CANCELLED') || ride.status === 'NO_DRIVERS_FOUND') {
        setActiveRide(null);
        setStep('IDLE');
      }
    });

    socket.on('ride:driver_location', (loc: any) => {
      setNearbyDrivers((prev) => {
        const without = prev.filter((d) => d.id !== loc.driverId);
        return [
          ...without,
          {
            id: loc.driverId,
            lat: loc.lat,
            lng: loc.lng,
            heading: loc.heading,
            type: 'driver',
          },
        ];
      });
    });

    return () => {
      socket.off('ride:updated');
      socket.off('ride:driver_location');
    };
  }, []);

  const fetchActiveRide = async () => {
    try {
      const res = await api.get('/rides/active');
      if (res.ride) {
        setActiveRide(res.ride);
        if (res.ride.status === 'SEARCHING') setStep('SEARCHING_DRIVER');
        else if (res.ride.status === 'DRIVER_ASSIGNED' || res.ride.status === 'DRIVER_ARRIVED') setStep('DRIVER_ASSIGNED');
        else if (res.ride.status === 'IN_PROGRESS') setStep('ON_TRIP');
        else if (res.ride.status === 'COMPLETED') setStep('COMPLETED');
      }
    } catch {}
  };

  const fetchNearbyDrivers = async () => {
    // Generate scattered live demo car markers around current pickup
    const baseLat = 12.9716;
    const baseLng = 77.5946;
    const demoCars: MapMarker[] = Array.from({ length: 8 }).map((_, idx) => ({
      id: `driver-marker-${idx}`,
      lat: baseLat + (Math.random() - 0.5) * 0.04,
      lng: baseLng + (Math.random() - 0.5) * 0.04,
      heading: Math.floor(Math.random() * 360),
      type: 'driver',
    }));
    setNearbyDrivers(demoCars);
  };

  // Autocomplete search debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/maps/autocomplete?query=${encodeURIComponent(searchQuery)}`);
        setSuggestions(res.suggestions || []);
      } catch {}
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Request Fare Estimates
  const getFareEstimates = async (p = pickup, d = dropoff) => {
    try {
      const res = await api.post('/rides/estimate', {
        pickup: p,
        dropoff: d,
        stops,
        promoCode: promoCode || undefined,
      });

      if (res.route) {
        setRouteCoords(res.route.coordinates || []);
      }
      if (res.estimates) {
        setEstimates(res.estimates);
        setSurgeMultiplier(res.surgeMultiplier || 1.0);
      }
      setStep('SELECTING_VEHICLE');
    } catch (err: any) {
      alert(err.message || 'Error calculating fare');
    }
  };

  // Apply Promo Code
  const applyPromo = async () => {
    if (!promoCode.trim()) return;
    try {
      const res = await api.post('/promos/validate', {
        code: promoCode,
        vehicleType: selectedVehicle,
        estimatedFare: 250,
      });
      if (res.valid) {
        setPromoDiscount(res.promo.discount);
        alert(`Promo applied! You saved ₹${res.promo.discount}`);
      }
    } catch (err: any) {
      alert(err.message || 'Invalid promo code');
    }
  };

  // Book Ride
  const handleBookRide = async () => {
    try {
      setStep('SEARCHING_DRIVER');
      const res = await api.post('/rides', {
        vehicleType: selectedVehicle,
        pickup,
        dropoff,
        stops,
        paymentMethod,
        promoCode: promoCode || undefined,
      });

      setActiveRide(res.ride);

      const socket = getSocket();
      socket.emit('join:ride', { rideId: res.ride.id });
    } catch (err: any) {
      alert(err.message || 'Failed to book ride');
      setStep('SELECTING_VEHICLE');
    }
  };

  // Cancel Ride
  const handleCancelRide = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/cancel`, {
        reason: 'Rider changed plans',
      });
      setActiveRide(null);
      setStep('IDLE');
    } catch (err: any) {
      alert(err.message || 'Error cancelling ride');
    }
  };

  // Pay For Trip
  const handlePayTrip = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/pay`, { paymentMethod });
      alert('Payment successful!');
    } catch (err: any) {
      alert(err.message || 'Payment error');
    }
  };

  // Submit Driver Rating
  const handleRateDriver = async () => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/rate`, {
        stars: ratingStars,
        comment: ratingComment,
        tags: ['Polite', 'Safe Driver', 'Clean Car'],
      });
      setRatingSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'Failed to submit rating');
    }
  };

  // Tip Driver
  const handleTip = async (amt: number) => {
    if (!activeRide) return;
    try {
      await api.post(`/rides/${activeRide.id}/tip`, { amount: amt });
      setTipAmount(amt);
      alert(`Tip of ₹${amt} sent to driver!`);
    } catch (err: any) {
      alert(err.message || 'Failed to tip');
    }
  };

  // Share Trip
  const handleShareTrip = async () => {
    if (!activeRide) return;
    try {
      const res = await api.post(`/rides/${activeRide.id}/share`);
      navigator.clipboard.writeText(res.shareUrl);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 3000);
    } catch {}
  };

  // Map Markers
  const mapMarkers: MapMarker[] = [
    { id: 'pickup-pin', lat: pickup.lat, lng: pickup.lng, type: 'pickup', title: pickup.address },
    { id: 'dropoff-pin', lat: dropoff.lat, lng: dropoff.lng, type: 'dropoff', title: dropoff.address },
    ...stops.map((s, i) => ({
      id: `stop-${i}`,
      lat: s.lat,
      lng: s.lng,
      type: 'stop' as const,
      title: s.address,
    })),
    ...nearbyDrivers,
  ];

  return (
    <div className="relative flex-1 flex flex-col w-full h-[calc(100vh-57px)] overflow-hidden">
      {/* 1. Fullscreen Map Background */}
      <div className="absolute inset-0 z-0">
        <MapComponent
          center={[pickup.lat, pickup.lng]}
          markers={mapMarkers}
          routeCoordinates={routeCoords}
        />
      </div>

      {/* Share Toast */}
      {shareToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-black font-bold px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-sm animate-in fade-in duration-200">
          <CheckCircle2 size={16} /> Live tracking link copied to clipboard!
        </div>
      )}

      {/* 2. Top Search Floating Bar (when IDLE) */}
      {step === 'IDLE' && (
        <div className="absolute top-4 inset-x-4 max-w-lg mx-auto z-10">
          <div
            onClick={() => setStep('SEARCHING_DESTINATION')}
            className="bg-zinc-950/95 backdrop-blur-md border border-zinc-800 rounded-3xl p-4 shadow-2xl flex items-center gap-3 cursor-pointer hover:border-zinc-700 transition-all"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Search size={20} />
            </div>
            <div className="flex-1">
              <div className="text-zinc-400 text-xs font-medium">Where to?</div>
              <div className="text-white font-semibold text-sm">Search destination or airport</div>
            </div>
          </div>

          {/* Quick saved place chips */}
          <div className="flex items-center gap-2 mt-2.5 overflow-x-auto pb-1">
            <button
              onClick={() => {
                setDropoff({ address: 'MG Road Metro Station', lat: 12.9756, lng: 77.6066 });
                getFareEstimates(pickup, { address: 'MG Road Metro Station', lat: 12.9756, lng: 77.6066 });
              }}
              className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-xs px-3 py-1.5 rounded-full text-zinc-300 hover:text-white hover:border-zinc-600 flex items-center gap-1.5 shrink-0"
            >
              <MapPin size={13} className="text-emerald-400" /> Home
            </button>
            <button
              onClick={() => {
                setDropoff({ address: 'Indiranagar 100ft Road', lat: 12.9784, lng: 77.6408 });
                getFareEstimates(pickup, { address: 'Indiranagar 100ft Road', lat: 12.9784, lng: 77.6408 });
              }}
              className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-xs px-3 py-1.5 rounded-full text-zinc-300 hover:text-white hover:border-zinc-600 flex items-center gap-1.5 shrink-0"
            >
              <Navigation size={13} className="text-indigo-400" /> Work
            </button>
            <button
              onClick={() => {
                setDropoff({ address: 'Kempegowda Int Airport', lat: 13.1986, lng: 77.7066 });
                getFareEstimates(pickup, { address: 'Kempegowda Int Airport', lat: 13.1986, lng: 77.7066 });
              }}
              className="bg-zinc-950/80 backdrop-blur-md border border-zinc-800 text-xs px-3 py-1.5 rounded-full text-zinc-300 hover:text-white hover:border-zinc-600 flex items-center gap-1.5 shrink-0"
            >
              ✈️ Airport
            </button>
          </div>
        </div>
      )}

      {/* 3. Destination Search Modal */}
      {step === 'SEARCHING_DESTINATION' && (
        <div className="absolute inset-x-0 bottom-0 top-0 sm:top-auto max-w-lg mx-auto z-20 bg-zinc-950 border-t border-zinc-800 sm:rounded-t-3xl p-5 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <h3 className="font-bold text-lg text-white">Plan your ride</h3>
            <button
              onClick={() => setStep('IDLE')}
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {/* Pickup */}
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <input
                type="text"
                value={pickup.address}
                onChange={(e) => {
                  setPickup({ ...pickup, address: e.target.value });
                  setSearchField('pickup');
                  setSearchQuery(e.target.value);
                }}
                placeholder="Pickup Location"
                className="bg-transparent text-sm text-white w-full focus:outline-none"
              />
            </div>

            {/* Dropoff */}
            <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-3">
              <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
              <input
                type="text"
                value={dropoff.address}
                onChange={(e) => {
                  setDropoff({ ...dropoff, address: e.target.value });
                  setSearchField('dropoff');
                  setSearchQuery(e.target.value);
                }}
                placeholder="Destination"
                className="bg-transparent text-sm text-white w-full focus:outline-none"
              />
            </div>
          </div>

          {/* Autocomplete suggestions */}
          <div className="mt-4 flex-1 overflow-y-auto space-y-1">
            {suggestions.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (searchField === 'pickup') {
                    setPickup({ address: item.title, lat: item.lat, lng: item.lng });
                  } else {
                    setDropoff({ address: item.title, lat: item.lat, lng: item.lng });
                  }
                  setSearchQuery('');
                  setSuggestions([]);
                }}
                className="p-3 rounded-2xl hover:bg-zinc-900 cursor-pointer flex items-center gap-3 transition-colors"
              >
                <MapPin size={18} className="text-zinc-500 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="text-xs text-zinc-500">{item.subtitle}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => getFareEstimates()}
            className="mt-4 w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-2xl transition-colors shadow-lg"
          >
            Check Ride Fares & Routes
          </button>
        </div>
      )}

      {/* 4. Selecting Vehicle & Options (Bottom Sheet) */}
      {step === 'SELECTING_VEHICLE' && (
        <div className="absolute inset-x-0 bottom-0 max-w-lg mx-auto z-20 bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-5 shadow-2xl flex flex-col max-h-[70vh]">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h3 className="font-bold text-base text-white">Choose a ride</h3>
              <div className="text-xs text-zinc-400">
                {pickup.address.slice(0, 15)}... → {dropoff.address.slice(0, 15)}...
              </div>
            </div>
            <button
              onClick={() => setStep('IDLE')}
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {surgeMultiplier > 1.0 && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-2 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle size={14} /> High demand in this zone! Fare adjusted by {surgeMultiplier}x
            </div>
          )}

          {/* Vehicle options list */}
          <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
            {estimates.map((est) => {
              const isSelected = selectedVehicle === est.vehicleType;
              const discountedFare = Math.max(0, est.estimatedFare - promoDiscount);

              return (
                <div
                  key={est.vehicleType}
                  onClick={() => setSelectedVehicle(est.vehicleType)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-zinc-900 border-emerald-500 shadow-md ring-1 ring-emerald-500/20'
                      : 'bg-zinc-950 border-zinc-800/80 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 flex items-center justify-center text-2xl">
                      {est.vehicleType === 'BIKE' && '🛵'}
                      {est.vehicleType === 'AUTO' && '🛺'}
                      {est.vehicleType === 'MINI' && '🚗'}
                      {est.vehicleType === 'SEDAN' && '🚘'}
                      {est.vehicleType === 'SUV' && '🚙'}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        {est.name}
                        <span className="text-[10px] text-zinc-400 font-normal">
                          👤 {est.capacity}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Clock size={11} /> {est.etaMinutes} min away • {est.distanceKm} km
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-extrabold text-base text-white">
                      ₹{discountedFare.toFixed(0)}
                    </div>
                    {promoDiscount > 0 && (
                      <div className="text-[10px] text-zinc-500 line-through">
                        ₹{est.estimatedFare.toFixed(0)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment & Promo row */}
          <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
              <CreditCard size={13} className="text-emerald-400" />
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="bg-transparent text-white focus:outline-none"
              >
                <option value="WALLET" className="bg-zinc-900">Wallet</option>
                <option value="UPI" className="bg-zinc-900">UPI</option>
                <option value="CARD" className="bg-zinc-900">Card</option>
                <option value="CASH" className="bg-zinc-900">Cash</option>
              </select>
            </div>

            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                placeholder="Promo code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
              />
              <button
                onClick={applyPromo}
                className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-semibold"
              >
                Apply
              </button>
            </div>
          </div>

          <button
            onClick={handleBookRide}
            className="mt-3 w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm rounded-2xl transition-colors shadow-lg shadow-emerald-500/20"
          >
            Confirm & Book {selectedVehicle}
          </button>
        </div>
      )}

      {/* 5. Searching for Driver Radar */}
      {step === 'SEARCHING_DRIVER' && (
        <div className="absolute inset-x-0 bottom-0 max-w-lg mx-auto z-20 bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-6 shadow-2xl flex flex-col items-center text-center">
          {/* Animated radar rings */}
          <div className="relative w-24 h-24 flex items-center justify-center my-4">
            <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-emerald-500/20 animate-pulse" />
            <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center text-2xl shadow-xl shadow-emerald-500/30">
              🚕
            </div>
          </div>

          <h3 className="font-extrabold text-lg text-white mb-1">Connecting to nearby drivers</h3>
          <p className="text-zinc-400 text-xs max-w-xs mb-6">
            Dispatching ride request to closest 5-star captains around {pickup.address}...
          </p>

          <button
            onClick={handleCancelRide}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-sm rounded-2xl transition-colors"
          >
            Cancel Request
          </button>
        </div>
      )}

      {/* 6. Driver Assigned or On Trip Bottom Panel */}
      {(step === 'DRIVER_ASSIGNED' || step === 'ON_TRIP') && activeRide && (
        <div className="absolute inset-x-0 bottom-0 max-w-lg mx-auto z-20 bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-5 shadow-2xl flex flex-col">
          {/* Status banner */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {step === 'ON_TRIP' ? 'ON TRIP' : 'DRIVER ON THE WAY'}
              </span>
              <div className="font-bold text-sm text-white mt-1">
                {step === 'ON_TRIP' ? 'Heading to Destination' : 'Arriving in 3-5 mins'}
              </div>
            </div>

            {/* Start OTP Display */}
            <div className="text-right">
              <span className="text-[10px] text-zinc-400">START OTP</span>
              <div className="font-mono font-black text-xl text-emerald-400 tracking-widest">
                {activeRide.otp}
              </div>
            </div>
          </div>

          {/* Driver profile summary */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xl overflow-hidden">
                {activeRide.driver?.user?.photoUrl ? (
                  <img
                    src={activeRide.driver.user.photoUrl}
                    alt="Driver"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  '👨‍✈️'
                )}
              </div>
              <div>
                <div className="font-bold text-sm text-white flex items-center gap-1.5">
                  {activeRide.driver?.user?.name || 'Captain Assigned'}
                  <span className="flex items-center text-xs text-amber-400">
                    <Star size={12} className="fill-amber-400 mr-0.5" />
                    {activeRide.driver?.ratingAvg || 4.9}
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  {activeRide.driver?.vehicle?.make} {activeRide.driver?.vehicle?.model} •{' '}
                  <span className="text-zinc-200 font-mono font-bold">
                    {activeRide.driver?.vehicle?.plateNo || 'KA 01 AB 1234'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsChatOpen(true)}
                className="p-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200"
                title="Chat"
              >
                <MessageSquare size={16} />
              </button>
              <a
                href={`tel:${activeRide.driver?.user?.phone || '+919988776655'}`}
                className="p-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200"
                title="Call"
              >
                <Phone size={16} />
              </a>
            </div>
          </div>

          {/* Action buttons (Share trip, SOS, Cancel) */}
          <div className="pt-2 flex items-center gap-2">
            <button
              onClick={handleShareTrip}
              className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 rounded-xl flex items-center justify-center gap-1.5"
            >
              <Share2 size={14} /> Share Trip
            </button>

            <SosButton rideId={activeRide.id} />

            {step === 'DRIVER_ASSIGNED' && (
              <button
                onClick={handleCancelRide}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-red-400 rounded-xl"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* 7. Trip Completed / Rating / Receipt */}
      {step === 'COMPLETED' && activeRide && (
        <div className="absolute inset-x-0 bottom-0 max-w-lg mx-auto z-20 bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-y-auto">
          <div className="text-center pb-4 border-b border-zinc-800">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-2 text-xl font-bold">
              ✓
            </div>
            <h3 className="font-extrabold text-xl text-white">Trip Completed</h3>
            <div className="text-2xl font-black text-emerald-400 mt-1">
              ₹{activeRide.finalFare || activeRide.estimatedFare}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              Paid via {activeRide.paymentMethod}
            </div>
          </div>

          {/* Tip Driver Chips */}
          <div className="my-4">
            <div className="text-xs font-semibold text-zinc-300 mb-2">Add a tip for the captain:</div>
            <div className="grid grid-cols-4 gap-2">
              {[20, 50, 100, 150].map((amt) => (
                <button
                  key={amt}
                  onClick={() => handleTip(amt)}
                  className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                    tipAmount === amt
                      ? 'bg-emerald-500 text-black border-emerald-500'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  +₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Rating */}
          {!ratingSubmitted ? (
            <div className="my-2 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
              <div className="text-xs font-semibold text-zinc-300 mb-2 text-center">
                Rate your trip experience
              </div>
              <div className="flex justify-center gap-2 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setRatingStars(s)}
                    className="p-1 focus:outline-none"
                  >
                    <Star
                      size={24}
                      className={
                        s <= ratingStars
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-zinc-600'
                      }
                    />
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Leave an optional compliment or note..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700 mb-3"
              />
              <button
                onClick={handleRateDriver}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white rounded-xl"
              >
                Submit Feedback
              </button>
            </div>
          ) : (
            <div className="text-center text-xs text-emerald-400 my-3">
              ★ Thank you for rating your driver!
            </div>
          )}

          {/* Receipt download & finish */}
          <div className="mt-4 flex gap-2">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/rides/${activeRide.id}/receipt`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5"
            >
              <Receipt size={14} /> Download Receipt
            </a>
            <button
              onClick={() => {
                setActiveRide(null);
                setStep('IDLE');
              }}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black rounded-2xl shadow-lg"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* In-ride Chat Drawer */}
      {activeRide && (
        <ChatDrawer
          rideId={activeRide.id}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          currentUserRole="RIDER"
        />
      )}
    </div>
  );
}
