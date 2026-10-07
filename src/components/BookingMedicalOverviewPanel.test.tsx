import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingMedicalOverviewPanel, { artifactTitle, medicalOverviewError, medicalRoutePrefix, reviewDecisionClass, reviewDecisionText, reviewReferenceText, shortMedicalDate } from './BookingMedicalOverviewPanel';
import { loadBookingMedicalOverview } from './bookingMedicalOverviewData';
import { bookingFlowApi } from '../services/api';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));
jest.mock('./bookingMedicalOverviewData', () => ({ ...jest.requireActual('./bookingMedicalOverviewData'), loadBookingMedicalOverview: jest.fn() }));
jest.mock('./BookingMedicalUpload', () => {
  const actual = jest.requireActual('./BookingMedicalUpload');
  const Mock = (props: any) => <button onClick={props.onUploadComplete}>Mock medical upload {props.uploadRequest?.stage} {props.uploadRequest?.documentType} {props.hideRequiredDocumentCards ? 'hidden' : 'shown'}</button>;
  return { ...actual, __esModule: true, default: Mock };
});
jest.mock('../services/api', () => ({ bookingFlowApi: { getItemReminderPreview: jest.fn(), sendItemReminder: jest.fn() } }));

const load = loadBookingMedicalOverview as jest.Mock;
const result = (overrides: any = {}) => ({ artifacts: [], reviewsByArtifact: {}, medicationPlan: [], flowItems: [], ...overrides });
const view = (props: any = {}, path = '/admin/bookings/b') => render(<MemoryRouter initialEntries={[path]}><BookingMedicalOverviewPanel bookingId="b" refreshKey={0} onUploadComplete={jest.fn()} {...props} /></MemoryRouter>);

