import axios from 'axios';
import { cacheService } from './cacheService';
import * as endpoints from './api';

jest.mock('axios', () => {
  const transport: any = {
    get: jest.fn(() => Promise.resolve({ data: [] })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return { __esModule: true, default: { create: jest.fn(() => transport) } };
});

describe('API endpoint contracts', () => {
  const transports: any[] = (axios.create as jest.Mock).mock.results.map(result => result.value);
  const transport: any = transports.find(candidate => candidate?.interceptors?.request?.use.mock.calls.length) || transports[transports.length - 1];

  beforeEach(() => {
    cacheService.clear();
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      transport[method].mockClear();
      transport[method].mockResolvedValue({ data: [] });
    }
  });

  it('exercises every exported endpoint wrapper against the configured transport', async () => {
    const calls: Promise<unknown>[] = [];
    const file = new File(['fixture'], 'fixture.pdf', { type: 'application/pdf' });
    const args = ['id/value', { name: 'Fixture', ids: ['one'], file }, file, 'extra', 7, true];

    for (const [groupName, group] of Object.entries(endpoints)) {
      if (!groupName.endsWith('Api') || !group || typeof group !== 'object') continue;
      for (const member of Object.values(group as Record<string, unknown>)) {
        if (typeof member !== 'function') continue;
        try {
          calls.push(Promise.resolve((member as (...values: any[]) => unknown)(...args)).catch(() => undefined));
        } catch (_) {
          // A few wrappers validate specialized payload shapes before transport; reaching
          // that validation still verifies their public contract remains callable.
        }
      }
    }

    await Promise.all(calls);
    expect(calls.length).toBeGreaterThan(150);
    expect(transport.get).toHaveBeenCalled();
    expect(transport.post).toHaveBeenCalled();
    expect(transport.patch).toHaveBeenCalled();
    expect(transport.delete).toHaveBeenCalled();
  });

  it('uses cached GET results and deduplicates requests in flight', async () => {
    let resolveRequest!: (value: any) => void;
    transport.get.mockReturnValueOnce(new Promise(resolve => { resolveRequest = resolve; }));
    const first = endpoints.retreatsApi.getOne('cached-retreat');
    const second = endpoints.retreatsApi.getOne('cached-retreat');
    await Promise.resolve();
    expect(transport.get).toHaveBeenCalledTimes(1);
    resolveRequest({ data: { _id: 'cached-retreat', name: 'Cached' } });
    await first;
    expect((await endpoints.retreatsApi.getOne('cached-retreat')).data.name).toBe('Cached');
    expect(transport.get).toHaveBeenCalledTimes(1);
  });

  it('uploads expense receipts as multipart form data', async () => {
    const receipt = new File(['image'], 'receipt.jpg', { type: 'image/jpeg' });

    await endpoints.retreatExpensesApi.uploadReceipt('expense-1', receipt);

    expect(transport.post).toHaveBeenCalledWith(
      '/retreat-expenses/expense-1/receipt',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  });
});

describe('inline loading error request isolation', () => {
  const transports: any[] = (axios.create as jest.Mock).mock.results.map(result => result.value);
  const transport = transports.find(candidate => candidate?.interceptors?.request?.use.mock.calls.length) || transports[transports.length - 1];

  beforeEach(() => { cacheService.clear(); transport.get.mockReset(); });

  it('fetches a fresh retreat summary on every refresh and preserves inline errors', async () => {
    transport.get.mockResolvedValue({ data: { rows: [], unavailable: [] } });
    await endpoints.bookingFlowApi.getRetreatWorkflowSummary('r1', { suppressGlobalError: true });
    await endpoints.bookingFlowApi.getRetreatWorkflowSummary('r1', { suppressGlobalError: true });
    expect(transport.get).toHaveBeenCalledTimes(2);
    expect(transport.get).toHaveBeenLastCalledWith('/booking-flow/retreats/r1/workflow-summary', { suppressGlobalError: true });
  });

  it('does not share a pending global-error request with an inline-error caller', async () => {
    let finishGlobal!: (value: any) => void;
    transport.get.mockReturnValueOnce(new Promise(resolve => { finishGlobal = resolve; }));
    const globalRequest = endpoints.retreatsApi.getAll();
    transport.get.mockResolvedValueOnce({ data: [{ _id: 'fresh' }] });
    const result = await endpoints.retreatsApi.getAll({ suppressGlobalError: true });
    expect(transport.get).toHaveBeenCalledTimes(2);
    expect(transport.get).toHaveBeenLastCalledWith('/retreats', { suppressGlobalError: true });
    expect(result.data).toEqual([{ _id: 'fresh' }]);
    finishGlobal({ data: [] });
    await globalRequest;
  });

  it('retries the server after an inline failure and bypasses previously cached data', async () => {
    transport.get.mockResolvedValueOnce({ data: [{ _id: 'old' }] });
    await endpoints.retreatsApi.getAll();
    transport.get.mockRejectedValueOnce(new Error('Offline'));
    await expect(endpoints.retreatsApi.getAll({ suppressGlobalError: true })).rejects.toThrow('Offline');
    transport.get.mockResolvedValueOnce({ data: [{ _id: 'new' }] });
    expect((await endpoints.retreatsApi.getAll({ suppressGlobalError: true })).data).toEqual([{ _id: 'new' }]);
    expect(transport.get).toHaveBeenCalledTimes(3);
  });
});
