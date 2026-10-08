import { LatLng, PlaceSuggestion, RouteDetails } from '../types/index.js';

export interface IMapProvider {
  autocomplete(query: string, city?: string): Promise<PlaceSuggestion[]>;
  reverseGeocode(lat: number, lng: number): Promise<string>;
  getRoute(points: LatLng[]): Promise<RouteDetails>;
}
