import Redis from 'ioredis';
import { haversineDistanceKm } from '@cab-app/shared';

export interface GeoLocation {
  member: string;
  latitude: number;
  longitude: number;
}

export interface GeoRadiusResult {
  member: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
}

class InMemoryGeoStore {
  private geoData: Map<string, Map<string, { lat: number; lng: number }>> = new Map();
  private kvStore: Map<string, { value: string; expiry?: number }> = new Map();

  geoAdd(key: string, longitude: number, latitude: number, member: string): void {
    if (!this.geoData.has(key)) {
      this.geoData.set(key, new Map());
    }
    this.geoData.get(key)!.set(member, { lat: latitude, lng: longitude });
  }

  geoRemove(key: string, member: string): void {
    if (this.geoData.has(key)) {
      this.geoData.get(key)!.delete(member);
    }
  }

  geoRadius(
    key: string,
    longitude: number,
    latitude: number,
    radiusKm: number
  ): GeoRadiusResult[] {
    const set = this.geoData.get(key);
    if (!set) return [];

    const results: GeoRadiusResult[] = [];
    for (const [member, loc] of set.entries()) {
      const dist = haversineDistanceKm(latitude, longitude, loc.lat, loc.lng);
      if (dist <= radiusKm) {
        results.push({
          member,
          distanceKm: dist,
          latitude: loc.lat,
          longitude: loc.lng,
        });
      }
    }

    return results.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  set(key: string, value: string, ttlSeconds?: number): void {
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.kvStore.set(key, { value, expiry });
  }

  get(key: string): string | null {
    const item = this.kvStore.get(key);
    if (!item) return null;
    if (item.expiry && Date.now() > item.expiry) {
      this.kvStore.delete(key);
      return null;
    }
    return item.value;
  }

  del(key: string): void {
    this.kvStore.delete(key);
  }
}

export class ResilientRedisService {
  private client: Redis | null = null;
  private memoryStore: InMemoryGeoStore = new InMemoryGeoStore();
  private isConnected: boolean = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times > 3) return null; // stop retrying and use in-memory store
          return Math.min(times * 100, 1000);
        },
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });

      this.client
        .connect()
        .then(() => {
          this.isConnected = true;
          console.log('[Redis] Connected successfully to external Redis instance');
        })
        .catch(() => {
          this.isConnected = false;
          console.log('[Redis] External Redis unavailable. Using built-in in-memory GEO and cache engine.');
        });

      this.client.on('error', () => {
        this.isConnected = false;
      });
    } catch {
      this.isConnected = false;
    }
  }

  async geoAdd(key: string, lng: number, lat: number, member: string): Promise<void> {
    this.memoryStore.geoAdd(key, lng, lat, member);
    if (this.isConnected && this.client) {
      try {
        await this.client.geoadd(key, lng, lat, member);
      } catch {
        // fallback active
      }
    }
  }

  async geoRemove(key: string, member: string): Promise<void> {
    this.memoryStore.geoRemove(key, member);
    if (this.isConnected && this.client) {
      try {
        await this.client.zrem(key, member);
      } catch {
        // fallback active
      }
    }
  }

  async geoRadius(
    key: string,
    lng: number,
    lat: number,
    radiusKm: number
  ): Promise<GeoRadiusResult[]> {
    if (this.isConnected && this.client) {
      try {
        // redis georadius command returns [member, distance, [lng, lat]]
        const raw = (await this.client.georadius(
          key,
          lng,
          lat,
          radiusKm,
          'km',
          'WITHDIST',
          'WITHCOORD',
          'ASC'
        )) as Array<[string, string, [string, string]]>;

        if (Array.isArray(raw)) {
          return raw.map(([member, dist, coords]) => ({
            member,
            distanceKm: parseFloat(dist),
            longitude: parseFloat(coords[0]),
            latitude: parseFloat(coords[1]),
          }));
        }
      } catch {
        // fallback to memoryStore
      }
    }

    return this.memoryStore.geoRadius(key, lng, lat, radiusKm);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.memoryStore.set(key, value, ttlSeconds);
    if (this.isConnected && this.client) {
      try {
        if (ttlSeconds) {
          await this.client.setex(key, ttlSeconds, value);
        } else {
          await this.client.set(key, value);
        }
      } catch {
        // fallback
      }
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        const val = await this.client.get(key);
        if (val !== null) return val;
      } catch {
        // fallback
      }
    }
    return this.memoryStore.get(key);
  }

  async del(key: string): Promise<void> {
    this.memoryStore.del(key);
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
      } catch {
        // fallback
      }
    }
  }
}

export const redis = new ResilientRedisService();
