import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkflowDashboard from './WorkflowDashboard';
import { bookingFlowApi, clientRequirementsApi, medicalArtifactsApi, medicalReviewRequestsApi, paymentsApi, retreatsApi } from '../services/api';

jest.mock('../services/api', () => ({
  bookingFlowApi: { getRetreatWorkflowSummary: jest.fn() },
  clientRequirementsApi: { getByClientAndRetreat: jest.fn() },
  medicalArtifactsApi: { getAll: jest.fn() },
  medicalReviewRequestsApi: { getByArtifact: jest.fn() },
  paymentsApi: { getByClientAndRetreat: jest.fn() },
  retreatsApi: { getAll: jest.fn() },
}));
jest.mock('./CurrencyDisplay', () => () => <span>100 EUR</span>);
const mock = (fn: unknown) => fn as jest.Mock;
const view = () => render(<MemoryRouter><WorkflowDashboard /></MemoryRouter>);
const summary = (unavailable: string[] = []) => ({ rows: [{
  _id: 'b1', retreatId: 'r1', clientId: 'c1', clientName: 'Anna Test', clientEmail: 'anna@example.test', depositPaid: true,
  medicalRequirements: ['ekg', 'liver_panel'].map(type => ({ type, label: type === 'ekg' ? 'EKG' : 'Liver Panel', state: unavailable.some(label => label.startsWith('Medical')) ? 'unavailable' : 'approved' })),
  reminders: [], readinessScore: 4, readinessState: unavailable.length ? 'unknown' : 'ready', nextAction: unavailable.length ? 'Retry unavailable data' : 'Ready for retreat', missingItems: [], unavailable,
}], unavailable });

beforeEach(() => {
  jest.resetAllMocks();
  mock(retreatsApi.getAll).mockResolvedValue({ data: [{ _id: 'r1', name: 'Test Retreat', status: 'upcoming', startDate: '2030-10-01' }] });
  mock(bookingFlowApi.getRetreatWorkflowSummary).mockResolvedValue({ data: summary() });
  mock(clientRequirementsApi.getByClientAndRetreat).mockResolvedValue({ data: [] });
  mock(paymentsApi.getByClientAndRetreat).mockResolvedValue({ data: [] });
  mock(medicalArtifactsApi.getAll).mockResolvedValue({ data: ['ekg', 'liver_panel'].map(type => ({ _id: type, artifactType: type, files: [{ fileName: `${type}.pdf` }] })) });
  mock(medicalReviewRequestsApi.getByArtifact).mockResolvedValue({ data: [{ status: 'approved' }] });
});

test.each([1, 50])('initial overview uses one summary request and zero detail requests for %i bookings', async count => {
  const data = summary(); data.rows = Array.from({ length: count }, (_, index) => ({ ...data.rows[0], _id: `b${index}` }));
  mock(bookingFlowApi.getRetreatWorkflowSummary).mockResolvedValue({ data });
  view();
  await screen.findByText('4/4 checkpoints complete');
  expect(bookingFlowApi.getRetreatWorkflowSummary).toHaveBeenCalledTimes(1);
  expect(bookingFlowApi.getRetreatWorkflowSummary).toHaveBeenCalledWith('r1', { suppressGlobalError: true });
  [clientRequirementsApi.getByClientAndRetreat, paymentsApi.getByClientAndRetreat, medicalArtifactsApi.getAll, medicalReviewRequestsApi.getByArtifact].forEach(fn => expect(fn).not.toHaveBeenCalled());
});

