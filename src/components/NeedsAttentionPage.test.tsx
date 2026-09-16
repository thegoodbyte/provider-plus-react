import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NeedsAttentionPage from './NeedsAttentionPage';
import { bookingDocumentsApi, bookingFlowApi, medicalReviewRequestsApi, paymentRequestsApi, remindersApi } from '../services/api';
jest.mock('../services/api', () => ({
  bookingDocumentsApi: { getAll: jest.fn() }, bookingFlowApi: { getItems: jest.fn() },
  medicalReviewRequestsApi: { getAll: jest.fn() }, paymentRequestsApi: { getAllFresh: jest.fn() }, remindersApi: { getPending: jest.fn() },
}));
const sources = [bookingFlowApi.getItems, bookingDocumentsApi.getAll, paymentRequestsApi.getAllFresh, medicalReviewRequestsApi.getAll, remindersApi.getPending] as jest.Mock[];
const labels = ['Booking steps / Contracts', 'Documents / Contracts', 'Payments', 'Medical reviews', 'Follow-ups'];
const view = () => render(<MemoryRouter><NeedsAttentionPage /></MemoryRouter>);
beforeEach(() => { jest.resetAllMocks(); sources.forEach(fn => fn.mockResolvedValue({ data: [] })); });

test('successful empty results show a confirmed empty state', async () => {
  view();
  expect(await screen.findByText('No open items match the current filters.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each(labels.map((label, index) => [label, index] as const))('identifies unavailable %s and recovers on retry', async (label, index) => {
  sources[index].mockRejectedValue(new Error('Offline'));
  view();
  expect(await screen.findByRole('alert')).toHaveTextContent(label);
  expect(screen.queryByText('No open items match the current filters.')).not.toBeInTheDocument();
  sources[index].mockResolvedValue({ data: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Retry unavailable data' }));
  await waitFor(() => expect(screen.queryByText('Loading attention items…')).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText('No open items match the current filters.')).toBeInTheDocument();
});

test('keeps successful categories usable and preserves filters during retry', async () => {
  sources[0].mockResolvedValue({ data: [{ _id: 's1', title: 'Upload agreement', status: 'pending' }] });
  sources[2].mockRejectedValue(new Error('Offline'));
  view();
  await screen.findByRole('alert');
  expect(screen.getByText('Upload agreement')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open' })).toBeEnabled();
  fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'agreement' } });
  sources[2].mockResolvedValue({ data: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Retry unavailable data' }));
  await waitFor(() => expect(screen.queryByText('Loading attention items…')).not.toBeInTheDocument());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('agreement');
  expect(screen.getByText('Upload agreement')).toBeInTheDocument();
});

test('complete refresh failure removes stale rows and does not claim zero open work', async () => {
  sources[0].mockResolvedValue({ data: [{ _id: 's1', title: 'Upload agreement', status: 'pending' }] });
  view();
  await screen.findByText('Upload agreement');
  sources.forEach(fn => fn.mockRejectedValue(new Error('Offline')));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  const alert = await screen.findByRole('alert');
  labels.forEach(label => expect(alert).toHaveTextContent(label));
  expect(screen.queryByText('Upload agreement')).not.toBeInTheDocument();
  expect(screen.queryByText('No open items match the current filters.')).not.toBeInTheDocument();
  expect(screen.getAllByText('—')).toHaveLength(4);
});
