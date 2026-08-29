const mockClientsGetAll = jest.fn();
const mockRetreatsGetAll = jest.fn();
const mockHousesGetAll = jest.fn();
const mockBookingsGetAll = jest.fn();
const mockClear = jest.fn();

jest.mock('./api', () => ({
  clientsApi: { getAll: mockClientsGetAll }, retreatsApi: { getAll: mockRetreatsGetAll },
  housesApi: { getAll: mockHousesGetAll }, bookingsApi: { getAll: mockBookingsGetAll },
}));
jest.mock('./cacheService', () => ({ cacheService: { clear: mockClear } }));

describe('preloaderService', () => {
  beforeEach(() => {
    jest.resetModules(); jest.clearAllMocks(); jest.useFakeTimers();
    mockClientsGetAll.mockResolvedValue([]); mockRetreatsGetAll.mockResolvedValue([]);
    mockHousesGetAll.mockResolvedValue([]); mockBookingsGetAll.mockResolvedValue([]);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); delete (window as any).__API_CACHE__; });

  it('preloads primary data once and schedules secondary data', async () => {
    const { preloaderService } = require('./preloader');
    const first = preloaderService.preloadEssentialData();
    const second = preloaderService.preloadEssentialData();
    await Promise.all([first, second]);
    expect(mockClientsGetAll).toHaveBeenCalledTimes(1);
    expect(mockRetreatsGetAll).toHaveBeenCalledTimes(1);
    expect(mockHousesGetAll).not.toHaveBeenCalled();
    jest.runAllTimers();
    await Promise.resolve();
    expect(mockHousesGetAll).toHaveBeenCalledTimes(1);
    expect(mockBookingsGetAll).toHaveBeenCalledTimes(1);
    await preloaderService.preloadEssentialData();
    expect(mockClientsGetAll).toHaveBeenCalledTimes(1);
  });

  it('tolerates rejected preload calls through allSettled', async () => {
    mockClientsGetAll.mockRejectedValue(new Error('offline'));
    mockHousesGetAll.mockRejectedValue(new Error('secondary offline'));
    const { preloaderService } = require('./preloader');
    await expect(preloaderService.preloadEssentialData()).resolves.toBeUndefined();
    jest.runAllTimers();
    await Promise.resolve();
    expect(mockRetreatsGetAll).toHaveBeenCalled();
    expect(mockBookingsGetAll).toHaveBeenCalled();
  });

  it('detects window cache content and clears the shared cache', () => {
    const { preloaderService } = require('./preloader');
    expect(preloaderService.isDataCached()).toBeFalsy();
    (window as any).__API_CACHE__ = {};
    expect(preloaderService.isDataCached()).toBe(false);
    (window as any).__API_CACHE__ = { clients: [] };
    expect(preloaderService.isDataCached()).toBe(true);
    preloaderService.clearCache();
    expect(mockClear).toHaveBeenCalled();
  });
});
