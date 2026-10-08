'use client';

import React, { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type?: 'pickup' | 'dropoff' | 'driver' | 'stop';
  heading?: number;
  title?: string;
  icon?: string;
}

export interface MapComponentProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routeCoordinates?: [number, number][];
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  center = [12.9716, 77.5946],
  zoom = 13,
  markers = [],
  routeCoordinates = [],
  onMapClick,
  className = 'h-full w-full',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const polylineRef = useRef<Polyline | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let isMounted = true;

    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: false,
      });

      // Add dark tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      // Zoom control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      map.on('click', (e) => {
        onMapClick?.(e.latlng.lat, e.latlng.lng);
      });

      mapInstanceRef.current = map;
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    import('leaflet').then((L) => {
      // Remove stale markers
      const currentIds = new Set(markers.map((m) => m.id));
      markersRef.current.forEach((marker, id) => {
        if (!currentIds.has(id)) {
          marker.remove();
          markersRef.current.delete(id);
        }
      });

      // Add or update markers
      markers.forEach((m) => {
        const existing = markersRef.current.get(m.id);

        let iconHtml = '';
        if (m.type === 'driver') {
          iconHtml = `
            <div style="transform: rotate(${m.heading || 0}deg); transition: transform 0.5s ease-out;" class="flex items-center justify-center w-8 h-8 rounded-full bg-black border-2 border-emerald-400 shadow-lg text-white">
              🚗
            </div>
          `;
        } else if (m.type === 'pickup') {
          iconHtml = `
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-xl text-white font-bold text-xs">
              📍
            </div>
          `;
        } else if (m.type === 'dropoff') {
          iconHtml = `
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 border-2 border-white shadow-xl text-white font-bold text-xs">
              🏁
            </div>
          `;
        } else {
          iconHtml = `
            <div class="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 border-2 border-white shadow-lg text-xs">
              ●
            </div>
          `;
        }

        const icon = L.divIcon({
          html: iconHtml,
          className: 'custom-div-icon',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        if (existing) {
          existing.setLatLng([m.lat, m.lng]);
          existing.setIcon(icon);
        } else {
          const newMarker = L.marker([m.lat, m.lng], { icon }).addTo(map);
          if (m.title) {
            newMarker.bindPopup(`<div class="font-bold text-xs">${m.title}</div>`);
          }
          markersRef.current.set(m.id, newMarker);
        }
      });
    });
  }, [markers]);

  // Update route polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    import('leaflet').then((L) => {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      if (routeCoordinates && routeCoordinates.length > 1) {
        const latLngs = routeCoordinates.map(([lat, lng]) => L.latLng(lat, lng));
        const polyline = L.polyline(latLngs, {
          color: '#10b981', // emerald
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        polylineRef.current = polyline;

        // Auto zoom/fit bounds
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      }
    });
  }, [routeCoordinates]);

  return <div ref={mapContainerRef} className={className} />;
};
