import { IMapProvider } from './types.js';
import { OsmMapProvider } from './osm-provider.js';
import { GoogleMapProvider } from './google-provider.js';

export * from './types.js';
export * from './osm-provider.js';
export * from './google-provider.js';

let defaultProviderInstance: IMapProvider | null = null;

export function getMapProvider(
  type: 'osm' | 'google' = (process.env.MAP_PROVIDER as 'osm' | 'google') || 'osm',
  apiKey: string = process.env.GOOGLE_MAPS_API_KEY || ''
): IMapProvider {
  if (defaultProviderInstance) return defaultProviderInstance;

  if (type === 'google' && apiKey) {
    defaultProviderInstance = new GoogleMapProvider(apiKey);
  } else {
    defaultProviderInstance = new OsmMapProvider();
  }
  return defaultProviderInstance;
}
