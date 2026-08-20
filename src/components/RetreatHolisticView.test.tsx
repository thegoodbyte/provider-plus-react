import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RetreatHolisticView from './RetreatHolisticView';

const bookings = [
  { _id: 'b1', bookingNumber: 101, clientId: { _id: 'c1' }, status: 'confirmed', totalAmount: 1000, currency: 'EUR' },
  { _id: 'b2', bookingNumber: 102, clientId: { _id: 'c2' }, status: 'pending', totalAmount: 900, currency: 'EUR' },
];
const props: any = { retreats: [{ _id: 'r1', code: 'RET-1', name: 'Retreat', startDate: '2026-09-01', endDate: '2026-09-08' }], options: [{ key: 'contract_sent', label: 'Contract sent', order: 1 }], selectedKey: 'contract_sent', onSelect: jest.fn(), matrices: { r1: { templates: [], items: [{ bookingId: 'b1', key: 'contract_sent', status: 'completed' }, { bookingId: 'b2', key: 'contract_sent', status: 'pending' }] } }, getId: (value: any) => typeof value === 'string' ? value : value?._id, getBookings: () => bookings, getCode: (retreat: any) => retreat.code, getTown: () => 'Mistrovice', getClientName: (booking: any) => booking._id === 'b1' ? 'Done Client' : 'Missing Client', getClientDisplayId: (booking: any) => booking._id === 'b1' ? 1 : 2, getClientLanguage: () => 'EN', routePrefix: 'admin' };

describe('RetreatHolisticView', () => {
  it('summarizes the selected step and filters missing clients', () => {
    render(<MemoryRouter><RetreatHolisticView {...props} /></MemoryRouter>);
    expect(screen.getByText('1 missing')).toBeInTheDocument(); expect(screen.getByText('Done Client')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Show only who is missing')); expect(screen.queryByText('Done Client')).not.toBeInTheDocument(); expect(screen.getByText('Missing Client')).toBeInTheDocument();
  });
  it('searches and collapses retreat groups', () => {
    render(<MemoryRouter><RetreatHolisticView {...props} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Search holistic bookings'), { target: { value: '102' } }); expect(screen.queryByText('Done Client')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Collapse all')); expect(screen.queryByText('Missing Client')).not.toBeInTheDocument(); expect(screen.getByText('Show people')).toBeInTheDocument();
  });

  it('shows every configured required step as a column', () => {
    render(<MemoryRouter><RetreatHolisticView {...props} requirementsMode options={[{ key: 'contract_signed', label: 'Contract received', order: 1 }, { key: 'ekg_received', label: 'Entry EKG', order: 2 }]} matrices={{ r1: { templates: [{ key: 'contract_signed', title: 'Contract received', category: 'contract', offsetDays: 5, isRequirement: true }, { key: 'ekg_received', title: 'Entry EKG', category: 'medical', offsetDays: 21, requiredFromClient: true }] as any, items: [{ bookingId: 'b1', key: 'contract_signed', status: 'completed' }, { bookingId: 'b1', key: 'ekg_received', status: 'pending' }, { bookingId: 'b2', key: 'contract_signed', status: 'pending' }, { bookingId: 'b2', key: 'ekg_received', status: 'completed' }] }}} /></MemoryRouter>);
    expect(screen.getByText('Contract received')).toBeInTheDocument();
    expect(screen.getByText('Entry EKG')).toBeInTheDocument();
    expect(screen.getAllByText('✓ Done')).toHaveLength(2);
    expect(screen.getAllByText('⊗ Not yet')).toHaveLength(2);
  });
});
