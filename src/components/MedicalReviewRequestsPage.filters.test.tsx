jest.mock('./MedicalReviewBookingLink', () => () => null);
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MedicalReviewRequestsPage from './MedicalReviewRequestsPage';
import { medicalReviewRequestsApi, usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/api', () => ({
  medicalArtifactsApi: {},
  medicalReviewRequestsApi: { update: jest.fn(), review: jest.fn(), getAll: jest.fn(), getQueue: jest.fn(), getOne: jest.fn(), getContext: jest.fn(), getAccessLinks: jest.fn(), getClientMessages: jest.fn() },
  usersApi: { findAll: jest.fn() },
}));

// PPVC-1080: the medical review requests filter bar got visible labels above
// each control and the free-text retreat input was replaced with a searchable
// antd Select built from the requests already loaded (same pattern as
// PaymentRequestsGrid's retreat filter) that matches by exact retreat id
// rather than a substring of its code/name/location text.
const retreatOne = { _id: 'retreat-1', name: 'Jungle Retreat', retreatCode: 'JR1', startDate: '2027-01-05' };
const retreatTwo = { _id: 'retreat-2', name: 'Mountain Retreat', location_town: 'Liberec', retreatCode: 'MR2', startDate: '2027-02-10' };

const requestA: any = { _id: 'req-a', display_id: 1, status: 'pending', requestType: 'ekg_review', retreatId: retreatOne, clientId: { _id: 'c1', firstName: 'Ann', lastName: 'A' }, artifactIds: [] };
const requestB: any = { _id: 'req-b', display_id: 2, status: 'pending', requestType: 'ekg_review', retreatId: { ...retreatOne }, clientId: { _id: 'c2', firstName: 'Bob', lastName: 'B' }, artifactIds: [] };
const requestC: any = { _id: 'req-c', display_id: 3, status: 'pending', requestType: 'ekg_review', retreatId: retreatTwo, clientId: { _id: 'c3', firstName: 'Cid', lastName: 'C' }, artifactIds: [] };

const mountList = async () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin', email: 'staff@example.invalid' } });
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [requestA, requestB, requestC] });
  (medicalReviewRequestsApi.getContext as jest.Mock).mockResolvedValue({ data: { artifacts: { all: [] } } });
  (medicalReviewRequestsApi.getAccessLinks as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getClientMessages as jest.Mock).mockResolvedValue({ data: { messages: [], skippedNotifications: [] } });
  (usersApi.findAll as jest.Mock).mockResolvedValue({ data: [] });
  render(<MemoryRouter initialEntries={['/admin/medical-review-requests']}><Routes><Route path='/admin/medical-review-requests' element={<MedicalReviewRequestsPage />} /></Routes></MemoryRouter>);
  await screen.findByText('Showing 3 of 3 review requests');
};

it('PPVC-1080: labels each filter control above its input', async () => {
  await mountList();
  expect(screen.getByText('Request type')).toBeInTheDocument();
  expect(screen.getByText('Status')).toBeInTheDocument();
  expect(screen.getByText('Retreat')).toBeInTheDocument();
  expect(screen.getByText('Search')).toBeInTheDocument();
});

// The retreat Select's dropdown is scoped to `.ant-select-dropdown` because the page also
// renders native <select> elements (Request type, Status) whose <option>s otherwise pollute
// a page-wide getByRole('option') query.
const retreatDropdownLabels = async () => {
  const dropdown = await waitFor(() => {
    const el = document.querySelector('.ant-select-dropdown');
    if (!el) throw new Error('retreat dropdown not open yet');
    return el as HTMLElement;
  });
  return within(dropdown).getAllByRole('option').map((option) => option.textContent);
};

it('PPVC-1080: the retreat dropdown lists each unique retreat once plus "All retreats"', async () => {
  await mountList();
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Retreat' }));
  expect(await retreatDropdownLabels()).toEqual(['All retreats', 'JR1 · Jungle Retreat · 2027-01-05', 'MR2 · Mountain Retreat · 2027-02-10']);
});

it('PPVC-1080: selecting a retreat filters to only requests matching that retreat exactly', async () => {
  await mountList();
  fireEvent.change(screen.getByRole('combobox', { name: 'Retreat' }), { target: { value: 'Mountain' } });
  fireEvent.click(await screen.findByRole('option', { name: 'MR2 · Mountain Retreat · 2027-02-10' }));
  await waitFor(() => expect(screen.getByText('Showing 1 of 3 review requests')).toBeInTheDocument());
  expect(screen.queryByText('Showing 3 of 3 review requests')).not.toBeInTheDocument();
});

it('PPVC-1080: selecting "All retreats" reverts to showing all requests', async () => {
  await mountList();
  fireEvent.change(screen.getByRole('combobox', { name: 'Retreat' }), { target: { value: 'Mountain' } });
  fireEvent.click(await screen.findByRole('option', { name: 'MR2 · Mountain Retreat · 2027-02-10' }));
  await waitFor(() => expect(screen.getByText('Showing 1 of 3 review requests')).toBeInTheDocument());
  fireEvent.change(screen.getByRole('combobox', { name: 'Retreat' }), { target: { value: '' } });
  fireEvent.click(await screen.findByRole('option', { name: 'All retreats' }));
  await waitFor(() => expect(screen.getByText('Showing 3 of 3 review requests')).toBeInTheDocument());
});

it('PPVC-1080: typing a partial retreat code/name narrows the dropdown options (antd showSearch)', async () => {
  await mountList();
  fireEvent.change(screen.getByRole('combobox', { name: 'Retreat' }), { target: { value: 'JR1' } });
  expect(await retreatDropdownLabels()).toEqual(['JR1 · Jungle Retreat · 2027-01-05']);
});

it('PPVC-1080: the other filters (type/status/pending-only/search) still work alongside the new retreat dropdown', async () => {
  await mountList();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pending' } });
  await waitFor(() => expect(screen.getByText('Showing 3 of 3 review requests')).toBeInTheDocument());
  fireEvent.click(screen.getByLabelText('Pending only'));
  await waitFor(() => expect(screen.getByText('Showing 3 of 3 review requests')).toBeInTheDocument());
  fireEvent.change(screen.getByPlaceholderText('Search client, request, artifact...'), { target: { value: 'Bob' } });
  await waitFor(() => expect(screen.getByText('Showing 1 of 3 review requests')).toBeInTheDocument());
});

it('PPVC-1080: retreat search includes location without changing identity matching', async () => {
  await mountList();
  fireEvent.change(screen.getByRole('combobox', { name: 'Retreat' }), { target: { value: 'Liberec' } });
  expect(await retreatDropdownLabels()).toEqual(['MR2 · Mountain Retreat · 2027-02-10']);
});
