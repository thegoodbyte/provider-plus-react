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
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ targetRetreatId: 'next', reason: 'client_requested', sendEmail: false })));
  });
});