test.each(['Payments', 'Requirements', 'Reminders', 'Medical documents / reviews', 'Medical reviews', 'Requirement definitions'])('summary category failure %s remains unknown and refresh recovers', async label => {
  mock(bookingFlowApi.getRetreatWorkflowSummary).mockResolvedValue({ data: summary([label]) });
  view();
  await screen.findByRole('alert');
  expect(screen.getByRole('status')).toHaveTextContent('Readiness unknown');
  expect(screen.queryByText(/checkpoints complete/)).not.toBeInTheDocument();
  expect(screen.queryByText('Deposit due')).not.toBeInTheDocument();
  mock(bookingFlowApi.getRetreatWorkflowSummary).mockResolvedValue({ data: summary() });
  fireEvent.click(screen.getByRole('button', { name: 'Retry unavailable data' }));
  await screen.findByText('4/4 checkpoints complete');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([
  ['payments', () => paymentsApi.getByClientAndRetreat, 'Unable to load payments.', 'No payments recorded for this booking.'],
  ['requirements', () => clientRequirementsApi.getByClientAndRetreat, 'Unable to load requirements.', 'No client requirements initialized.'],
])('loads %s on demand, distinguishes errors from empty and retries details', async (tab, getApi, error, empty) => {
  mock(getApi()).mockRejectedValue(new Error('offline'));
  view();
  await screen.findByText('4/4 checkpoints complete');
  fireEvent.click(screen.getByRole('button', { name: tab }));
  await screen.findByText(error);
  expect(screen.queryByText(empty)).not.toBeInTheDocument();
  expect(getApi()).toHaveBeenCalledWith('c1', 'r1', { suppressGlobalError: true });
  mock(getApi()).mockResolvedValue({ data: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Retry details' }));
  await screen.findByText(empty);
  expect(bookingFlowApi.getRetreatWorkflowSummary).toHaveBeenCalledTimes(1);
});

test('medical detail loads only for the selected booking and preserves available review results', async () => {
  mock(medicalReviewRequestsApi.getByArtifact).mockImplementation(id => id === 'ekg' ? Promise.reject(new Error('offline')) : Promise.resolve({ data: [{ status: 'approved' }] }));
  view();
  await screen.findByText('4/4 checkpoints complete');
  fireEvent.click(screen.getByRole('button', { name: 'medical' }));
  await screen.findByRole('button', { name: 'Retry details' });
  expect(medicalArtifactsApi.getAll).toHaveBeenCalledTimes(1);
  expect(medicalArtifactsApi.getAll).toHaveBeenCalledWith({ bookingId: 'b1' }, { suppressGlobalError: true });
  expect(screen.getAllByText('Approved').length).toBeGreaterThan(0);
  expect(screen.queryByText('Missing file')).not.toBeInTheDocument();
});

test('late details from a previous retreat cannot replace current records', async () => {
  mock(retreatsApi.getAll).mockResolvedValue({ data: [{ _id: 'r1', name: 'First' }, { _id: 'r2', name: 'Second' }] });
  let resolveOld: (value: any) => void = () => {};
  mock(paymentsApi.getByClientAndRetreat).mockImplementation((_client, retreat) => retreat === 'r1' ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve({ data: [] }));
  mock(bookingFlowApi.getRetreatWorkflowSummary).mockImplementation(retreat => {
    const data = summary(); data.rows[0].retreatId = retreat; data.rows[0]._id = retreat;
    return Promise.resolve({ data });
  });
  view(); await screen.findByText('4/4 checkpoints complete');
  fireEvent.click(screen.getByRole('button', { name: 'payments' }));
  await waitFor(() => expect(paymentsApi.getByClientAndRetreat).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByRole('combobox', { name: 'Retreat' }), { target: { value: 'r2' } });
  await screen.findByText('No payments recorded for this booking.');
  resolveOld({ data: [{ _id: 'old', status: 'completed', paymentMethod: 'OLD RECORD' }] });
  await waitFor(() => expect(screen.queryByText('OLD RECORD')).not.toBeInTheDocument());
});

test.each([() => retreatsApi.getAll, () => bookingFlowApi.getRetreatWorkflowSummary])('initial failure is not an empty retreat', async getApi => {
  mock(getApi()).mockRejectedValue(new Error('offline'));
  view(); await screen.findByRole('alert');
  expect(screen.queryByText('No bookings found for this retreat.')).not.toBeInTheDocument();
  expect(screen.queryByText('4/4 checkpoints complete')).not.toBeInTheDocument();
});
