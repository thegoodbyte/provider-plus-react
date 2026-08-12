import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import BookingStepClientHeader, { getBookingStepRoutePrefix } from './BookingStepClientHeader';

jest.mock('./BookingStepClientAvatar', () => () => <span data-testid="avatar" />);
const renderHeader = (booking: any, viewMode: 'detail' | 'simple' = 'detail') => render(<MemoryRouter><table><thead><tr><BookingStepClientHeader booking={booking} viewMode={viewMode} routePrefix="medical" /></tr></thead></table></MemoryRouter>);

describe('BookingStepClientHeader', () => {
  it('resolves supported route prefixes with admin fallback', () => {
    expect(getBookingStepRoutePrefix('/medical/retreats/1')).toBe('medical');
    expect(getBookingStepRoutePrefix('/staff/retreats/1')).toBe('staff');
    expect(getBookingStepRoutePrefix('/unknown/path')).toBe('admin');
    expect(getBookingStepRoutePrefix('/')).toBe('admin');
  });
  it('renders linked detail identity and contact fields', () => {
    renderHeader({ _id: 'booking', bookingNumber: 42, client: { _id: 'client', firstName: 'Ada', lastName: 'Lovelace', display_id: 7, email: 'ada@test.com', phoneCountryCode: '+420', phone: '123' } });
    expect(screen.getByTestId('avatar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute('href', '/medical/clients/client');
    expect(screen.getByRole('link', { name: 'Booking #42' })).toHaveAttribute('href', '/admin/bookings/booking');
    expect(screen.getByRole('link', { name: 'Client #7' })).toHaveAttribute('href', '/medical/clients/client');
    expect(screen.getByText('ada@test.com')).toBeInTheDocument();
    expect(screen.getByText('+420 123')).toBeInTheDocument();
  });
  it('hides detail-only fields in simple mode', () => {
    renderHeader({ _id: 'booking', bookingNumber: 42, client: { _id: 'client', firstName: 'Ada', display_id: 7, email: 'ada@test.com', phone: '123' } }, 'simple');
    expect(screen.queryByTestId('avatar')).not.toBeInTheDocument();
    expect(screen.queryByText('Client #7')).not.toBeInTheDocument();
    expect(screen.queryByText('ada@test.com')).not.toBeInTheDocument();
  });
  it('renders non-linked fallbacks when ids are absent', () => {
    renderHeader({ displayNumber: 'B-1', clientEmail: 'fallback@test.com', clientDisplayNumber: 9 });
    expect(screen.getByText('Booking #B-1')).toBeInTheDocument();
    expect(screen.getByText('Client #9')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Client #9/ })).not.toBeInTheDocument();
  });
});
