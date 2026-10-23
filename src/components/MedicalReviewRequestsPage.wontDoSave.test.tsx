import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MedicalReviewRequestsPage from './MedicalReviewRequestsPage';
import { medicalReviewRequestsApi, usersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/api', () => ({
  medicalArtifactsApi: {},
  medicalReviewRequestsApi: { update: jest.fn(), review: jest.fn(), getAll: jest.fn(), getQueue: jest.fn(), getContext: jest.fn(), getAccessLinks: jest.fn(), getClientMessages: jest.fn() },
  usersApi: { findAll: jest.fn() },
}));

// PPVC-916: the detail-view review-action panels gate the Save button on a
// won't-do reason being picked, but were missing the control to pick one --
// making Save permanently disabled once "Won't do" is selected. Covers both
// the desktop canvas panel and the mobile panel, since each is a separate
// render path with its own copy of the same decision buttons/Save button.
const renderDetailView = async (request: any) => {
  (useAuth as jest.Mock).mockReturnValue({ user: { role: 'admin', email: 'staff@example.invalid' } });
  (medicalReviewRequestsApi.getAll as jest.Mock).mockResolvedValue({ data: [request] });
  (medicalReviewRequestsApi.getContext as jest.Mock).mockResolvedValue({ data: { artifacts: { all: [] } } });
  (medicalReviewRequestsApi.getAccessLinks as jest.Mock).mockResolvedValue({ data: [] });
  (medicalReviewRequestsApi.getClientMessages as jest.Mock).mockResolvedValue({ data: { messages: [], skippedNotifications: [] } });
  (medicalReviewRequestsApi.review as jest.Mock).mockResolvedValue({ data: request });
  (usersApi.findAll as jest.Mock).mockResolvedValue({ data: [] });
  render(<MemoryRouter initialEntries={[`/admin/medical-review-requests/${request._id}`]}><Routes><Route path='/admin/medical-review-requests/:id' element={<MedicalReviewRequestsPage />} /></Routes></MemoryRouter>);
  return waitFor(() => { const el = document.querySelector('.mrr-canvas-actions'); if (!el) throw new Error('not ready'); return el as HTMLElement; });
};

it("PPVC-916: enables and saves the desktop canvas Save button once a won't-do reason is picked", async () => {
  const request: any = { _id: 'mrr-wontdo-desktop', display_id: 1500, status: 'pending', requestType: 'ekg_review', clientId: { _id: 'client-2', firstName: 'Test', lastName: 'Client' }, artifactIds: [] };
  const canvas = await renderDetailView(request);
  fireEvent.click(within(canvas).getByRole('button', { name: "Won't do" }));
  const saveButton = within(canvas).getByRole('button', { name: 'Save review' });
  expect(saveButton).toBeDisabled();
  fireEvent.change(within(canvas).getByLabelText('Why won’t we do this?'), { target: { value: 'duplicate' } });
  expect(saveButton).toBeEnabled();
  fireEvent.click(saveButton);
  await waitFor(() => expect(medicalReviewRequestsApi.review).toHaveBeenCalledWith('mrr-wontdo-desktop', expect.objectContaining({ wontDoReason: 'duplicate' })));
});

it("PPVC-916: requires the explanation note when the won't-do reason is \"other\"", async () => {
  const request: any = { _id: 'mrr-wontdo-other', display_id: 1501, status: 'pending', requestType: 'ekg_review', clientId: { _id: 'client-3', firstName: 'Test', lastName: 'Client' }, artifactIds: [] };
  const canvas = await renderDetailView(request);
  fireEvent.click(within(canvas).getByRole('button', { name: "Won't do" }));
  fireEvent.change(within(canvas).getByLabelText('Why won’t we do this?'), { target: { value: 'other' } });
  const saveButton = within(canvas).getByRole('button', { name: 'Save review' });
  expect(saveButton).toBeEnabled();
  fireEvent.click(saveButton);
  expect(medicalReviewRequestsApi.review).not.toHaveBeenCalled();
  fireEvent.change(within(canvas).getByPlaceholderText('Explain why this will not be done'), { target: { value: 'Not a valid case.' } });
  fireEvent.click(saveButton);
  await waitFor(() => expect(medicalReviewRequestsApi.review).toHaveBeenCalledWith('mrr-wontdo-other', expect.objectContaining({ wontDoReason: 'other', wontDoNote: 'Not a valid case.' })));
});

it("PPVC-916: enables the mobile panel's Save review button once a won't-do reason is picked", async () => {
  const request: any = { _id: 'mrr-wontdo-mobile', display_id: 1502, status: 'pending', requestType: 'ekg_review', clientId: { _id: 'client-4', firstName: 'Test', lastName: 'Client' }, artifactIds: [] };
  await renderDetailView(request);
  const mobilePanel = document.querySelector('.mrr-mobile-review-section') as HTMLElement;
  fireEvent.click(within(mobilePanel).getByRole('button', { name: "Won't do" }));
  const saveButton = within(mobilePanel).getByRole('button', { name: 'Save review' });
  expect(saveButton).toBeDisabled();
  fireEvent.change(within(mobilePanel).getByLabelText('Why won’t we do this?'), { target: { value: 'not_relevant' } });
  expect(saveButton).toBeEnabled();
  fireEvent.click(saveButton);
  await waitFor(() => expect(medicalReviewRequestsApi.review).toHaveBeenCalledWith('mrr-wontdo-mobile', expect.objectContaining({ wontDoReason: 'not_relevant' })));
});
