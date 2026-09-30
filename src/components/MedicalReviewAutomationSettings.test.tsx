import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MedicalReviewAutomationSettings from './MedicalReviewAutomationSettings';
import { medicalReviewAutomationApi, medicalReviewRequestsApi, usersApi } from '../services/api';
import { authService } from '../services/authService';
jest.mock('../services/api', () => ({ medicalReviewAutomationApi: { get: jest.fn(), save: jest.fn() }, medicalReviewRequestsApi: { getGroups: jest.fn() }, usersApi: { findAll: jest.fn() } }));
jest.mock('../services/authService', () => ({ authService: { getUser: jest.fn() } }));
const types = [{ key: 'ekg', label: 'EKG', requestType: 'ekg_review' }, { key: 'medications_form', label: 'Medication forms', requestType: 'medications_review' }];
beforeEach(() => {
  jest.clearAllMocks();
  (authService.getUser as jest.Mock).mockReturnValue({ role: 'admin' });
  (medicalReviewAutomationApi.get as jest.Mock).mockResolvedValue({ data: { artifactTypes: types, rules: [] } });
  (medicalReviewAutomationApi.save as jest.Mock).mockImplementation(async data => ({ data }));
  (usersApi.findAll as jest.Mock).mockResolvedValue({ data: [{ _id: 'advisor', role: 'medical_advisor', firstName: 'Anna', preferredReviewLanguage: 'pl' }] });
  (medicalReviewRequestsApi.getGroups as jest.Mock).mockResolvedValue({ data: [{ _id: 'packet', title: 'Reviews', reviewerUserId: 'advisor', groupType: 'custom', endDate: '2099-01-01' }] });
});
it('configures different source/type rules without overwriting each other', async () => {
  render(<MedicalReviewAutomationSettings />);
  await screen.findByRole('button', { name: 'EKG' });
  fireEvent.click(screen.getByLabelText('Enable IbogaReady automatic MRRs'));
  fireEvent.change(screen.getByLabelText('IbogaReady default advisor'), { target: { value: 'advisor' } });
  fireEvent.change(screen.getByLabelText('IbogaReady admin emails'), { target: { value: 'admin@example.com' } });
  expect(screen.getByText(/Review language: Polish/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Medication forms' }));
  expect(screen.getByLabelText('Enable IbogaReady automatic MRRs')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Enable Website automatic MRRs'));
  fireEvent.change(screen.getByLabelText('Website default advisor'), { target: { value: 'advisor' } });
  fireEvent.click(screen.getByLabelText('Website: Email admin when an MRR is created'));
  fireEvent.click(screen.getByRole('button', { name: 'Save review automation' }));
  await waitFor(() => expect(medicalReviewAutomationApi.save).toHaveBeenCalledWith(expect.objectContaining({ rules: expect.arrayContaining([
    expect.objectContaining({ source: 'ir', artifactType: 'ekg', enabled: true, advisorUserId: 'advisor' }),
    expect.objectContaining({ source: 'website', artifactType: 'medications_form', enabled: true, notifyAdmin: false }),
  ]) })));
});
it('adds a new artifact type with automation off and editable review mapping', async () => {
  render(<MedicalReviewAutomationSettings />); await screen.findByRole('button', { name: 'EKG' });
  fireEvent.change(screen.getByLabelText('New artifact key'), { target: { value: 'specialist_report' } });
  fireEvent.change(screen.getByLabelText('New artifact label'), { target: { value: 'Specialist report' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add artifact type' }));
  expect(screen.getByRole('button', { name: 'Specialist report' })).toBeInTheDocument();
  expect(screen.getByLabelText('Enable IbogaReady automatic MRRs')).not.toBeChecked();
  expect(screen.getByLabelText('Medical review type')).toHaveValue('general_clearance');
  fireEvent.click(screen.getByRole('button', { name: 'Save review automation' }));
  await waitFor(() => expect(medicalReviewAutomationApi.save).toHaveBeenCalledWith(expect.objectContaining({ artifactTypes: expect.arrayContaining([{ key: 'specialist_report', label: 'Specialist report', requestType: 'general_clearance' }]) })));
});
it('limits settings to admins and displays load failures', async () => {
  (authService.getUser as jest.Mock).mockReturnValue({ role: 'user' });
  const page = render(<MedicalReviewAutomationSettings />);
  expect(medicalReviewAutomationApi.get).not.toHaveBeenCalled(); page.unmount();
  (authService.getUser as jest.Mock).mockReturnValue({ role: 'admin' });
  (medicalReviewAutomationApi.get as jest.Mock).mockRejectedValue(new Error('offline'));
  render(<MedicalReviewAutomationSettings />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
  expect(screen.queryByRole('button', { name: 'Save review automation' })).not.toBeInTheDocument();
});
