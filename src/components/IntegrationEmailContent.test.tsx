import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import IntegrationEmailContent from './IntegrationEmailContent';
import { api } from '../services/api';
jest.mock('../services/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
const fixture = () => ({
  starter: { responseHours: { en: '', cz: '', pl: '' }, urgentHelp: { en: 'Urgent EN', cz: 'Urgent CZ', pl: 'Urgent PL' }, preferences: { en: 'Reply to pause', cz: 'CZ', pl: 'PL' }, sourceReference: 'source', capacityReviewed: false, portalLinkVerified: false },
  cadence: [{ title: 'Welcome', day: 1 }],
  templates: [{ _id: 'template', name: 'Welcome · en', subject: 'Welcome home', bodyText: 'Please reply.', active: false, language: 'en', integrationPolicyId: 'policy', updatedAt: '2026-10-12T12:00:00.000Z' }],
  policies: [{ _id: 'policy', name: 'Response policy', revision: 1, versions: [{ number: 1 }], clinicalReview: { actor: 'reviewer', at: '2026-10-12T12:00:00Z' }, draft: { responseHours: { en: 'Actual EN hours', cz: 'Actual CZ hours', pl: 'Actual PL hours' }, urgentHelp: { en: 'Urgent EN', cz: 'Urgent CZ', pl: 'Urgent PL' }, preferences: { en: 'Reply to pause', cz: 'CZ', pl: 'PL' }, sourceReference: 'source', capacityReviewed: true, portalLinkVerified: true } }],
});
beforeEach(() => { jest.clearAllMocks(); (api.get as jest.Mock).mockResolvedValue({ data: fixture() }); });
it('blocks publication of unsaved message text and retains the edited draft', async () => {
  render(<IntegrationEmailContent />);
  await screen.findByLabelText('Supportive message draft');
  fireEvent.change(screen.getByLabelText('Supportive message draft'), { target: { value: 'template' } });
  fireEvent.change(screen.getByLabelText('Author/source and translation review reference'), { target: { value: 'review' } });
  fireEvent.click(screen.getByLabelText('This exact message and translation reviewed'));
  expect(screen.getByRole('button', { name: 'Publish reviewed message translation' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Message body'), { target: { value: 'Changed draft to retain' } });
  fireEvent.click(screen.getByLabelText('This exact message and translation reviewed'));
  expect(screen.getByRole('button', { name: 'Publish reviewed message translation' })).toBeDisabled();
  expect(screen.getByLabelText('Message body')).toHaveValue('Changed draft to retain');
});
it('blocks publishing an unsaved response policy even when an older clinical review exists', async () => {
  render(<IntegrationEmailContent />); await screen.findByLabelText('Response policy');
  fireEvent.change(screen.getByLabelText('Response policy'), { target: { value: 'policy' } });
  expect(screen.getByRole('button', { name: 'Publish reviewed response policy' })).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Actual message response hours and expected reply target'), { target: { value: 'Changed hours' } });
  expect(screen.getByRole('button', { name: 'Publish reviewed response policy' })).toBeDisabled();
});
it('qualified-review mode displays all languages, hides staff publication and submits the saved revision', async () => {
  const data = fixture(); (api.post as jest.Mock).mockResolvedValue({ data: { ...data.policies[0], revision: 2 } });
  render(<IntegrationEmailContent reviewOnly />); await screen.findByLabelText('Response policy');
  fireEvent.change(screen.getByLabelText('Response policy'), { target: { value: 'policy' } });
  expect(screen.getByText(/Actual CZ hours/)).toBeInTheDocument(); expect(screen.getByText(/Urgent PL/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Publish reviewed response policy' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Qualified review evidence'), { target: { value: 'Reviewed translations' } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve reviewed urgent-help translations' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/integration/email-content/policies/policy/clinical-review', { expectedRevision: 1, reviewed: true, evidence: 'Reviewed translations' }));
});
