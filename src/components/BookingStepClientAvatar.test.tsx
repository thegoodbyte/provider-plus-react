import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import BookingStepClientAvatar from './BookingStepClientAvatar';
import { clientsApi } from '../services/api';

jest.mock('../services/api', () => ({ clientsApi: { getProfilePictureBlob: jest.fn() } }));
const load = clientsApi.getProfilePictureBlob as jest.Mock;

describe('BookingStepClientAvatar', () => {
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

  it('shows an uppercase initial without requesting an absent picture', () => {
    render(<BookingStepClientAvatar client={{ _id: 'c' } as any} name="ada" />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(load).not.toHaveBeenCalled();
  });

  it('uses an existing public profile URL directly', () => {
    const { container } = render(<BookingStepClientAvatar client={{ _id: 'c', profilePictureUrl: 'https://cdn/avatar.jpg' } as any} name="Ada" />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn/avatar.jpg');
    expect(load).not.toHaveBeenCalled();
  });

  it('loads a protected profile picture and revokes its object URL', async () => {
    load.mockResolvedValue({ data: new Blob(['photo']) });
    const { container, unmount } = render(<BookingStepClientAvatar client={{ _id: 'c', profilePictureS3Key: 'key' } as any} name="Ada" />);
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'blob:avatar'));
    expect(load).toHaveBeenCalledWith('c');
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:avatar');
  });

  it('keeps the initial when protected image loading fails', async () => {
    load.mockRejectedValue(new Error('missing'));
    render(<BookingStepClientAvatar client={{ _id: 'c', profilePictureFileUploadId: 'upload' } as any} name="Ada" />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('ignores a protected image response after unmount', async () => {
    let resolve: (value: any) => void = () => undefined;
    load.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { unmount } = render(<BookingStepClientAvatar client={{ _id: 'c', profilePictureS3Key: 'key' } as any} name="Ada" />);
    unmount();
    await act(async () => resolve({ data: new Blob(['photo']) }));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('resets when client changes to one without a picture', async () => {
    const { rerender } = render(<BookingStepClientAvatar client={{ _id: 'c', profilePictureUrl: 'https://cdn/avatar.jpg' } as any} name="Ada" />);
    rerender(<BookingStepClientAvatar client={{ _id: 'd' } as any} name="Bob" />);
    expect(await screen.findByText('B')).toBeInTheDocument();
  });
});
