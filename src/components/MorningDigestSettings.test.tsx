import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MorningDigestSettings from './MorningDigestSettings';
import { morningDigestApi } from '../services/api';
import { authService } from '../services/authService';
jest.mock('../services/api', () => ({ morningDigestApi: { get: jest.fn(), save: jest.fn(), preview: jest.fn() } }));
jest.mock('../services/authService', () => ({ authService: { getUser: jest.fn() } }));
const settings = { enabled: false, recipients: ['ops@example.invalid'], areas: ['submissions'], upcomingDays: 60 };
beforeEach(() => {
  jest.clearAllMocks();
  (authService.getUser as jest.Mock).mockReturnValue({ role: 'admin' });
  (morningDigestApi.get as jest.Mock).mockResolvedValue({ data: settings });
  (morningDigestApi.save as jest.Mock).mockImplementation(async body => ({ data: body }));
  (morningDigestApi.preview as jest.Mock).mockResolvedValue({ data: { sections: [{ key: 'submissions', title: 'IR submissions', count: 1, items: ['Task #123'] }] } });
});
test('saves recipients, selected areas and horizon; preview is read-only', async () => {
  render(<MorningDigestSettings />);
  fireEvent.click(await screen.findByLabelText('Enable daily digest'));
  fireEvent.change(screen.getByLabelText('Recipients'), { target: { value: 'ops@example.invalid, second@example.invalid' } });
  fireEvent.click(screen.getByLabelText('Pending medical reviews'));
  fireEvent.change(screen.getByLabelText('Upcoming retreats (days)'), { target: { value: '30' } });
  fireEvent.click(screen.getByText('Save digest settings'));
  await screen.findByText('Morning digest settings saved.');
  expect(morningDigestApi.save).toHaveBeenCalledWith({ enabled: true, recipients: ['ops@example.invalid', 'second@example.invalid'], areas: ['submissions', 'medicalReviews'], upcomingDays: 30 });
  fireEvent.click(screen.getByText('Preview saved settings'));
  await screen.findByText('Task #123');
  expect(morningDigestApi.preview).toHaveBeenCalledTimes(1);
  expect(morningDigestApi.save).toHaveBeenCalledTimes(1);
});
test('does not load settings for non-admin', () => {
  (authService.getUser as jest.Mock).mockReturnValue({ role: 'helper' });
  render(<MorningDigestSettings />);
  expect(screen.getByText('Only administrators can configure the digest.')).toBeInTheDocument();
  expect(morningDigestApi.get).not.toHaveBeenCalled();
});
test('save failure remains visible without claiming success', async () => {
  (morningDigestApi.save as jest.Mock).mockRejectedValue({ response: { data: { message: 'Enter valid recipients' } } });
  render(<MorningDigestSettings />);
  fireEvent.click(await screen.findByText('Save digest settings'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Enter valid recipients'));
  expect(screen.queryByText('Morning digest settings saved.')).not.toBeInTheDocument();
});
