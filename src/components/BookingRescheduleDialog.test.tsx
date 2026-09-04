import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BookingRescheduleDialog from './BookingRescheduleDialog';

describe('BookingRescheduleDialog', () => {
  it('suggests eligible retreats, requires a note, and keeps email off by default', async () => {
    const submit = jest.fn().mockResolvedValue(undefined);
    render(<BookingRescheduleDialog currentRetreatId="current" retreats={[
      { _id: 'current', code: 'CURRENT', startDate: '2099-01-01', endDate: '2099-01-08', capacity: 6 } as any,
      { _id: 'next', code: 'NEXT', startDate: '2099-02-01', endDate: '2099-02-08', capacity: 6, currentOccupancy: 2 } as any,
      { _id: 'full', code: 'FULL', startDate: '2099-03-01', endDate: '2099-03-08', capacity: 6, currentOccupancy: 6 } as any,
      { _id: 'past', code: 'PAST', startDate: '2020-01-01', endDate: '2020-01-08', capacity: 6 } as any,
    ]} saving={false} onClose={jest.fn()} onSubmit={submit} />);
    expect(screen.getByText(/NEXT/)).toBeInTheDocument(); expect(screen.queryByText(/PAST/)).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /FULL.*Full/ })).toBeDisabled();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    fireEvent.change(screen.getByRole('combobox', { name: /Move to retreat/ }), { target: { value: 'next' } });
    fireEvent.change(screen.getByRole('textbox', { name: /Internal note/ }), { target: { value: 'Client requested new dates' } });
    fireEvent.click(screen.getByText('Confirm reschedule'));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ targetRetreatId: 'next', reason: 'client_requested', sendEmail: false, allowEarlierRetreat: false })));
  });

  it('allows an admin to select a full retreat and shows an over-capacity warning', () => {
    render(<BookingRescheduleDialog currentRetreatId="current" isAdmin retreats={[
      { _id: 'current', code: 'CURRENT', startDate: '2099-01-01', endDate: '2099-01-08', capacity: 6 } as any,
      { _id: 'full', code: 'FULL', startDate: '2099-02-01', endDate: '2099-02-08', capacity: 6, currentOccupancy: 6 } as any,
    ]} saving={false} onClose={jest.fn()} onSubmit={jest.fn()} />);
    const option = screen.getByRole('option', { name: /FULL.*admin override available/ });
    expect(option).not.toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: /Move to retreat/ }), { target: { value: 'full' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/retreat is full.*above.*capacity/i);
  });

  it('lets an admin reveal earlier upcoming retreats but never already-ended retreats', () => {
    render(<BookingRescheduleDialog currentRetreatId="current" currentRetreatStartDate="2099-06-01" isAdmin retreats={[
      { _id: 'current', code: 'CURRENT', startDate: '2099-06-01', endDate: '2099-06-08' } as any,
      { _id: 'earlier', code: 'EARLIER', startDate: '2099-05-01', endDate: '2099-05-08' } as any,
      { _id: 'ended', code: 'ENDED', startDate: '2020-05-01', endDate: '2020-05-08' } as any,
    ]} saving={false} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.queryByRole('option', { name: /EARLIER/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /Show earlier retreat dates/ }));
    expect(screen.getByRole('option', { name: /EARLIER/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /ENDED/ })).not.toBeInTheDocument();
  });

  it('does not expose the earlier-retreat control to non-admin users', () => {
    render(<BookingRescheduleDialog currentRetreatId="current" currentRetreatStartDate="2099-06-01" retreats={[
      { _id: 'current', code: 'CURRENT', startDate: '2099-06-01', endDate: '2099-06-08' } as any,
      { _id: 'earlier', code: 'EARLIER', startDate: '2099-05-01', endDate: '2099-05-08' } as any,
    ]} saving={false} onClose={jest.fn()} onSubmit={jest.fn()} />);
    expect(screen.queryByRole('checkbox', { name: /Show earlier retreat dates/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /EARLIER/ })).not.toBeInTheDocument();
  });
});
