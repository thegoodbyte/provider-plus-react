import { fireEvent, render, screen } from '@testing-library/react';
import FormsInvitation from './FormsInvitation';
import { communicationsApi } from '../services/api';
jest.mock('../services/api', () => ({ communicationsApi: { getTemplates: jest.fn(), previewEmail: jest.fn() } }));
jest.mock('./EmailComposeModal', () => ({ __esModule: true, default: ({ initialValues }: any) => <div role="dialog">{initialValues.to} {initialValues.templateId} {initialValues.bodyText}</div> }));
const client = { _id: 'client-1', email: 'test@example.test', loginPin: '654321' };
beforeEach(() => jest.clearAllMocks());
it.each([['en','en'],['cs','cz'],['cz','cz'],['pl','pl'],['unknown','en']])('prepares %s using %s without sending', async (language, expected) => {
  (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({ data: ['en','cz','pl'].map(language => ({ _id: language, language, active: true, templateKey: 'prospect_forms_invitation' })) });
  (communicationsApi.previewEmail as jest.Mock).mockResolvedValue({ data: { subject: 'Welcome', bodyText: 'Completed preview', variables: {} } });
  render(<FormsInvitation client={{ ...client, language }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Send forms invitation' }));
  expect(await screen.findByRole('dialog')).toHaveTextContent(expected);
  expect(communicationsApi.previewEmail).toHaveBeenCalledWith({ templateId: expected, clientId: 'client-1' });
});
it('respects disabled templates', async () => {
  (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({ data: [{ _id: 'en', language: 'en', active: false, templateKey: 'prospect_forms_invitation' }] });
  render(<FormsInvitation client={client} />);
  fireEvent.click(screen.getByRole('button', { name: 'Send forms invitation' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('template is unavailable');
  expect(communicationsApi.previewEmail).not.toHaveBeenCalled();
});
it('requires email and PIN', () => {
  render(<FormsInvitation client={{ ...client, loginPin: '' }} />);
  expect(screen.getByRole('button')).toBeDisabled();
});
