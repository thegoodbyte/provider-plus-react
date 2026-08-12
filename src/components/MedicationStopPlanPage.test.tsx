import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MedicationStopPlanPage from './MedicationStopPlanPage';
import { bookingFlowApi } from '../services/api';

jest.mock('../services/api', () => ({ bookingFlowApi: { getMedicationStopPlan: jest.fn(), saveMedicationStopPlan: jest.fn() } }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useParams: () => ({ bookingId: 'booking-1240' }) }), { virtual: true });

describe('MedicationStopPlanPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads and saves the explicit all-clear state', async () => {
    (bookingFlowApi.getMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [{ _id: 'clear-1', status: 'completed', description: 'No changes required.', metadata: { medicationStopPlanAllClear: true } }] });
    (bookingFlowApi.saveMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [] });
    render(<MedicationStopPlanPage />);

    const allClear = await screen.findByRole('checkbox', { name: /All good/i });
    expect(allClear).toBeChecked();
    expect(screen.getByDisplayValue('No changes required.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add calendar item/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Save & schedule reminders/i }));
    await waitFor(() => expect(bookingFlowApi.saveMedicationStopPlan).toHaveBeenCalledWith('booking-1240', [], true, 'No changes required.'));
  });

  it('saves dated medical instructions when all-clear is not selected', async () => {
    (bookingFlowApi.getMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [] });
    (bookingFlowApi.saveMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [] });
    render(<MedicationStopPlanPage />);
    fireEvent.change(await screen.findByLabelText(/^Medication or substance$/i), { target: { value: 'Creatine' } });
    fireEvent.change(screen.getByLabelText(/Stop date/i), { target: { value: '2026-08-08' } });
    fireEvent.change(screen.getByLabelText(/Instruction shown to client/i), { target: { value: 'Stop 14 days before.' } });
    fireEvent.click(screen.getByRole('button', { name: /Save & schedule reminders/i }));
    await waitFor(() => expect(bookingFlowApi.saveMedicationStopPlan).toHaveBeenCalledWith('booking-1240', [expect.objectContaining({ name: 'Creatine', dueDate: '2026-08-08', instruction: 'Stop 14 days before.' })], false, ''));
  });
});
