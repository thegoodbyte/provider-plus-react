import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import RetreatDetailView from './RetreatDetailView';
import { communicationsApi, retreatsApi, bookingsApi, retreatExpensesApi, paymentsApi, bookingFlowApi } from '../services/api';

jest.mock('../services/authService', () => ({ authService: { getUser: () => ({ role: 'admin' }) } }));
jest.mock('../services/api', () => ({
  retreatsApi: { getOne: jest.fn(async () => ({ data: { _id: 'r1', name: 'Fixture retreat', code: 'FIXTURE', currency: 'EUR' } })), getAll: jest.fn(async () => ({ data: [] })) },
  bookingsApi: { getByRetreatWithDetails: jest.fn(async () => ({ data: [{ _id: 'b1', clientId: { _id: 'c1', firstName: 'Alex', lastName: 'Fixture', email: 'alex@example.test' }, status: 'confirmed', currency: 'EUR', totalAmount: 0 }] })) },
  retreatExpensesApi: { getRetreatSummary: jest.fn(async () => ({ data: { totalExpenses: 0, categories: [] } })) },
  paymentsApi: { getByBooking: jest.fn(async () => ({ data: [] })) },
  clientsApi: {},
  bookingFlowApi: { getTemplates: jest.fn(async () => ({ data: [] })) },
  communicationsApi: { getTemplates: jest.fn(), getAssets: jest.fn(async () => ({ data: [] })), previewEmail: jest.fn(), translateRetreatMessage: jest.fn(), sendRetreatEmail: jest.fn() },
}));
jest.mock('./retreatUsdTotals', () => ({ quoteBookingUsd: async () => 0, retreatExpectedUsd: () => 0 }));
jest.mock('./ExpensesTab', () => () => null);
jest.mock('./PaymentsTab', () => () => null);
jest.mock('./ClientDetailView', () => () => null);
jest.mock('./CeremoniesGrid', () => () => null);
jest.mock('./SearchableClientSelector', () => () => null);
jest.mock('./RetreatTrackingGrid', () => () => null);
jest.mock('./FoodMatrixGrid', () => () => null);
jest.mock('./RetreatAiSummaryTab', () => () => null);
jest.mock('./DrugScreeningTab', () => () => null);
jest.mock('./BookingStepsMatrix', () => () => null);
jest.mock('./RetreatReserveListPanel', () => () => null);
jest.mock('./RoomAllocationBoard', () => () => null);
jest.mock('./Tasks/TasksWidget', () => ({ TasksWidget: () => null }));

// jsdom lacks the browser MessageChannel used by Ant Design's form watchers.
class FormMessageChannel {
  port1 = { onmessage: null as null | (() => void), close: () => {} };
  port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0), close: () => {} };
}
(globalThis as any).MessageChannel = FormMessageChannel;
(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });

// Exercise the real Ant Design form and modal without generating runtime CSS
// or waiting for decorative motion in jsdom. Visual styling is covered by
// browser tests; all input, validation and email API assertions remain real.
const testTheme = { zeroRuntime: true, token: { motion: false } };

