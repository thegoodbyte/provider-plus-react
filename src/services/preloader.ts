// Preloader service to eagerly fetch commonly used data
import { clientsApi, retreatsApi, housesApi, bookingsApi } from './api';

class PreloaderService {
  private isPreloading = false;
  private preloadPromise: Promise<void> | null = null;

  // Preload essential data that's used across multiple pages
  async preloadEssentialData(): Promise<void> {
    if (this.isPreloading || this.preloadPromise) {
      return this.preloadPromise || Promise.resolve();
    }

    this.isPreloading = true;
    console.log('🚀 Preloading essential data...');

    this.preloadPromise = this.performPreload();
    return this.preloadPromise;
  }

  private async performPreload(): Promise<void> {
    try {
      const startTime = performance.now();

      // Only load the most essential data to avoid blocking
      // Reduce API calls and prioritize most commonly used data
      await Promise.allSettled([
        clientsApi.getAll(),          // Most important - used everywhere
        retreatsApi.getAll(),         // Second most important
        // Remove less critical preloading to speed up initial load
        // housesApi.getAll(),        // Load on-demand instead
        // bookingsApi.getAll(),      // Load on-demand instead
        // clientsApi.getPotential(), // Redundant with getAll()
        // clientsApi.getActive(),    // Redundant with getAll()
      ]);

      const endTime = performance.now();
      console.log(`✅ Preload completed in ${Math.round(endTime - startTime)}ms`);

      // Load secondary data after a delay to not block initial UI
      setTimeout(() => {
        Promise.allSettled([
          housesApi.getAll(),
          bookingsApi.getAll(),
        ]).catch(console.error);
      }, 100);

    } catch (error) {
      console.error('❌ Preload failed:', error);
    } finally {
      this.isPreloading = false;
    }
  }

  // Check if data is already cached
  isDataCached(): boolean {
    // This is a simple check - in a real app you might want more sophisticated cache checking
    const cache = (window as any).__API_CACHE__;
    return cache && Object.keys(cache).length > 0;
  }

  // Clear all cached data (useful for logout or forced refresh)
  clearCache(): void {
    const { cacheService } = require('./cacheService');
    cacheService.clear();
  }
}

export const preloaderService = new PreloaderService();