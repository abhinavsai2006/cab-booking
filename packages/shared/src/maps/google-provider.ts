import { IMapProvider } from './types.js';
import { LatLng, PlaceSuggestion, RouteDetails } from '../types/index.js';
import { OsmMapProvider } from './osm-provider.js';

export class GoogleMapProvider implements IMapProvider {
  private apiKey: string;
  private fallbackOsm: OsmMapProvider;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.fallbackOsm = new OsmMapProvider();
  }

  async autocomplete(query: string, city: string = 'Bangalore'): Promise<PlaceSuggestion[]> {
    if (!this.apiKey) {
      return this.fallbackOsm.autocomplete(query, city);
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        `${query}, ${city}`
      )}&key=${this.apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as {
          predictions?: Array<{
            place_id: string;
            structured_formatting?: { main_text: string; secondary_text: string };
            description: string;
          }>;
        };
        if (data.predictions && data.predictions.length > 0) {
          // Resolve top 3 details
          const results: PlaceSuggestion[] = [];
          for (const p of data.predictions.slice(0, 5)) {
            const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.place_id}&fields=geometry&key=${this.apiKey}`;
            const detailRes = await fetch(detailUrl);
            if (detailRes.ok) {
              const detailData = (await detailRes.json()) as {
                result?: { geometry?: { location?: { lat: number; lng: number } } };
              };
              const loc = detailData.result?.geometry?.location;
              if (loc) {
                results.push({
                  id: p.place_id,
                  title: p.structured_formatting?.main_text || p.description,
                  subtitle: p.structured_formatting?.secondary_text || city,
                  lat: loc.lat,
                  lng: loc.lng,
                });
              }
            }
          }
          if (results.length > 0) return results;
        }
      }
    } catch {
      // Fallback
    }
    return this.fallbackOsm.autocomplete(query, city);
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    if (!this.apiKey) {
      return this.fallbackOsm.reverseGeocode(lat, lng);
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as { results?: Array<{ formatted_address: string }> };
        if (data.results?.[0]?.formatted_address) {
          return data.results[0].formatted_address;
        }
      }
    } catch {
      // Fallback
    }
    return this.fallbackOsm.reverseGeocode(lat, lng);
  }

  async getRoute(points: LatLng[]): Promise<RouteDetails> {
    if (!this.apiKey) {
      return this.fallbackOsm.getRoute(points);
    }
    try {
      const origin = `${points[0].lat},${points[0].lng}`;
      const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${this.apiKey}`;
      if (points.length > 2) {
        const waypoints = points.slice(1, -1).map((p) => `${p.lat},${p.lng}`).join('|');
        url += `&waypoints=${waypoints}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as {
          routes?: Array<{
            overview_polyline: { points: string };
            legs: Array<{ distance: { value: number }; duration: { value: number } }>;
          }>;
        };
        const route = data.routes?.[0];
        if (route) {
          const totalDistMeters = route.legs.reduce((acc, leg) => acc + leg.distance.value, 0);
          const totalSecs = route.legs.reduce((acc, leg) => acc + leg.duration.value, 0);
          return {
            distanceKm: Math.round((totalDistMeters / 1000) * 10) / 10,
            durationMin: Math.max(1, Math.round(totalSecs / 60)),
            polyline: route.overview_polyline.points,
            coordinates: points.map((p) => [p.lat, p.lng]),
          };
        }
      }
    } catch {
      // Fallback
    }
    return this.fallbackOsm.getRoute(points);
  }
}
