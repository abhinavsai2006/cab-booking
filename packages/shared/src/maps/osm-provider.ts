import { IMapProvider } from './types.js';
import { LatLng, PlaceSuggestion, RouteDetails } from '../types/index.js';

// Pre-seeded well-known landmark locations in Bangalore / Metro hubs for instantaneous responses & offline resiliency
const LOCAL_PRESETS: PlaceSuggestion[] = [
  { id: 'blr-1', title: 'MG Road Metro Station', subtitle: 'Mahatma Gandhi Rd, Bengaluru', lat: 12.9756, lng: 77.6066 },
  { id: 'blr-2', title: 'Indiranagar 100ft Road', subtitle: 'Indiranagar, Bengaluru', lat: 12.9784, lng: 77.6408 },
  { id: 'blr-3', title: 'Koramangala Sony World Signal', subtitle: '80 Feet Rd, Koramangala 4th Block, Bengaluru', lat: 12.9352, lng: 77.6245 },
  { id: 'blr-4', title: 'Kempegowda International Airport (BLR)', subtitle: 'Devanahalli, Bengaluru', lat: 13.1986, lng: 77.7066 },
  { id: 'blr-5', title: 'Whitefield ITPL', subtitle: 'International Tech Park, Whitefield, Bengaluru', lat: 12.9863, lng: 77.7338 },
  { id: 'blr-6', title: 'Electronic City Phase 1', subtitle: 'Hosur Rd, Electronic City, Bengaluru', lat: 12.8452, lng: 77.6602 },
  { id: 'blr-7', title: 'HSR Layout Sector 1', subtitle: 'HSR Layout, Bengaluru', lat: 12.9121, lng: 77.6446 },
  { id: 'blr-8', title: 'Cubbon Park Entrance', subtitle: 'Kasturba Rd, Sampangi Rama Nagara, Bengaluru', lat: 12.9763, lng: 77.5929 },
  { id: 'blr-9', title: 'Bangalore City Railway Station', subtitle: 'Majestic, Bengaluru', lat: 12.9781, lng: 77.5695 },
  { id: 'blr-10', title: 'UB City Mall', subtitle: 'Vittal Mallya Rd, KG Halli, D Souza Layout, Bengaluru', lat: 12.9719, lng: 77.5958 },
];

export class OsmMapProvider implements IMapProvider {
  async autocomplete(query: string, city: string = 'Bangalore'): Promise<PlaceSuggestion[]> {
    const qLower = query.toLowerCase().trim();
    // Check local presets first for instant response
    const localMatches = LOCAL_PRESETS.filter(
      (p) => p.title.toLowerCase().includes(qLower) || p.subtitle.toLowerCase().includes(qLower)
    );

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        `${query}, ${city}`
      )}&format=json&addressdetails=1&limit=6`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CabBookingApp/1.0 (contact@cabapp.local)' },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = (await res.json()) as Array<{
          place_id: number;
          display_name: string;
          lat: string;
          lon: string;
          name?: string;
        }>;

        if (Array.isArray(data) && data.length > 0) {
          const remoteResults: PlaceSuggestion[] = data.map((item) => {
            const parts = item.display_name.split(',');
            const title = item.name || parts[0]?.trim() || query;
            const subtitle = parts.slice(1, 4).join(',').trim() || city;
            return {
              id: String(item.place_id),
              title,
              subtitle,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            };
          });
          return remoteResults;
        }
      }
    } catch {
      // Fallback seamlessly to local matches
    }

    if (localMatches.length > 0) {
      return localMatches;
    }

    // Dynamic fallback with slight offset around city center for any arbitrary query
    return [
      {
        id: `mock-${Date.now()}-1`,
        title: query,
        subtitle: `${city}, Karnataka, India`,
        lat: 12.9716 + (Math.random() - 0.5) * 0.05,
        lng: 77.5946 + (Math.random() - 0.5) * 0.05,
      },
    ];
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'CabBookingApp/1.0 (contact@cabapp.local)' },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const data = (await res.json()) as { display_name?: string };
        if (data.display_name) {
          return data.display_name;
        }
      }
    } catch {
      // Fallback
    }

    return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  }

  async getRoute(points: LatLng[]): Promise<RouteDetails> {
    if (points.length < 2) {
      throw new Error('Routing requires at least 2 points');
    }

    try {
      // OSRM format: lng,lat;lng,lat
      const coordString = points.map((p) => `${p.lng},${p.lat}`).join(';');
      const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(4000),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          routes?: Array<{
            distance: number;
            duration: number;
            geometry: { coordinates: [number, number][] };
            legs?: Array<{
              steps?: Array<{
                maneuver?: { instruction?: string };
                distance: number;
                duration: number;
              }>;
            }>;
          }>;
        };

        const route = data.routes?.[0];
        if (route && route.geometry?.coordinates) {
          // OSRM coordinates are [lng, lat] -> convert to [lat, lng]
          const latLngCoords: [number, number][] = route.geometry.coordinates.map(
            ([lng, lat]) => [lat, lng]
          );

          const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
          const durationMin = Math.max(1, Math.round(route.duration / 60));

          return {
            distanceKm,
            durationMin,
            polyline: JSON.stringify(latLngCoords),
            coordinates: latLngCoords,
            steps: route.legs?.flatMap((leg) =>
              (leg.steps || []).map((s) => ({
                instruction: s.maneuver?.instruction || 'Drive ahead',
                distanceMeters: s.distance,
                durationSeconds: s.duration,
              }))
            ),
          };
        }
      }
    } catch {
      // Fallback to haversine interpolation
    }

    // Direct interpolation fallback (e.g. offline)
    return this.generateInterpolatedRoute(points);
  }

  private generateInterpolatedRoute(points: LatLng[]): RouteDetails {
    const coords: [number, number][] = [];
    let totalDistKm = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dist = haversineDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);
      totalDistKm += dist;

      // generate intermediate steps for smooth rendering
      const stepsCount = Math.max(5, Math.min(50, Math.round(dist * 5)));
      for (let s = 0; s <= stepsCount; s++) {
        const t = s / stepsCount;
        const lat = p1.lat + (p2.lat - p1.lat) * t;
        const lng = p1.lng + (p2.lng - p1.lng) * t;
        coords.push([lat, lng]);
      }
    }

    const durationMin = Math.max(3, Math.round((totalDistKm / 25) * 60)); // assume 25 km/h city avg

    return {
      distanceKm: Math.round(totalDistKm * 10) / 10,
      durationMin,
      polyline: JSON.stringify(coords),
      coordinates: coords,
      steps: [
        { instruction: 'Start from pickup location', distanceMeters: 100, durationSeconds: 30 },
        { instruction: 'Continue along the main road', distanceMeters: Math.round(totalDistKm * 1000), durationSeconds: durationMin * 60 },
        { instruction: 'Arrive at destination', distanceMeters: 50, durationSeconds: 15 },
      ],
    };
  }
}

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
