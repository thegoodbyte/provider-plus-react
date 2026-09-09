import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import MedicalReviewGroupPage from './MedicalReviewGroupPage';
import { medicalReviewRequestsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../services/api', () => ({
  medicalReviewRequestsApi: {
    getGroup: jest.fn(),
    getGroupAccessLinks: jest.fn(),
  },
}));
jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));

const makeRequest = (overrides: any) => ({
  _id: overrides.id,
  display_id: overrides.id,
  requestType: overrides.requestType || 'liver_panel',
  status: overrides.status || 'pending',
  clientId: { firstName: overrides.firstName || 'Alex', lastName: overrides.lastName || 'Smith' },
  retreatId: { code: 'JNO-09-22-26', name: 'JNO-09-22-26' },
  ...overrides,
});

const group = {
  _id: 'group-1',
  title: 'JNO-09-22-26',
  groupType: 'retreat',
  retreatName: 'JNO-09-22-26',
  url: 'https://example.com/link',
  requests: [
    makeRequest({ id: 1, status: 'pending', requestType: 'liver_panel', firstName: 'Maria', lastName: 'S' }),
    makeRequest({ id: 2, status: 'in_review', requestType: 'ekg', firstName: 'Jonathan', lastName: 'K' }),
    makeRequest({ id: 3, status: 'approved', requestType: 'additional', firstName: 'Omar', lastName: 'D' }),
    makeRequest({ id: 4, status: 'rejected', requestType: 'additional', firstName: 'Hana', lastName: 'W' }),
  ],
};

const renderPage = () => render(
  <MemoryRouter initialEntries={['/medical/review-groups/group-1']}>
    <Routes>
      <Route path="/medical/review-groups/:id" element={<MedicalReviewGroupPage />} />
    </Routes>
  </MemoryRouter>,
);

describe('MedicalReviewGroupPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { role: 'medical_advisor' } });
    (medicalReviewRequestsApi.getGroup as jest.Mock).mockResolvedValue({ data: group });
    (medicalReviewRequestsApi.getGroupAccessLinks as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('shows only pending/in-review requests by default, hiding approved and rejected ones', async () => {
    renderPage();

    await screen.findByText('Maria S.');
    expect(screen.getByText('Jonathan K.')).toBeInTheDocument();
    expect(screen.queryByText('Omar D.')).not.toBeInTheDocument();
    expect(screen.queryByText('Hana W.')).not.toBeInTheDocument();
    expect(screen.getByText('2 requests awaiting review')).toBeInTheDocument();
  });

  it('reveals other statuses once selected in the filter overlay and applied', async () => {
    renderPage();
    await screen.findByText('Maria S.');

    fireEvent.click(screen.getByRole('button', { name: 'Filter requests' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Approved/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Rejected/ }));
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => expect(screen.getByText('Omar D.')).toBeInTheDocument());
    expect(screen.getByText('Hana W.')).toBeInTheDocument();
    // The pending count badge always reflects genuinely pending work, regardless of the active filter.
    expect(screen.getByText('2 requests awaiting review')).toBeInTheDocument();
  });

  it('"Reset to pending only" restores the default filter without needing to uncheck everything by hand', async () => {
    renderPage();
    await screen.findByText('Maria S.');

    fireEvent.click(screen.getByRole('button', { name: 'Filter requests' }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Approved/ }));
    fireEvent.click(screen.getByText('Reset to pending only'));
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => expect(screen.queryByText('Omar D.')).not.toBeInTheDocument());
    expect(screen.getByText('Maria S.')).toBeInTheDocument();
  });
});