describe('BookingMedicalOverviewPanel', () => {
  beforeEach(() => { jest.clearAllMocks(); load.mockResolvedValue(result()); });

  it('loads and renders missing required-item cards, then refreshes', async () => {
    view();
    await waitFor(() => expect(load).toHaveBeenCalledWith('b', undefined, undefined));
    expect(screen.getAllByText('Not received')).toHaveLength(4); // chip + decision-step label, x2 cards
    expect(screen.getByText(/entry items missing/)).toBeInTheDocument();
    expect(screen.getByText(/Medical upload needs/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it('shows API errors and retries', async () => {
    load.mockRejectedValueOnce({ response: { data: { message: 'offline' } } }).mockResolvedValueOnce(result());
    view();
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('renders all-clear and navigates to medication plan', async () => {
    load.mockResolvedValue(result({ medicationPlan: [{ _id: 'p', description: 'No changes', metadata: { medicationStopPlanAllClear: true } }] }));
    view();
    expect(await screen.findByText(/All good/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Edit medication plan'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/bookings/b/medication-stop-plan');
  });

  it('renders dated, undated, overdue and completed preparation items', async () => {
    load.mockResolvedValue(result({ medicationPlan: [{ _id: 'a', title: 'Stop A', description: 'desc', dueDate: '2020-01-01', status: 'pending', metadata: { taperPlan: 'slow' } }, { _id: 'b', title: 'Stop B', status: 'completed', dueDate: '2020-01-01', metadata: {} }, { _id: 'c', title: 'Stop C', metadata: {} }] }));
    view();
    expect(await screen.findByText('Stop A')).toBeInTheDocument();
    expect(screen.getByText('slow')).toBeInTheDocument();
    expect(screen.getByText('Date not set')).toBeInTheDocument();
    expect(screen.getByText('Stop A').closest('.is-overdue')).toBeTruthy();
    expect(screen.getByText('Stop B').closest('.is-upcoming')).toBeTruthy();
  });

  it('renders an approved required item with its reviewer note, navigates to the MRR, and hides the upload component duplicate grid', async () => {
    load.mockResolvedValue(result({
      artifacts: [{ _id: 'a', display_id: 4, artifactType: 'ekg', documentType: 'EKG', documentStage: 'entry', files: [{}], createdAt: '2026-01-01' }],
      reviewsByArtifact: { a: [{ _id: 'r', display_id: 8, status: 'completed', reviewDecision: 'OK', reviewNotes: 'fine', reviewedAt: '2026-02-01' }] },
    }));
    const callback = jest.fn();
    view({ clientId: 'c', retreatId: 't', bookingNumber: 99, onUploadComplete: callback });
    expect(await screen.findByText('Artifact #4')).toBeInTheDocument();
    expect(screen.getByText('fine')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'MRR #8' })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/admin/medical-review-requests/r');
    expect(screen.getByText(/Mock medical upload.*hidden/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Mock medical upload/));
    await waitFor(() => expect(callback).toHaveBeenCalled());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('offers MRR creation for a received-but-unreviewed artifact', async () => {
    load.mockResolvedValue(result({ artifacts: [{ _id: 'a', artifactType: 'ekg', documentType: 'EKG', documentStage: 'entry', files: [{}] }] }));
    view({}, '/medical/bookings/b');
    const buttons = await screen.findAllByRole('button', { name: 'Create MRR' });
    expect(buttons).toHaveLength(2); // the required-entry card and its matching records-by-stage row
    fireEvent.click(buttons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/medical/medical-review-requests/new?artifactId=a');
  });

  it('opens type-specific upload controls from both required entry cards', async () => {
    view({ clientId: 'c', retreatId: 't' });
    const uploadButtons = await screen.findAllByRole('button', { name: 'Upload file' });
    expect(uploadButtons).toHaveLength(2);
    fireEvent.click(uploadButtons[0]);
    expect(screen.getByText(/Mock medical upload entry EKG/)).toBeInTheDocument();
  });

  it('previews and sends a reminder when "Request from client" is used on a missing item', async () => {
    (bookingFlowApi.getItemReminderPreview as jest.Mock).mockResolvedValue({ data: { to: 'client@example.com', subject: 'Reminder', bodyText: 'Please send your EKG', uploadUrl: 'https://x', reminderCount: 0, duplicateBlocked: false, duplicateWarning: false, suggestedFollowUpDate: '2026-03-01', history: [] } });
    (bookingFlowApi.sendItemReminder as jest.Mock).mockResolvedValue({ data: {} });
    load.mockResolvedValue(result({ flowItems: [{ _id: 'flow-1', key: 'ekg_received' }] }));
    view({ clientId: 'c', retreatId: 't' });
    fireEvent.click(await screen.findAllByRole('button', { name: 'Request from client' }).then(items => items[0]));
    await waitFor(() => expect(bookingFlowApi.getItemReminderPreview).toHaveBeenCalledWith('flow-1'));
    expect(await screen.findByText('Please send your EKG')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Send reminder'));
    await waitFor(() => expect(bookingFlowApi.sendItemReminder).toHaveBeenCalledWith('flow-1', expect.objectContaining({ subject: 'Reminder' })));
  });

  it('expands and collapses a stage with records, and shows a "needs a decision" badge', async () => {
    load.mockResolvedValue(result({
      artifacts: [{ _id: 'a', artifactType: 'ekg', documentType: 'EKG', documentStage: 'entry', files: [{}], createdAt: '2026-01-01' }],
    }));
    view();
    expect(await screen.findByText('1 needs a decision')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Create MRR' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Hide records' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Create MRR' })).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Show records' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Create MRR' })).toHaveLength(2));
  });
});

describe('medical overview helpers', () => {
  it('handles route prefixes and errors', () => { expect(medicalRoutePrefix('/staff/x')).toBe('/staff'); expect(medicalRoutePrefix('/bookings/x')).toBe(''); expect(medicalOverviewError({ response: { data: { message: 'api' } } })).toBe('api'); expect(medicalOverviewError(new Error('local'))).toBe('local'); expect(medicalOverviewError({})).toContain('Unable'); });
  it('maps review decisions', () => { expect(reviewDecisionText()).toBe('No decision'); expect(reviewDecisionText({ decision: 'caution' } as any)).toBe('caution'); expect(reviewDecisionClass({ reviewDecision: 'approved' } as any)).toBe('medical-decision-ok'); expect(reviewDecisionClass({ decision: 'needs info' } as any)).toBe('medical-decision-caution'); expect(reviewDecisionClass({ decision: 'rejected' } as any)).toBe('medical-decision-declined'); expect(reviewDecisionClass()).toBe('medical-decision-pending'); });
  it('shows the MRR reference when a record has a review request', () => { expect(reviewReferenceText({ _id: 'review-id', display_id: 123 } as any)).toBe('MRR #123'); expect(reviewReferenceText()).toBe('NO MRR'); });
  it('formats dates and artifact titles', () => { expect(shortMedicalDate()).toBe('N/A'); expect(shortMedicalDate('bad')).toBe('N/A'); expect(shortMedicalDate('2026-06-01')).toContain('2026'); expect(artifactTitle({ title: 'EKG', ceremonyNumber: 2 } as any)).toBe('EKG - Ceremony #2'); expect(artifactTitle({} as any)).toBe('Medical record'); });
});
