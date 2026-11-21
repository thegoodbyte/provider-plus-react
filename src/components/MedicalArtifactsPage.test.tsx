import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MedicalArtifactsPage from './MedicalArtifactsPage';
import { bookingDocumentsApi, medicalArtifactsApi, medicalReviewRequestsApi, retreatsApi } from '../services/api';
import { usersApi } from '../services/usersApi';

jest.mock('../services/api', () => ({
  medicalArtifactsApi: {
    getAll: jest.fn(),
    getRetreatSubmissions: jest.fn().mockResolvedValue({ data: null }),
    delete: jest.fn(),
  },
  retreatsApi: { getAll: jest.fn() },
  medicalReviewRequestsApi: {
    getAll: jest.fn().mockResolvedValue({ data: [] }),
    getGroups: jest.fn().mockResolvedValue({ data: [] }),
    getRequestTypes: jest.fn().mockResolvedValue({ data: [] }),
  },
  bookingDocumentsApi: {
    getAll: jest.fn().mockResolvedValue({ data: [] }),
    getTypes: jest.fn(),
  },
}));
jest.mock('../services/usersApi', () => ({ usersApi: { getAll: jest.fn().mockResolvedValue({ data: [] }) } }));

const artifactA: any = {
  _id: 'a1', display_id: 1, title: 'Artifact A',
  bookingId: 'booking-AAA', clientId: 'client-AAA',
  artifactType: 'ekg', documentStage: 'entry', documentType: 'EKG', status: 'stored',
};
const artifactB: any = {
  _id: 'a2', display_id: 2, title: 'Artifact B',
  bookingId: 'booking-BBB', clientId: 'client-BBB',
  artifactType: 'blood_pressure', documentStage: 'pre_ceremony', documentType: 'BP', status: 'stored',
};
const artifactC: any = {
  _id: 'a3', display_id: 3, title: 'Artifact C',
  bookingId: 'booking-CCC', clientId: 'client-CCC',
  artifactType: 'liver_panel', documentStage: 'post_ceremony', documentType: 'Liver', status: 'stored',
  retreatId: 'retreat-past',
};
const pastRetreat: any = { _id: 'retreat-past', name: 'Past Retreat', location: '', endDate: '2000-01-01' };
// B's artifactType is placed in the "documents" library, so it's hidden from Medical Artifacts
// unless "include records assigned to the other library" is checked.
const libraryTypes = [{ key: 'bp_type', medicalArtifactType: 'blood_pressure', libraryPlacement: 'documents' }];

