import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RetreatReferralsHolisticView, { computeInitialBookingAttribution } from './RetreatReferralsHolisticView';
import { bookingsApi } from '../services/api';
import { Referral, Retreat, RetreatClient } from '../types';

jest.mock('../services/api', () => ({
  bookingsApi: {
    batchUpdateReferralAttribution: jest.fn().mockResolvedValue({ data: { updatedCount: 1 } }),
  },
}));

describe('computeInitialBookingAttribution helper', () => {
  const partnerId = '507f1f77bcf86cd799439011';

  it('preserves existing explicit attribution from DB', () => {
    const booking = {
      _id: 'b1',
      referralAttribution: 'direct',
      referralPartnerId: partnerId,
    } as any;
    expect(computeInitialBookingAttribution(booking, [booking])).toEqual({
      partnerId,
      attribution: 'direct',
    });
  });

  it('defaults boosters to SELF', () => {
    const booking = {
      _id: 'b1',
      bookingType: 'booster',
    } as any;
    expect(computeInitialBookingAttribution(booking, [booking])).toEqual({
      partnerId: null,
      attribution: 'self',
    });
  });

  it('defaults first booking to client referral and attribution type', () => {
    const booking = {
      _id: 'b1',
      clientId: {
        _id: 'c1',
        referralId: partnerId,
        referralAttributionType: 'self_identified',
      },
      createdAt: '2026-01-01',
    } as any;
    expect(computeInitialBookingAttribution(booking, [booking])).toEqual({
      partnerId,
      attribution: 'self_identified',
    });
  });

  it('defaults second / repeat bookings by client to SELF', () => {
    const first = {
      _id: 'b1',
      clientId: { _id: 'c1', referralId: partnerId },
      registrationDate: '2026-01-01',
    } as any;
    const second = {
      _id: 'b2',
      clientId: { _id: 'c1', referralId: partnerId },
      registrationDate: '2026-02-01',
    } as any;
    expect(computeInitialBookingAttribution(second, [first, second])).toEqual({
      partnerId: null,
      attribution: 'self',
    });
  });
});

describe('RetreatReferralsHolisticView component', () => {
  const mockReferrals: Referral[] = [
    { _id: 'ref1', name: 'Alchemia Dobrostanu', referralCode: 'AD', isActive: true } as any,
    { _id: 'ref2', name: 'Partner Two', referralCode: 'P2', isActive: true } as any,
  ];

  const mockRetreats: Retreat[] = [
    {
      _id: 'ret1',
      name: 'Autumn Iboga Retreat',
      code: 'AIR-2026',
      startDate: '2026-11-13',
      endDate: '2026-11-15',
      location: 'Jablonné nad Orlicí',
    } as any,
  ];

  const mockBookings: RetreatClient[] = [
    {
      _id: 'b1',
      retreatId: 'ret1',
      bookingNumber: 1182,
      totalAmount: 1500,
      currency: 'EUR',
      clientId: {
        _id: 'c1',
        firstName: 'Anna',
        lastName: 'Nowak',
        display_id: 101,
        referralId: 'ref1',
        referralAttributionType: 'direct',
      } as any,
    } as any,
  ];

  const defaultProps = {
    retreats: mockRetreats,
    bookings: mockBookings,
    referrals: mockReferrals,
    onSaveSuccess: jest.fn(),
    routePrefix: 'admin',
    getId: (v: any) => v?._id || v?.id || String(v || ''),
    getCode: (r: Retreat) => r.code || r.name,
    getTown: (r: Retreat) => (r as any).location || '',
    getClientName: (b: any) => `${b.clientId?.firstName} ${b.clientId?.lastName}`,
    getClientDisplayId: (b: any) => b.clientId?.display_id || '',
    getClientLanguage: () => 'EN',
  };

  it('renders default holistic header and lists retreat bookings', () => {
    render(
      <MemoryRouter>
        <RetreatReferralsHolisticView {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('Holistic Booking Referral Assignment')).toBeInTheDocument();
    expect(screen.getByText('AIR-2026')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
    expect(screen.getByText('#1182')).toBeInTheDocument();
  });

  it('changes header dynamically when a referral partner is chosen', () => {
    render(
      <MemoryRouter>
        <RetreatReferralsHolisticView {...defaultProps} />
      </MemoryRouter>
    );

    const partnerSelect = screen.getByLabelText('Filter by Referral Partner');
    fireEvent.change(partnerSelect, { target: { value: 'ref1' } });

    expect(screen.getByText('Referrals for Alchemia Dobrostanu')).toBeInTheDocument();
  });

  it('enters edit mode, displays floating bar, edits attribution, and saves', async () => {
    const onSaveSuccess = jest.fn();
    render(
      <MemoryRouter>
        <RetreatReferralsHolisticView {...defaultProps} onSaveSuccess={onSaveSuccess} />
      </MemoryRouter>
    );

    const editBtn = screen.getByRole('button', { name: /Edit Referrals/i });
    fireEvent.click(editBtn);

    expect(screen.getByText(/Edit Mode Active/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Floating Action Bar')).toBeInTheDocument();

    const partnerDropdown = screen.getByLabelText(/Referral partner for Anna Nowak/i);
    fireEvent.change(partnerDropdown, { target: { value: 'ref2' } });

    const attributionDropdown = screen.getByLabelText(/Attribution type for Anna Nowak/i);
    fireEvent.change(attributionDropdown, { target: { value: 'self_identified' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(bookingsApi.batchUpdateReferralAttribution).toHaveBeenCalledWith([
        expect.objectContaining({
          bookingId: 'b1',
          referralPartnerId: 'ref2',
          referralAttribution: 'self_identified',
        }),
      ]);
      expect(onSaveSuccess).toHaveBeenCalled();
    });
  });
});
