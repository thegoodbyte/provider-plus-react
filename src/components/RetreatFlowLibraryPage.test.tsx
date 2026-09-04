import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { bookingFlowApi, communicationsApi, retreatsApi } from '../services/api';
import RetreatFlowLibraryPage from './RetreatFlowLibraryPage';

jest.mock('../services/api', () => ({
  bookingFlowApi: {
    getLibraryTemplates: jest.fn(),
    updateLibraryTemplate: jest.fn(),
    createLibraryTemplate: jest.fn(),
  },
  retreatsApi: { getAll: jest.fn() },
  communicationsApi: { getTemplates: jest.fn() },
}));

const template = (overrides: any = {}) => ({
  _id: 't1', key: 'entry_ekg_received', title: 'Entry EKG received', category: 'medical',
  workflowStage: 'medical', offsetDays: 21, order: 60, active: true,
  clientFacingName: { en: 'EKG Test', pl: 'Badanie EKG', cz: '' },
  clientFacingDescription: { en: 'Upload your EKG results.', pl: 'Prześlij wyniki badania EKG.', cz: '' },
  ...overrides,
});

describe('RetreatFlowLibraryPage client-facing name/description language tabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (bookingFlowApi.getLibraryTemplates as jest.Mock).mockResolvedValue({ data: [template()] });
    (retreatsApi.getAll as jest.Mock).mockResolvedValue({ data: [] });
    (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({ data: [] });
    (bookingFlowApi.updateLibraryTemplate as jest.Mock).mockResolvedValue({ data: template() });
  });

  const view = () => render(<MemoryRouter><RetreatFlowLibraryPage /></MemoryRouter>);

  it('shows the English client-facing name/description by default, and Polish after switching the language tab', async () => {
    view();

    const nameField = await screen.findByPlaceholderText('Short, friendly label the client sees') as HTMLTextAreaElement;
    const descriptionField = screen.getByPlaceholderText('Tell the client what to do and why') as HTMLTextAreaElement;

    expect(nameField.value).toBe('EKG Test');
    expect(descriptionField.value).toBe('Upload your EKG results.');

    fireEvent.click(await screen.findByRole('tab', { name: 'PL' }));

    expect(nameField.value).toBe('Badanie EKG');
    expect(descriptionField.value).toBe('Prześlij wyniki badania EKG.');
  });

  it('clearly marks the step currently open in the editor', async () => {
    view();

    const selectedStep = await screen.findByRole('button', { name: /Entry EKG received/ });
    expect(selectedStep).toHaveAttribute('aria-current', 'true');
    expect(selectedStep).toHaveTextContent('EDITING');
    expect(selectedStep).toHaveStyle({ backgroundColor: '#e0f2fe' });
  });

  it('editing one language does not clobber the others, and saves the full nested object', async () => {
    view();

    fireEvent.click(await screen.findByRole('tab', { name: 'PL' }));
    const nameField = screen.getByPlaceholderText('Short, friendly label the client sees') as HTMLTextAreaElement;
    fireEvent.change(nameField, { target: { value: 'Zaktualizowane badanie EKG' } });

    fireEvent.click(screen.getByRole('tab', { name: 'EN' }));
    expect((screen.getByPlaceholderText('Short, friendly label the client sees') as HTMLTextAreaElement).value).toBe('EKG Test');

    fireEvent.click(screen.getByText('Save step'));

    await waitFor(() => expect(bookingFlowApi.updateLibraryTemplate).toHaveBeenCalled());
    const [, payload]: any = (bookingFlowApi.updateLibraryTemplate as jest.Mock).mock.calls[0];
    expect(payload.clientFacingName).toEqual({ en: 'EKG Test', pl: 'Zaktualizowane badanie EKG', cz: '' });
    expect(payload.clientFacingDescription).toEqual({ en: 'Upload your EKG results.', pl: 'Prześlij wyniki badania EKG.', cz: '' });
  });
});
