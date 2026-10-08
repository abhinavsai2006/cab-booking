'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Shield, MapPin, Navigation, Clock, Phone } from 'lucide-react';
import type { MapMarker } from '@/components/MapComponent';

const MapComponent = dynamic(
  () => import('@/components/MapComponent').then((mod) => mod.MapComponent),
  { ssr: false }
);

export default function PublicTrackPage({ params }: { params: { token: string } }) {
  const [ride, setRide] = useState<any>(null);
  const [driverLoc, setDriverLoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/public/track/${params.token}`)
      .then((res) => {
        setRide(res.ride);
        if (res.ride?.driver?.currentLat) {
          setDriverLoc({
            lat: res.ride.driver.currentLat,
            lng: res.ride.driver.currentLng,
            heading: res.ride.driver.heading || 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const socket = getSocket();
    socket.on('ride:driver_location', (loc: any) => {
      setDriverLoc(loc);
    });

    return () => {
      socket.off('ride:driver_location');
    };
  }, [params.token]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Connecting to live ride stream...
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Trip Not Found or Expired</h2>
        <p className="text-zinc-500 text-xs">
          This tracking link is invalid, expired, or the trip has concluded.
        </p>
      </div>
    );
  }

  const markers: MapMarker[] = [
    { id: 'pickup', lat: ride.pickupLat, lng: ride.pickupLng, type: 'pickup', title: ride.pickupAddress },
    { id: 'dropoff', lat: ride.dropoffLat, lng: ride.dropoffLng, type: 'dropoff', title: ride.dropoffAddress },
  ];

  if (driverLoc) {
    markers.push({
      id: 'driver',
      lat: driverLoc.lat,
      lng: driverLoc.lng,
      heading: driverLoc.heading,
      type: 'driver',
      title: 'Captain Vehicle',
    });
  }

  return (
    <div className="relative flex-1 flex flex-col w-full h-[calc(100vh-57px)] overflow-hidden">
      {/* Map */}
      <div className="absolute inset-0 z-0">
        <MapComponent
          center={[ride.pickupLat, ride.pickupLng]}
          markers={markers}
          routeCoordinates={ride.routePolyline ? JSON.parse(ride.routePolyline) : []}
        />
      </div>

      {/* Floating Info Card */}
      <div className="absolute bottom-6 inset-x-4 max-w-lg mx-auto z-10 bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
              LIVE SHARED TRIP
            </div>
            <div className="text-sm font-bold text-white mt-0.5">
              Status: {ride.status.replace(/_/g, ' ')}
            </div>
          </div>
          <div className="text-right text-xs">
            <span className="font-bold text-white">{ride.distanceKm} km</span>
            <div className="text-zinc-500 text-[10px]">Total distance</div>
          </div>
        </div>

        {/* Addresses */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate">{ride.pickupAddress}</span>
          </div>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="truncate">{ride.dropoffAddress}</span>
          </div>
        </div>

        {/* Vehicle */}
        {ride.driver && (
          <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-xs">
            <div className="text-zinc-400">
              Captain: <span className="font-semibold text-white">{ride.driver.user?.name}</span> •{' '}
              <span className="font-mono text-zinc-300 font-bold">{ride.driver.vehicle?.plateNo}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
