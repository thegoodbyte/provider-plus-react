import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MedicationStopPlanPage from './MedicationStopPlanPage';
import { bookingFlowApi, bookingsApi } from '../services/api';

jest.mock('../services/api', () => ({ bookingsApi: { getOneFresh: jest.fn() }, bookingFlowApi: { getMedicationStopPlan: jest.fn(), saveMedicationStopPlan: jest.fn(), approveMedicationStopPlan: jest.fn(), publishMedicationStopPlan: jest.fn() } }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useParams: () => ({ bookingId: 'booking-1240' }) }), { virtual: true });

describe('MedicationStopPlanPage', () => {
  beforeEach(() => { jest.clearAllMocks(); (bookingsApi.getOneFresh as jest.Mock).mockResolvedValue({ data: { retreatId: { startDate: '2026-11-17' } } }); });

  it('loads and saves the explicit all-clear state', async () => {
    (bookingFlowApi.getMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [{ _id: 'clear-1', status: 'completed', description: 'No changes required.', metadata: { medicationStopPlanAllClear: true } }] });
    (bookingFlowApi.saveMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [] });
    render(<MedicationStopPlanPage />);

    const allClear = await screen.findByRole('checkbox', { name: /All good/i });
    expect(allClear).toBeChecked();
    expect(screen.getByDisplayValue('No changes required.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add calendar item/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
    await waitFor(() => expect(bookingFlowApi.saveMedicationStopPlan).toHaveBeenCalledWith('booking-1240', [], true, 'No changes required.', expect.objectContaining({ remindersPaused: false })));
  });

  it('saves dated medical instructions when all-clear is not selected', async () => {
    (bookingFlowApi.getMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [] });
    (bookingFlowApi.saveMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [] });
    render(<MedicationStopPlanPage />);
    fireEvent.change(await screen.findByLabelText(/^Medication or substance$/i), { target: { value: 'Creatine' } });
    fireEvent.change(screen.getByLabelText(/Stop date/i), { target: { value: '2026-08-08' } });
    fireEvent.change(screen.getByLabelText(/Instruction shown to client/i), { target: { value: 'Stop 14 days before.' } });
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
    await waitFor(() => expect(bookingFlowApi.saveMedicationStopPlan).toHaveBeenCalledWith('booking-1240', [expect.objectContaining({ name: 'Creatine', dueDate: '2026-08-08', instruction: 'Stop 14 days before.' })], false, '', expect.any(Object)));
  });

  it('previews days and months separately, saves relative instructions, and shows the calendar', async () => {
    (bookingFlowApi.getMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [] });
    (bookingFlowApi.saveMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [] });
    render(<MedicationStopPlanPage />);
    fireEvent.change(await screen.findByLabelText(/^Medication or substance$/i), { target: { value: 'Alcohol' } });
    fireEvent.change(screen.getByLabelText(/Instruction shown to client/i), { target: { value: 'Remain sober per medical advisor.' } });
    fireEvent.change(screen.getByLabelText(/Or days before retreat/i), { target: { value: '30' } });
    expect(screen.getByText('Preparation date: 2026-10-18')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Or calendar months/i), { target: { value: '1' } });
    expect(screen.getByText('Preparation date: 2026-10-17')).toBeInTheDocument();
    expect(screen.getByLabelText(/Or days before retreat/i)).toHaveValue(null);
    expect(screen.getByRole('button', { name: /Medical approve/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Save draft/i }));
    await waitFor(() => expect(bookingFlowApi.saveMedicationStopPlan).toHaveBeenCalledWith('booking-1240', [expect.objectContaining({ monthsBeforeRetreat: '1', daysBeforeRetreat: '', dueDate: '' })], false, '', expect.anything()));
    fireEvent.click(screen.getByRole('button', { name: /Calendar view/i }));
    fireEvent.change(screen.getByLabelText(/Calendar month/i), { target: { value: '2026-10' } });
    expect(screen.getByRole('region', { name: 'Preparation calendar' })).toHaveTextContent('Alcohol');
  });

  it('blocks editing after a failed load', async () => {
    (bookingFlowApi.getMedicationStopPlan as jest.Mock).mockRejectedValue(new Error('offline'));
    render(<MedicationStopPlanPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
    expect(screen.queryByRole('button', { name: /Save draft/i })).not.toBeInTheDocument();
  });

  it('requires approval before publication', async () => { (bookingFlowApi.getMedicationStopPlan as jest.Mock).mockResolvedValue({ data: [{ _id:'one', status:'pending', title:'Creatine', description:'Stop', metadata:{ planLifecycle:'draft' } }] }); (bookingFlowApi.approveMedicationStopPlan as jest.Mock).mockResolvedValue({ data:[{ metadata:{ planLifecycle:'approved' } }] }); (bookingFlowApi.publishMedicationStopPlan as jest.Mock).mockResolvedValue({ data:[{ metadata:{ planLifecycle:'published' } }] }); render(<MedicationStopPlanPage/>); const approve=await screen.findByRole('button',{name:/Medical approve/i}); expect(screen.getByRole('button',{name:/Publish to IR/i})).toBeDisabled(); fireEvent.click(approve); await waitFor(()=>expect(screen.getByRole('button',{name:/Publish to IR/i})).toBeEnabled()); fireEvent.click(screen.getByRole('button',{name:/Publish to IR/i})); await waitFor(()=>expect(bookingFlowApi.publishMedicationStopPlan).toHaveBeenCalledWith('booking-1240')); });
});
