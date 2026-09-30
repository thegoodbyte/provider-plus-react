import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PortalContactSettings from './PortalContactSettings';
import { api } from '../services/api';
jest.mock('../services/api', () => ({ api: { get: jest.fn(), patch: jest.fn() } }));
const settings = { enabled: true, contactEmail: 'team@example.com', whatsappNumber: '', text: Object.fromEntries(['en', 'cs', 'pl'].map(lang => [lang, { title: `Title ${lang}`, timing: `Timing ${lang}`, contact: `Contact ${lang}`, urgent: `Urgent ${lang}` }])), topics: [{ id: 'document', en: 'Document', cs: 'Dokument', pl: 'Dokument' }] };
beforeEach(() => { jest.clearAllMocks(); (api.get as jest.Mock).mockResolvedValue({ data: settings }); (api.patch as jest.Mock).mockImplementation((_, body) => Promise.resolve({ data: body })); });
it('edits a translation without losing the other languages and saves contact settings', async () => {
  render(<PortalContactSettings />);
  fireEvent.change(await screen.findByLabelText('Editing language'), { target: { value: 'pl' } });
  fireEvent.change(screen.getByLabelText('Review timing and email updates'), { target: { value: 'Nowa wiadomość' } });
  fireEvent.change(screen.getByLabelText('Recipient email'), { target: { value: 'new@example.com' } });
  fireEvent.click(screen.getByText('Save medical contact settings'));
  expect(await screen.findByRole('status')).toHaveTextContent('saved');
  const body = (api.patch as jest.Mock).mock.calls[0][1];
  expect(body.text.pl.timing).toBe('Nowa wiadomość');
  expect(body.text.en.timing).toBe('Timing en');
  expect(body.contactEmail).toBe('new@example.com');
});
it('shows server validation errors instead of confirming an unsuccessful save', async () => {
  (api.patch as jest.Mock).mockRejectedValue({ response: { data: { message: 'Complete all translations.' } } });
  render(<PortalContactSettings />);
  fireEvent.click(await screen.findByText('Save medical contact settings'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Complete all translations');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