const template = { _id: 't1', name: 'Arrival fixture', language: 'en', subject: 'Template subject', bodyText: 'Template message', bodyHtml: '<p>Template message</p>' };
async function openComposer() {
  render(
    <ConfigProvider theme={testTheme}>
      <MemoryRouter>
        <RetreatDetailView retreatId="r1" onBack={jest.fn()} />
      </MemoryRouter>
    </ConfigProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Email retreat clients (1)' }));
  await screen.findByRole('dialog');
  await waitFor(() => expect(communicationsApi.getTemplates).toHaveBeenCalled());
  return { subject: screen.getByLabelText('Subject'), body: screen.getByLabelText('Message') };
}
async function selectTemplate() {
  fireEvent.mouseDown(screen.getByLabelText('Template'));
  fireEvent.click(await screen.findByText('Arrival fixture · EN'));
}

describe('Retreat group email composing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (retreatsApi.getOne as jest.Mock).mockResolvedValue({ data: { _id: 'r1', name: 'Fixture retreat', code: 'FIXTURE', currency: 'EUR' } });
    (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (bookingsApi.getByRetreatWithDetails as jest.Mock).mockResolvedValue({ data: [{ _id: 'b1', clientId: { _id: 'c1', firstName: 'Alex', lastName: 'Fixture', email: 'alex@example.test' }, status: 'confirmed', currency: 'EUR', totalAmount: 0 }] });
    (retreatExpensesApi.getRetreatSummary as jest.Mock).mockResolvedValue({ data: { totalExpenses: 0, categories: [] } });
    (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({ data: [] });
    (bookingFlowApi.getTemplates as jest.Mock).mockResolvedValue({ data: [] });
    (communicationsApi.getAssets as jest.Mock).mockResolvedValue({ data: [] });
    (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({ data: [template] });
    (communicationsApi.previewEmail as jest.Mock).mockResolvedValue({ data: { subject: 'Rendered subject', bodyText: 'Rendered message', bodyHtml: '<p>Rendered message</p>' } });
    (communicationsApi.sendRetreatEmail as jest.Mock).mockResolvedValue({ data: { sent: 1, failed: 0, skipped: 0 } });
  });
  it('edits and sends a custom subject/message without a template or recipient-language variants', async () => {
    const { subject, body } = await openComposer();
    expect(subject).not.toHaveAttribute('readonly');
    await waitFor(() => expect(body).not.toHaveAttribute('readonly'));
    fireEvent.change(subject, { target: { value: 'Custom retreat update' } });
    fireEvent.change(body, { target: { value: 'Please arrive at 5 pm.' } });
    expect(communicationsApi.sendRetreatEmail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send to 1' }));
    await waitFor(() => expect(communicationsApi.sendRetreatEmail).toHaveBeenCalledWith('r1', expect.objectContaining({ templateId: undefined, useRecipientLanguage: false, subject: 'Custom retreat update', bodyText: 'Please arrive at 5 pm.', bodyHtml: '', excludedClientIds: [] })));
  });
  it('keeps localized template content locked but permits edits when recipient-language mode is turned off', async () => {
    const { subject, body } = await openComposer();
    await selectTemplate();
    await waitFor(() => expect(body).toHaveValue('Rendered message'));
    expect(subject).toHaveAttribute('readonly');
    expect(body).toHaveAttribute('readonly');
    fireEvent.click(screen.getByLabelText('Use each recipient’s preferred language'));
    await waitFor(() => expect(body).not.toHaveAttribute('readonly'));
    fireEvent.change(body, { target: { value: 'Edited template message' } });
    await waitFor(() => expect(screen.queryByTitle('Retreat email HTML preview')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Send to 1' }));
    await waitFor(() => expect(communicationsApi.sendRetreatEmail).toHaveBeenCalledWith('r1', expect.objectContaining({ templateId: 't1', useRecipientLanguage: false, bodyText: 'Edited template message', bodyHtml: '' })));
  });
  it('clears a template without losing the subject/message and unlocks custom editing', async () => {
    const { subject, body } = await openComposer();
    await selectTemplate();
    await waitFor(() => expect(body).toHaveValue('Rendered message'));
    fireEvent.mouseDown(document.querySelector('.ant-select-clear')!);
    expect(subject).toHaveValue('Rendered subject');
    expect(body).toHaveValue('Rendered message');
    await waitFor(() => expect(body).not.toHaveAttribute('readonly'));
    fireEvent.change(body, { target: { value: 'Custom after clearing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send to 1' }));
    await waitFor(() => expect(communicationsApi.sendRetreatEmail).toHaveBeenCalledWith('r1', expect.objectContaining({ templateId: undefined, useRecipientLanguage: false, bodyText: 'Custom after clearing', bodyHtml: '' })));
  });
  it('does not let a delayed template preview overwrite a custom draft after clearing', async () => {
    let resolve!: (value: any) => void;
    (communicationsApi.previewEmail as jest.Mock).mockImplementation(() => new Promise(r => { resolve = r; }));
    const { body } = await openComposer();
    await selectTemplate();
    await waitFor(() => expect(communicationsApi.previewEmail).toHaveBeenCalled());
    fireEvent.mouseDown(document.querySelector('.ant-select-clear')!);
    fireEvent.change(body, { target: { value: 'Keep this custom draft' } });
    await act(async () => resolve({ data: { subject: 'Stale preview', bodyText: 'Stale preview', bodyHtml: '<p>Stale</p>' } }));
    expect(body).toHaveValue('Keep this custom draft');
  });
  it('prepares reviewed AI variants and sends each client their preferred language without a template', async () => {
    const variants = { en: { subject: 'Update', bodyText: 'Arrive at 5 pm.', bodyHtml: '' }, cz: { subject: 'Informace', bodyText: 'Přijeďte v 17 hodin.', bodyHtml: '' }, pl: { subject: 'Informacja', bodyText: 'Przyjedź o 17.', bodyHtml: '' } };
    (communicationsApi.translateRetreatMessage as jest.Mock).mockResolvedValue({ data: { languageVariants: variants } });
    const { subject, body } = await openComposer();
    fireEvent.change(subject, { target: { value: 'Update' } });
    fireEvent.change(body, { target: { value: 'Arrive at 5 pm.' } });
    fireEvent.click(screen.getByLabelText('Translate custom message for each recipient with AI'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to 1' })).toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Prepare translations' }));
    await screen.findByLabelText('AI translation previews');
    expect(communicationsApi.translateRetreatMessage).toHaveBeenCalledWith({ subject: 'Update', bodyText: 'Arrive at 5 pm.' });
    expect(communicationsApi.sendRetreatEmail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send to 1' }));
    await waitFor(() => expect(communicationsApi.sendRetreatEmail).toHaveBeenCalledWith('r1', expect.objectContaining({ templateId: undefined, useRecipientLanguage: true, plainTextOnly: true, languageVariants: variants })));
  });
  it('requires fresh translations after editing a prepared custom message', async () => {
    (communicationsApi.translateRetreatMessage as jest.Mock).mockResolvedValue({ data: { languageVariants: Object.fromEntries(['en', 'cz', 'pl'].map(language => [language, { subject: 'Update', bodyText: 'Original message', bodyHtml: '' }])) } });
    const { body } = await openComposer();
    fireEvent.change(body, { target: { value: 'Original message' } });
    fireEvent.click(screen.getByLabelText('Translate custom message for each recipient with AI'));
    await screen.findByRole('button', { name: 'Prepare translations' });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare translations' }));
    await screen.findByLabelText('AI translation previews');
    fireEvent.change(body, { target: { value: 'Updated message' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to 1' })).toBeDisabled());
    expect(communicationsApi.sendRetreatEmail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Translate custom message for each recipient with AI'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send to 1' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Send to 1' }));
    await waitFor(() => expect(communicationsApi.sendRetreatEmail).toHaveBeenCalledWith('r1', expect.objectContaining({ useRecipientLanguage: false, bodyText: 'Updated message' })));
    expect((communicationsApi.sendRetreatEmail as jest.Mock).mock.calls[0][1]).not.toHaveProperty('languageVariants');
  });
  it('keeps the custom draft and prevents sending if AI translation fails', async () => {
    (communicationsApi.translateRetreatMessage as jest.Mock).mockRejectedValue(new Error('AI unavailable'));
    const { body } = await openComposer();
    fireEvent.change(body, { target: { value: 'Keep my draft' } });
    fireEvent.click(screen.getByLabelText('Translate custom message for each recipient with AI'));
    await screen.findByRole('button', { name: 'Prepare translations' });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare translations' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('AI unavailable');
    expect(body).toHaveValue('Keep my draft');
    expect(screen.getByRole('button', { name: 'Send to 1' })).toBeDisabled();
    expect(communicationsApi.sendRetreatEmail).not.toHaveBeenCalled();
  });

});
