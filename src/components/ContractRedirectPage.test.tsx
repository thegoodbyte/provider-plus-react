import React from 'react';
import { render, waitFor } from '@testing-library/react';
import ContractRedirectPage from './ContractRedirectPage';
import { jotformApi } from '../services/api';

jest.mock('../services/api', () => ({
  jotformApi: {
    resolveContractLink: jest.fn(),
  },
}));

jest.mock('react-router-dom', () => ({
  useParams: () => ({ bookingId: 'booking-1' }),
}), { virtual: true });

describe('ContractRedirectPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the booking contract link and redirects to the short form URL target', async () => {
    (jotformApi.resolveContractLink as jest.Mock).mockResolvedValue({
      data: {
        redirectUrl: 'https://form.jotform.com/thegoodbyte/iscz-contract?pp_booking_id=booking-1',
      },
    });
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { replace: jest.fn() };

    render(<ContractRedirectPage />);

    await waitFor(() => {
      expect(jotformApi.resolveContractLink).toHaveBeenCalledWith('booking-1');
      expect((window.location.replace as jest.Mock)).toHaveBeenCalledWith('https://form.jotform.com/thegoodbyte/iscz-contract?pp_booking_id=booking-1');
    });

    (window as any).location = originalLocation;
  });
});
