import { cacheService } from './cacheService';

describe('cacheService pending requests', () => {
  beforeEach(() => cacheService.clear());

  it('stores and returns one pending request by key', async () => {
    const request = Promise.resolve('result');
    cacheService.setPending('booking:1', request);
    expect(cacheService.getPending('booking:1')).toBe(request);
    await request;
    await Promise.resolve();
    expect(cacheService.getPending('booking:1')).toBeUndefined();
  });

  it('clears cached and pending entries by domain pattern', () => {
    cacheService.set('booking-flow:booking-requirements:1', { value: 1 });
    cacheService.set('unrelated:1', { value: 2 });
    cacheService.setPending('booking-flow:booking-requirements:1', new Promise(() => undefined));
    cacheService.clearPattern('booking-flow:booking-requirements:');
    expect(cacheService.get('booking-flow:booking-requirements:1')).toBeNull();
    expect(cacheService.getPending('booking-flow:booking-requirements:1')).toBeUndefined();
    expect(cacheService.get('unrelated:1')).toEqual({ value: 2 });
  });
});
