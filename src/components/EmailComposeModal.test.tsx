import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import EmailComposeModal from './EmailComposeModal';
import { communicationsApi } from '../services/api';

jest.mock('../services/api', () => ({
  bookingsApi: {},
  communicationsApi: {
    getSettings: jest.fn(),
    getTemplates: jest.fn(),
    getAssets: jest.fn(),
    previewEmail: jest.fn(),
  },
}));

describe('EmailComposeModal client hydration', () => {
  beforeEach(() => {
    (communicationsApi.getSettings as jest.Mock).mockResolvedValue({ data: {} });
    (communicationsApi.getAssets as jest.Mock).mockResolvedValue({ data: [] });
    (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({ data: [{
      _id: 'bp-pl', name: 'Blood pressure', language: 'pl', active: true,
      subject: 'Pomiary', bodyText: 'Cześć {{client.firstName}}\n{{links.bloodPressure}}',
    }] });
    (communicationsApi.previewEmail as jest.Mock).mockResolvedValue({ data: {
      subject: 'Pomiary',
      bodyText: 'Cześć Szymon\nhttps://ibogaready.com/workflow?step=blood_pressure',
      bodyHtml: '',
      variables: { client: { firstName: 'Szymon' }, links: { bloodPressure: 'https://ibogaready.com/workflow?step=blood_pressure' } },
    } });
  });

  it('requests server hydration with a client id when no booking id is available', async () => {
    render(<EmailComposeModal initialValues={{ templateId: 'bp-pl', clientId: 'client-1', to: 'szymon@example.com' }} onClose={jest.fn()} />);

    await waitFor(() => expect(communicationsApi.previewEmail).toHaveBeenCalledWith(expect.objectContaining({
      templateId: 'bp-pl', clientId: 'client-1',
    })));
    expect(communicationsApi.previewEmail).toHaveBeenCalledWith(expect.not.objectContaining({ bookingId: expect.anything() }));
    const message = await screen.findByDisplayValue(/Cześć Szymon/);
    expect((message as HTMLTextAreaElement).value).toContain('workflow?step=blood_pressure');
  });
});
