import { renderHook, waitFor } from '@testing-library/react';
import { useClientProfilePictureUrl } from './useClientProfilePictureUrl';
import { clientsApi } from '../services/api';

jest.mock('../services/api', () => ({ clientsApi: { getProfilePictureBlob: jest.fn() } }));
const load = clientsApi.getProfilePictureBlob as jest.Mock;

describe('useClientProfilePictureUrl', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:avatar');
    URL.revokeObjectURL = jest.fn();
  });
  afterAll(() => {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('returns null and never fetches when the client has no picture at all', () => {
    const { result } = renderHook(() => useClientProfilePictureUrl({ _id: 'c' } as any));
    expect(result.current).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it('uses a genuinely public (absolute) profile URL directly, without fetching', () => {
    const { result } = renderHook(() => useClientProfilePictureUrl({ _id: 'c', profilePictureUrl: 'https://cdn.example.com/avatar.jpg' } as any));
    expect(result.current).toBe('https://cdn.example.com/avatar.jpg');
    expect(load).not.toHaveBeenCalled();
  });

  it('fetches an authenticated blob when profilePictureUrl is the internal app route (the PPVC-609 bug)', async () => {
    load.mockResolvedValue({ data: new Blob(['photo']) });
    const { result } = renderHook(() => useClientProfilePictureUrl({ _id: 'c', profilePictureUrl: '/clients/c/profile-picture' } as any));

    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe('blob:avatar'));
    expect(load).toHaveBeenCalledWith('c');
  });

  it('fetches an authenticated blob when only the S3 key / file upload id is known', async () => {
    load.mockResolvedValue({ data: new Blob(['photo']) });
    const { result } = renderHook(() => useClientProfilePictureUrl({ _id: 'c', profilePictureS3Key: 'key' } as any));

    await waitFor(() => expect(result.current).toBe('blob:avatar'));
    expect(load).toHaveBeenCalledWith('c');
  });

  it('falls back to null when the protected fetch fails', async () => {
    load.mockRejectedValue(new Error('missing'));
    const { result } = renderHook(() => useClientProfilePictureUrl({ _id: 'c', profilePictureFileUploadId: 'upload' } as any));

    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('revokes the object URL on unmount', async () => {
    load.mockResolvedValue({ data: new Blob(['photo']) });
    const { result, unmount } = renderHook(() => useClientProfilePictureUrl({ _id: 'c', profilePictureS3Key: 'key' } as any));
    await waitFor(() => expect(result.current).toBe('blob:avatar'));

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar');
  });

  it('ignores a protected response that resolves after the client changed', async () => {
    let resolve: (value: any) => void = () => undefined;
    load.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { rerender } = renderHook(({ client }) => useClientProfilePictureUrl(client), {
      initialProps: { client: { _id: 'c', profilePictureS3Key: 'key' } as any },
    });

    rerender({ client: { _id: 'd' } as any });
    resolve({ data: new Blob(['photo']) });
    await Promise.resolve();

    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
