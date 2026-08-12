import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingRequirementsPanel, { formatRequirementDate, routePrefixForPath } from './BookingRequirementsPanel';
import { requirementDefinitions } from './bookingRequirementRows';
import { useBookingRequirements } from './useBookingRequirements';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ ...jest.requireActual('react-router-dom'), useNavigate: () => mockNavigate }));
jest.mock('./useBookingRequirements', () => ({ useBookingRequirements: jest.fn() }));
const hook = useBookingRequirements as jest.Mock;
const row = (overrides: any = {}) => ({ ...requirementDefinitions.find(item => item.key === 'ekg'), required: true, uploaded: false, reviewed: false, relatedItems: [], ...overrides });
const state = (overrides: any = {}) => ({ rows: [row()], libraryArtifacts: [], libraryDocuments: [], loading: false, error: '', linkingRecordId: '', reload: jest.fn(), link: jest.fn(), ...overrides });
const view = (initial = '/admin/bookings/1') => render(<MemoryRouter initialEntries={[initial]}><BookingRequirementsPanel bookingId="booking" refreshKey={0} /></MemoryRouter>);

describe('BookingRequirementsPanel', () => {
  beforeEach(() => { jest.clearAllMocks(); hook.mockReturnValue(state()); });
  it('renders state, errors, and refreshes', () => {
    const reload = jest.fn(); hook.mockReturnValue(state({ error: 'offline', reload })); view();
    expect(screen.getByText('offline')).toBeInTheDocument(); expect(screen.getByText('missing')).toBeInTheDocument(); fireEvent.click(screen.getByText('Refresh')); expect(reload).toHaveBeenCalled();
  });
  it('navigates to linked records with the current role prefix', () => {
    hook.mockReturnValue(state({ rows: [row({ uploaded: true, reviewed: true, latestArtifact: { _id: 'a', display_id: 1 }, latestDocument: { _id: 'd', display_id: 2 }, latestReview: { _id: 'r', display_id: 3, status: 'approved' } })] })); view();
    fireEvent.click(screen.getByText('Artifact #1')); fireEvent.click(screen.getByText('Document #2')); fireEvent.click(screen.getByText('Review #3'));
    expect(mockNavigate.mock.calls.map(call => call[0])).toEqual(['/admin/medical-artifacts/a', '/admin/booking-documents', '/admin/medical-review-requests/r']);
  });
  it('opens, closes, filters, sorts, and links artifacts', async () => {
    const link = jest.fn().mockResolvedValue(true); hook.mockReturnValue(state({ rows: [row()], link, libraryArtifacts: [{ _id: 'old', artifactType: 'ekg', createdAt: '2026-01-01' }, { _id: 'new', artifactType: 'ekg', createdAt: '2026-02-01' }, { _id: 'other', artifactType: 'liver_panel' }] })); view();
    fireEvent.click(screen.getByText('Find and link existing record')); expect(screen.getByRole('dialog')).toBeInTheDocument(); expect(screen.getByText(/#new/)).toBeInTheDocument(); expect(screen.getAllByText(/latest/)[0]).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Link artifact')[0]); await waitFor(() => expect(link).toHaveBeenCalledWith(expect.objectContaining({ key: 'ekg' }), 'artifact', 'new')); await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('shows and links documents and preserves dialog when linking fails', async () => {
    const contract = requirementDefinitions.find(item => item.key === 'contract'); const link = jest.fn().mockResolvedValue(false); hook.mockReturnValue(state({ rows: [row(contract)], link, libraryDocuments: [{ _id: 'empty', documentType: 'contract', files: [] }, { _id: 'doc', documentType: 'contract', files: [{}], createdAt: '2026-01-01' }] })); view('/bookings/1');
    fireEvent.click(screen.getByText('Find and link existing record')); fireEvent.click(screen.getByText('Link document')); await waitFor(() => expect(link).toHaveBeenCalled()); expect(screen.getByRole('dialog')).toBeInTheDocument(); fireEvent.click(screen.getByLabelText('Close record lookup')); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('renders empty lookup states and loading controls', () => {
    hook.mockReturnValue(state({ loading: true, linkingRecordId: 'artifact:x', rows: [row({ library: 'both' })] })); view(); expect(screen.getByText('Refreshing...')).toBeDisabled(); fireEvent.click(screen.getByText('Find and link existing record')); expect(screen.getByText(/No matching medical/)).toBeInTheDocument(); expect(screen.getByText(/No matching booking/)).toBeInTheDocument();
  });
});

describe('requirements panel helpers', () => {
  it('resolves role prefixes', () => { expect(routePrefixForPath('/medical/x')).toBe('/medical'); expect(routePrefixForPath('/bookings/x')).toBe(''); });
  it('formats valid, missing, and invalid dates', () => { expect(formatRequirementDate()).toBe('N/A'); expect(formatRequirementDate('bad')).toBe('N/A'); expect(formatRequirementDate('2026-06-01T12:00:00Z')).toContain('2026'); });
});
