import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import ClientAvatar from './ClientAvatar';
import { clientsApi } from '../services/api';

jest.mock('../services/api', () => ({ clientsApi: { getProfilePictureBlob: jest.fn() } }));
const load = clientsApi.getProfilePictureBlob as jest.Mock;

describe('ClientAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:avatar');
    URL.revokeObjectURL = jest.fn();
  });

  it('shows an initial when there is no picture', () => {
    render(<ClientAvatar client={{ _id: 'c' }} name="Ada Lovelace" />);
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('fetches and displays an authenticated picture for a client with one', async () => {
    load.mockResolvedValue({ data: new Blob(['photo']) });
    const { container } = render(<ClientAvatar client={{ _id: 'c', profilePictureS3Key: 'key' }} name="Ada" />);
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', 'blob:avatar'));
  });

  it('applies the larger size class when requested', () => {
    const { container } = render(<ClientAvatar client={{ _id: 'c' }} name="Ada" size="md" />);
    expect(container.querySelector('span')).toHaveClass('h-10', 'w-10');
  });
});
