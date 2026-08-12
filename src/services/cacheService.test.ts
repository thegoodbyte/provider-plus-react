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

  it('expires stale entries and preserves fresh entries', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    cacheService.set('short', 'value', 10);
    expect(cacheService.get('short')).toBe('value');
    jest.spyOn(Date, 'now').mockReturnValue(1011);
    expect(cacheService.get('short')).toBeNull();
    jest.restoreAllMocks();
  });

  it('removes a rejected pending request so a retry can start', async () => {
    const request = Promise.reject(new Error('network'));
    cacheService.setPending('requirements', request);
    await expect(request).rejects.toThrow('network');
    await Promise.resolve();
    expect(cacheService.getPending('requirements')).toBeUndefined();
  });

  it('does not let an older request clear a newer pending request', async () => {
    let finishOld: () => void = () => undefined;
    const oldRequest = new Promise<void>((resolve) => { finishOld = resolve; });
    const newerRequest = new Promise<void>(() => undefined);
    cacheService.setPending('requirements', oldRequest);
    cacheService.setPending('requirements', newerRequest);
    finishOld();
    await oldRequest;
    await Promise.resolve();
    expect(cacheService.getPending('requirements')).toBe(newerRequest);
  });

  it('deletes one cached and pending key and clears all state', () => {
    const never = new Promise<void>(() => undefined);
    cacheService.set('one', 1);
    cacheService.setPending('one', never);
    cacheService.delete('one');
    expect(cacheService.get('one')).toBeNull();
    expect(cacheService.getPending('one')).toBeUndefined();
    cacheService.set('two', 2);
    cacheService.setPending('two', never);
    cacheService.clear();
    expect(cacheService.get('two')).toBeNull();
    expect(cacheService.getPending('two')).toBeUndefined();
  });
});
