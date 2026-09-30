import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MedicalReviewWhatsAppForm from './MedicalReviewWhatsAppForm';
import { medicalReviewRequestsApi } from '../services/api';
jest.mock('../services/api', () => ({ medicalReviewRequestsApi: { update: jest.fn() } }));
jest.mock('./ResponsiveModal', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
const update = medicalReviewRequestsApi.update as jest.Mock;
const request: any = { _id: 'mrr1', display_id: 123, status: 'pending', assignedToUserId: 'advisor1' };
const advisors: any = [{ _id: 'advisor1', firstName: 'Medical', lastName: 'Advisor' }];
beforeEach(() => jest.clearAllMocks());

test('records waiting without marking the review approved and returns saved data', async () => {
  const onSaved = jest.fn();
  update.mockResolvedValue({ data: { ...request, status: 'awaiting_whatsapp' } });
  render(<MedicalReviewWhatsAppForm request={request} advisors={advisors} onClose={jest.fn()} onSaved={onSaved} />);
  fireEvent.click(screen.getByText('Save and return to list'));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(update).toHaveBeenCalledWith('mrr1', expect.objectContaining({ whatsappAdvisorUserId: 'advisor1', whatsappStatus: 'awaiting_response', status: 'awaiting_whatsapp' }));
  expect(update.mock.calls[0][1]).not.toHaveProperty('reviewDecision');
});

test.each([['OK', 'approved'], ['NOT OK', 'rejected'], ['caution', 'caution'], ['more_info_needed', 'needs_resubmission'], ['WONT_DO', 'wont_do']])('records advisor result %s as %s', async (decision, status) => {
  update.mockResolvedValue({ data: request });
  render(<MedicalReviewWhatsAppForm request={request} advisors={advisors} onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('WhatsApp status'), { target: { value: 'responded' } });
  fireEvent.change(screen.getByLabelText('Advisor result'), { target: { value: decision } });
  fireEvent.click(screen.getByText('Save and return to list'));
  await waitFor(() => expect(update).toHaveBeenCalledWith('mrr1', expect.objectContaining({ whatsappStatus: 'responded', whatsappDecision: decision, reviewDecision: decision, status, reviewNotes: 'Advisor response received via WhatsApp' })));
});

test('saves the entered advisor note as the MRR review notes (PPVC-690)', async () => {
  update.mockResolvedValue({ data: request });
  render(<MedicalReviewWhatsAppForm request={request} advisors={advisors} onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('WhatsApp status'), { target: { value: 'responded' } });
  fireEvent.change(screen.getByLabelText('Advisor result'), { target: { value: 'OK' } });
  fireEvent.change(screen.getByLabelText("What did the advisor say?"), { target: { value: 'EKG looks fine, cleared to proceed.' } });
  fireEvent.click(screen.getByText('Save and return to list'));
  await waitFor(() => expect(update).toHaveBeenCalledWith('mrr1', expect.objectContaining({ reviewNotes: 'EKG looks fine, cleared to proceed.' })));
});

test('pre-fills the advisor note field from any existing review notes when editing a previously saved response', () => {
  render(<MedicalReviewWhatsAppForm request={{ ...request, whatsappStatus: 'responded', reviewNotes: 'Already recorded note' }} advisors={advisors} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(screen.getByLabelText("What did the advisor say?")).toHaveValue('Already recorded note');
});

test('keeps dialog open and displays a failed save for retry', async () => {
  update.mockRejectedValue(new Error('offline'));
  const onSaved = jest.fn();
  render(<MedicalReviewWhatsAppForm request={request} advisors={advisors} onClose={jest.fn()} onSaved={onSaved} />);
  fireEvent.click(screen.getByText('Save and return to list'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save WhatsApp status');
  expect(onSaved).not.toHaveBeenCalled();
});