async function renderPage() {
  // jest.config.cjs sets resetMocks:true, so every mock implementation (including the ones set
  // in the jest.mock() factory above) is wiped before each test and must be re-armed here.
  (medicalArtifactsApi.getAll as jest.Mock).mockResolvedValue({ data: [artifactA, artifactB, artifactC] });
  (medicalArtifactsApi.getRetreatSubmissions as jest.Mock).mockResolvedValue({ data: null });
  (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [pastRetreat] });
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getGroups as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getRequestTypes as jest.Mock).mockResolvedValue({ data: [] });
  (bookingDocumentsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  (bookingDocumentsApi.getTypes as jest.Mock).mockResolvedValue({ data: libraryTypes });
  (usersApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
  render(<MemoryRouter><MedicalArtifactsPage /></MemoryRouter>);
  // Wait for data + library types to finish loading: with futureRetreatsOnly defaulting to
  // true and B hidden in the other library, only A should be visible initially (1 of 3).
  const filterBar = await waitFor(() => {
    const bar = document.querySelector('.relative.mb-4.hidden.md\\:block');
    if (!bar) throw new Error('filter bar not rendered yet');
    expect(within(bar as HTMLElement).getByText(/of 3/)).toBeInTheDocument();
    return bar as HTMLElement;
  });
  return filterBar;
}

describe('MedicalArtifactsPage desktop filter bar + popover (PPVC-1050)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps the result count and Clear link visible while the popover is closed', async () => {
    const filterBar = await renderPage();
    expect(within(filterBar).queryByText('Booking ID')).not.toBeInTheDocument();
    expect(within(filterBar).getByText(/of 3/)).toBeInTheDocument();
    expect(within(filterBar).getByText('Clear')).toBeInTheDocument();
  });

  it('opens "More filters" on click, closes on a second click, and contains exactly the expected 7 controls', async () => {
    const filterBar = await renderPage();
    fireEvent.click(within(filterBar).getByRole('button', { name: /More filters/ }));
    expect(within(filterBar).getByText('Booking ID')).toBeInTheDocument();
    expect(within(filterBar).getByText('Client ID')).toBeInTheDocument();
    expect(within(filterBar).getByText('Document stage')).toBeInTheDocument();
    expect(within(filterBar).getByText('Document type')).toBeInTheDocument();
    expect(within(filterBar).getByText('Artifact type')).toBeInTheDocument();
    expect(within(filterBar).getByText('MRR state')).toBeInTheDocument();
    expect(within(filterBar).getByText('Include records assigned to the other library')).toBeInTheDocument();

    fireEvent.click(within(filterBar).getByRole('button', { name: /More filters/ }));
    expect(within(filterBar).queryByText('Booking ID')).not.toBeInTheDocument();
  });

  it('closes the popover via its own visible close (X) button', async () => {
    const filterBar = await renderPage();
    fireEvent.click(within(filterBar).getByRole('button', { name: /More filters/ }));
    expect(within(filterBar).getByText('Booking ID')).toBeInTheDocument();

    fireEvent.click(within(filterBar).getByRole('button', { name: 'Close filters' }));
    expect(within(filterBar).queryByText('Booking ID')).not.toBeInTheDocument();
  });

  it('closes the popover on an outside click', async () => {
    const filterBar = await renderPage();
    fireEvent.click(within(filterBar).getByRole('button', { name: /More filters/ }));
    expect(within(filterBar).getByText('Booking ID')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(within(filterBar).queryByText('Booking ID')).not.toBeInTheDocument();
  });

  it('updates Booking ID and Client ID filters from the popover', async () => {
    const filterBar = await renderPage();
    fireEvent.click(within(filterBar).getByRole('button', { name: /More filters/ }));

    fireEvent.change(screen.getByPlaceholderText('Booking ID'), { target: { value: 'booking-AAA' } });
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('1');

    fireEvent.change(screen.getByPlaceholderText('Booking ID'), { target: { value: 'nonexistent' } });
    expect(within(filterBar).getByText(/of 3/).textContent).toMatch(/^0/);

    fireEvent.change(screen.getByPlaceholderText('Booking ID'), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText('Client ID'), { target: { value: 'client-AAA' } });
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('1');
  });

  it('updates Document stage, Document type and Artifact type filters from the popover', async () => {
    const filterBar = await renderPage();
    fireEvent.click(within(filterBar).getByRole('button', { name: /More filters/ }));
    fireEvent.click(within(filterBar).getByText('Include records assigned to the other library').closest('label')!.querySelector('input')!);

    fireEvent.change(within(filterBar).getByLabelText('Document stage'), { target: { value: 'pre_ceremony' } });
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('1');
    fireEvent.change(within(filterBar).getByLabelText('Document stage'), { target: { value: 'all' } });

    fireEvent.change(within(filterBar).getByLabelText('Document type'), { target: { value: 'BP' } });
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('1');
    fireEvent.change(within(filterBar).getByLabelText('Document type'), { target: { value: 'all' } });

    fireEvent.change(within(filterBar).getByLabelText('Artifact type'), { target: { value: 'blood_pressure' } });
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('1');
  });

  it('updates the MRR state filter from the popover', async () => {
    const filterBar = await renderPage();
    fireEvent.click(within(filterBar).getByRole('button', { name: /More filters/ }));

    fireEvent.change(within(filterBar).getByLabelText('MRR state'), { target: { value: 'has_review' } });
    expect(within(filterBar).getByText(/of 3/).textContent).toMatch(/^0/);

    fireEvent.change(within(filterBar).getByLabelText('MRR state'), { target: { value: 'no_review' } });
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('1');
  });

  it('toggles the "Future retreats" pill and reveals/hides a past-retreat artifact', async () => {
    const filterBar = await renderPage();
    const pill = within(filterBar).getByRole('button', { name: /Future retreats/ });
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('1');

    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-pressed', 'false');
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('2');

    fireEvent.click(pill);
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('1');
  });

  it('updates library.includeOther from its new popover location, revealing the other-library artifact', async () => {
    const filterBar = await renderPage();
    fireEvent.click(within(filterBar).getByRole('button', { name: /More filters/ }));
    const checkbox = within(filterBar).getByText('Include records assigned to the other library').closest('label')!.querySelector('input') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('1');

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('2');
  });

  it('Clear resets every filter, including popover filters, the toggle pill and the search input', async () => {
    const filterBar = await renderPage();
    fireEvent.click(within(filterBar).getByRole('button', { name: /More filters/ }));

    fireEvent.change(within(filterBar).getByPlaceholderText('Search client, booking, retreat, artifact...'), { target: { value: 'something' } });
    fireEvent.change(screen.getByPlaceholderText('Booking ID'), { target: { value: 'booking-AAA' } });
    fireEvent.change(screen.getByPlaceholderText('Client ID'), { target: { value: 'client-AAA' } });
    fireEvent.change(within(filterBar).getByLabelText('Document stage'), { target: { value: 'pre_ceremony' } });
    fireEvent.change(within(filterBar).getByLabelText('Document type'), { target: { value: 'BP' } });
    fireEvent.change(within(filterBar).getByLabelText('Artifact type'), { target: { value: 'blood_pressure' } });
    fireEvent.change(within(filterBar).getByLabelText('MRR state'), { target: { value: 'has_review' } });
    const pill = within(filterBar).getByRole('button', { name: /Future retreats/ });
    fireEvent.click(pill);

    expect(within(filterBar).getByText(/of 3/).textContent).toMatch(/^0/);

    fireEvent.click(within(filterBar).getByText('Clear'));

    expect((within(filterBar).getByPlaceholderText('Search client, booking, retreat, artifact...') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('Booking ID') as HTMLInputElement).value).toBe('');
    expect((screen.getByPlaceholderText('Client ID') as HTMLInputElement).value).toBe('');
    expect((within(filterBar).getByLabelText('Document stage') as HTMLSelectElement).value).toBe('all');
    expect((within(filterBar).getByLabelText('Document type') as HTMLSelectElement).value).toBe('all');
    expect((within(filterBar).getByLabelText('Artifact type') as HTMLSelectElement).value).toBe('all');
    expect((within(filterBar).getByLabelText('MRR state') as HTMLSelectElement).value).toBe('all');
    expect(pill).toHaveAttribute('aria-pressed', 'false');
    // Clearing turns futureRetreatsOnly off (matching the pre-existing Clear-filters behavior), so
    // the previously-hidden past-retreat artifact becomes visible again alongside A and C.
    expect(within(filterBar).getByText(/of 3/).textContent).toContain('2');
  });
});
