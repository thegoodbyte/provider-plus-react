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
  expect(update.mock.calls[0][1]).not.toHaveProperty('advisorDeliveryStatus');
});

test.each([['OK', 'approved'], ['NOT OK', 'rejected'], ['caution', 'caution'], ['more_info_needed', 'needs_resubmission'], ['WONT_DO', 'wont_do']])('records advisor result %s as %s', async (decision, status) => {
  update.mockResolvedValue({ data: request });
  render(<MedicalReviewWhatsAppForm request={request} advisors={advisors} onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('WhatsApp status'), { target: { value: 'responded' } });
  fireEvent.change(screen.getByLabelText('Advisor result'), { target: { value: decision } });
  fireEvent.click(screen.getByText('Save and return to list'));
  await waitFor(() => expect(update).toHaveBeenCalledWith('mrr1', expect.objectContaining({ whatsappStatus: 'responded', whatsappDecision: decision, reviewDecision: decision, status, reviewNotes: ({ OK: 'OK', 'NOT OK': 'NOT OK', caution: 'Caution', more_info_needed: 'More information needed', WONT_DO: 'Won’t do' } as any)[decision] + ' — medical advisor via WhatsApp' })));
  expect(update.mock.calls[0][1]).not.toHaveProperty('advisorDeliveryStatus');
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
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the WhatsApp status.');
  expect(onSaved).not.toHaveBeenCalled();
});

test('work-mode handoff uses the supplied save action without sending server-owned delivery fields', async () => {
  const save=jest.fn().mockResolvedValue(request);const saved=jest.fn();
  render(<MedicalReviewWhatsAppForm request={request} advisors={advisors} onClose={jest.fn()} onSaved={saved} workMode={{action:'sent',save}} />);
  fireEvent.click(screen.getByText('Record sent'));
  await waitFor(()=>expect(save).toHaveBeenCalledWith(expect.objectContaining({advisorId:'advisor1'})));
  expect(save.mock.calls[0][0]).not.toHaveProperty('advisorDeliveryStatus');expect(update).not.toHaveBeenCalled();
});

test('work-mode reply preserves the actual notes and delegation draft on a failed save',async()=>{
 const save=jest.fn().mockRejectedValue(new Error('offline'));
 render(<MedicalReviewWhatsAppForm request={{...request,whatsappSentAt:'2026-01-01'}} advisors={advisors} onClose={jest.fn()} onSaved={jest.fn()} workMode={{action:'reply',save}} />);
 fireEvent.change(screen.getByLabelText('Advisor result'),{target:{value:'more_info_needed'}});
 fireEvent.change(screen.getByLabelText('What did the advisor say?'),{target:{value:'Synthetic advisor requests further information'}});
 fireEvent.change(screen.getByLabelText('Reason for recording on behalf of the advisor'),{target:{value:'Transcribed actual advisor response'}});
 fireEvent.click(screen.getByText('Save advisor reply'));await screen.findByRole('alert');
 expect(screen.getByLabelText('What did the advisor say?')).toHaveValue('Synthetic advisor requests further information');
 expect(save).toHaveBeenCalledWith(expect.objectContaining({decision:'more_info_needed',delegationReason:'Transcribed actual advisor response'}));expect(update).not.toHaveBeenCalled();
});

test('reopens automatic notes as blank and uses the newly selected result instead of stale OK copy',async()=>{
 update.mockResolvedValue({data:request});render(<MedicalReviewWhatsAppForm request={{...request,reviewChannel:'whatsapp',whatsappStatus:'responded',whatsappDecision:'OK',reviewNotes:'OK — medical advisor via WhatsApp'}} advisors={advisors} onClose={jest.fn()} onSaved={jest.fn()}/>);
 expect(screen.getByLabelText('What did the advisor say?')).toHaveValue('');fireEvent.change(screen.getByLabelText('Advisor result'),{target:{value:'NOT OK'}});fireEvent.click(screen.getByText('Save and return to list'));await waitFor(()=>expect(update).toHaveBeenCalledWith('mrr1',expect.objectContaining({reviewDecision:'NOT OK',status:'rejected',reviewNotes:'NOT OK — medical advisor via WhatsApp'})));
});
