import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LanguagesSettings from './LanguagesSettings';
import { languagesApi } from '../services/api';

jest.mock('../services/api', () => ({
  languagesApi: { getAll: jest.fn(), create: jest.fn(), update: jest.fn() },
}));

const baseLanguages = [
  { _id: '1', code: 'en', name: 'English', active: true, sortOrder: 10 },
  { _id: '2', code: 'cz', name: 'Czech', active: true, sortOrder: 20 },
];

describe('LanguagesSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (languagesApi.getAll as jest.Mock).mockResolvedValue({ data: baseLanguages });
  });

  it('lists the configured languages', async () => {
    render(<LanguagesSettings />);
    expect(await screen.findByText('en')).toBeInTheDocument();
    expect(screen.getByText('cz')).toBeInTheDocument();
  });

  it('saves an edited name and sort order for an existing language', async () => {
    render(<LanguagesSettings />);
    await screen.findByText('en');

    fireEvent.change(screen.getByLabelText('Name for en'), { target: { value: 'English (UK)' } });
    fireEvent.change(screen.getByLabelText('Sort order for en'), { target: { value: '5' } });
    fireEvent.click(screen.getAllByText('Save')[0]);

    await waitFor(() => expect(languagesApi.update).toHaveBeenCalledWith('en', { name: 'English (UK)', active: true, sortOrder: 5 }));
  });

  it('disables a language without deleting it', async () => {
    render(<LanguagesSettings />);
    await screen.findByText('en');

    fireEvent.click(screen.getAllByLabelText('Active')[0]);
    fireEvent.click(screen.getAllByText('Save')[0]);

    await waitFor(() => expect(languagesApi.update).toHaveBeenCalledWith('en', { name: 'English', active: false, sortOrder: 10 }));
  });

  it('adds a new language', async () => {
    (languagesApi.create as jest.Mock).mockResolvedValue({ data: { _id: '3', code: 'de', name: 'German', active: true, sortOrder: 120 } });
    render(<LanguagesSettings />);
    await screen.findByText('en');

    fireEvent.change(screen.getByPlaceholderText('code (e.g. de)'), { target: { value: 'de' } });
    fireEvent.change(screen.getByPlaceholderText('Display name (e.g. German)'), { target: { value: 'German' } });
    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => expect(languagesApi.create).toHaveBeenCalledWith({ code: 'de', name: 'German', sortOrder: 120 }));
  });

  it('shows an error message when saving fails', async () => {
    (languagesApi.update as jest.Mock).mockRejectedValue({ response: { data: { message: 'Language name is required.' } } });
    render(<LanguagesSettings />);
    await screen.findByText('en');

    fireEvent.click(screen.getAllByText('Save')[0]);

    expect(await screen.findByText('Language name is required.')).toBeInTheDocument();
  });
});
