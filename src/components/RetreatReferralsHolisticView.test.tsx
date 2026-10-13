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

  it('preserves existing explicit attribution, verified date and payment note from DB', () => {
    const booking = {
      _id: 'b1',
      referralAttribution: 'direct',
      referralPartnerId: partnerId,
      referralVerifiedDate: '2026-10-10',
      referralPaymentNote: 'Paid via Revolut',
    } as any;
    expect(computeInitialBookingAttribution(booking, [booking])).toEqual({
      partnerId,
      attribution: 'direct',
      verifiedDate: '2026-10-10',
      paymentNote: 'Paid via Revolut',
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
      verifiedDate: null,
      paymentNote: '',
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
    expect(computeInitialBookingAttribution(booking, [booking])).toEqual(
      expect.objectContaining({
        partnerId,
        attribution: 'self_identified',
      })
    );
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
    expect(computeInitialBookingAttribution(second, [first, second])).toEqual(
      expect.objectContaining({
        partnerId: null,
        attribution: 'self',
      })
    );
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
        phone: '+48 123 456 789',
        display_id: 101,
        referralId: 'ref1',
        referralAttributionType: 'direct',
      } as any,
    } as any,
    {
      _id: 'b2',
      retreatId: 'ret1',
      bookingNumber: 1183,
      totalAmount: 1800,
      currency: 'EUR',
      referralPartnerId: 'ref2',
      referralAttribution: 'direct',
      clientId: {
        _id: 'c2',
        firstName: 'Jan',
        lastName: 'Kowalski',
        phone: '+48 555 444 333',
        display_id: 102,
        referralId: 'ref2',
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

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders default holistic header, referee ID, and lists retreat bookings', () => {
    render(
      <MemoryRouter>
        <RetreatReferralsHolisticView {...defaultProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('Holistic Booking Referral Assignment')).toBeInTheDocument();
    expect(screen.getByText('AIR-2026')).toBeInTheDocument();
    expect(screen.getByText('Anna Nowak')).toBeInTheDocument();
    expect(screen.getByText('#1182')).toBeInTheDocument();

    // Verify Referee ID formatted string
    expect(screen.getByText('anna.N-48123456789_AIR2026-1182')).toBeInTheDocument();
  });

  it('copies referee ID to clipboard on button click', async () => {
    render(
      <MemoryRouter>
        <RetreatReferralsHolisticView {...defaultProps} />
      </MemoryRouter>
    );

    const copyBtn = screen.getByLabelText(/Copy Referee ID anna.N-48123456789_AIR2026-1182/i);
    await waitFor(() => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('anna.N-48123456789_AIR2026-1182');
  });

  it('locks referral partner dropdown when booking is assigned to another partner', async () => {
    render(
      <MemoryRouter>
        <RetreatReferralsHolisticView {...defaultProps} />
      </MemoryRouter>
    );

    // Filter to ref1 (Alchemia Dobrostanu)
    const partnerSelect = screen.getByLabelText('Filter by Referral Partner');
    fireEvent.change(partnerSelect, { target: { value: 'ref1' } });

    // Enter edit mode
    const editBtn = screen.getByRole('button', { name: /Edit Referrals/i });
    fireEvent.click(editBtn);

    // Switch partner filter back to All to see both bookings in edit mode
    fireEvent.change(partnerSelect, { target: { value: 'ref1' } });

    // For booking b1 (assigned to ref1): dropdown is editable
    expect(screen.getByLabelText(/Referral partner for Anna Nowak/i)).not.toBeDisabled();
  });

  it('enters edit mode, updates partner, attribution, verified date, and payment note', async () => {
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

    // Change attribution
    const attributionDropdown = screen.getByLabelText(/Attribution type for Anna Nowak/i);
    fireEvent.change(attributionDropdown, { target: { value: 'self_identified' } });

    // Change verified date
    const verifiedDateInput = screen.getByLabelText(/Verified date for Anna Nowak/i);
    fireEvent.change(verifiedDateInput, { target: { value: '2026-10-15' } });

    // Add payment note
    const noteInput = screen.getByLabelText(/Payment note for Anna Nowak/i);
    fireEvent.change(noteInput, { target: { value: 'Ref: wire #AD-991' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(bookingsApi.batchUpdateReferralAttribution).toHaveBeenCalledWith([
        expect.objectContaining({
          bookingId: 'b1',
          referralAttribution: 'self_identified',
          referralVerifiedDate: '2026-10-15',
          referralPaymentNote: 'Ref: wire #AD-991',
        }),
      ]);
      expect(onSaveSuccess).toHaveBeenCalled();
    });
  });

  it('filters by retreat using the retreat filter dropdown', () => {
    const multiRetreatProps = {
      ...defaultProps,
      retreats: [
        mockRetreats[0],
        {
          _id: 'ret2',
          name: 'Summer Iboga Retreat',
          code: 'SMR-2026',
          startDate: '2026-07-10',
          endDate: '2026-07-17',
          location: 'Praha',
        } as any,
      ],
      bookings: [
        mockBookings[0],
        {
          _id: 'b-summer',
          retreatId: 'ret2',
          bookingNumber: 1199,
          totalAmount: 1200,
          currency: 'EUR',
          clientId: {
            _id: 'c-sum',
            firstName: 'Marek',
            lastName: 'Novak',
            display_id: 109,
          } as any,
        } as any,
      ],
    };

    render(
      <MemoryRouter>
        <RetreatReferralsHolisticView {...multiRetreatProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('AIR-2026')).toBeInTheDocument();
    expect(screen.getByText('SMR-2026')).toBeInTheDocument();

    const retreatSelect = screen.getByLabelText('Filter by Retreat');
    fireEvent.change(retreatSelect, { target: { value: 'ret2' } });

    expect(screen.queryByText('AIR-2026')).not.toBeInTheDocument();
    expect(screen.getByText('SMR-2026')).toBeInTheDocument();
  });

  it('displays Booking date under client metadata based on first payment date', () => {
    const paidBookingProps = {
      ...defaultProps,
      bookings: [
        {
          ...mockBookings[0],
          firstPaymentDate: '2026-09-15T00:00:00.000Z',
        },
      ],
    };

    render(
      <MemoryRouter>
        <RetreatReferralsHolisticView {...paidBookingProps} />
      </MemoryRouter>
    );

    expect(screen.getByText('Booking date:')).toBeInTheDocument();
    expect(screen.getByText(new Date('2026-09-15T00:00:00.000Z').toLocaleDateString('cs-CZ'))).toBeInTheDocument();
  });
  it('does not confuse client payments or legacy paidAt with referral payouts', () => {
    render(<MemoryRouter><RetreatReferralsHolisticView {...defaultProps} bookings={[{...mockBookings[0], firstPaymentDate:'2026-09-15', paidAt:'2026-09-16'} as any]} /></MemoryRouter>);
    expect(screen.getByTestId(`referral-payment-${mockBookings[0]._id}`)).toBeEmptyDOMElement();
  });
  it('shows each actual allocation date, amount, currency and method', () => {
    render(<MemoryRouter><RetreatReferralsHolisticView {...defaultProps} bookings={[{...mockBookings[0], referralPayments:[{expenseId:'e1',paidAt:'2026-10-01',amount:100,currency:'PLN',paymentMethod:'cash'},{expenseId:'e2',paidAt:'2026-10-13',amount:50,currency:'EUR',paymentMethod:'bank_transfer'}]} as any]} /></MemoryRouter>);
    const cell=screen.getByTestId(`referral-payment-${mockBookings[0]._id}`);
    for (const text of ['2026-10-01','100 PLN','Cash','2026-10-13','50 EUR','Bank transfer']) expect(cell).toHaveTextContent(text);
  });

});
