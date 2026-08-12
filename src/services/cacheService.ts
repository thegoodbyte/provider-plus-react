// Simple in-memory cache service for API responses
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pending: Map<string, Promise<any>> = new Map();
  private defaultTTL = 30000; // 30 seconds default TTL

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() > entry.timestamp) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.pending.delete(key);
  }

  // Clear all entries matching a pattern
  clearPattern(pattern: string): void {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    });
    Array.from(this.pending.keys()).forEach(key => {
      if (key.includes(pattern)) this.pending.delete(key);
    });
  }

  getPending<T>(key: string): Promise<T> | undefined {
    return this.pending.get(key);
  }

  setPending<T>(key: string, request: Promise<T>): Promise<T> {
    this.pending.set(key, request);
    request.finally(() => {
      if (this.pending.get(key) === request) this.pending.delete(key);
    }).catch(() => undefined);
    return request;
  }
}

export const cacheService = new CacheService();
