import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SearchableLanguageSelector from './SearchableLanguageSelector';
import { languagesApi } from '../services/api';

jest.mock('../services/api', () => ({ languagesApi: { getActive: jest.fn() } }));

beforeEach(() => {
  (languagesApi.getActive as jest.Mock).mockResolvedValue({ data: [
    { _id: '1', code: 'en', name: 'English', active: true, sortOrder: 10 },
    { _id: '2', code: 'cz', name: 'Czech', active: true, sortOrder: 20 },
    { _id: '3', code: 'pl', name: 'Polish', active: true, sortOrder: 30 },
  ] });
});

describe('SearchableLanguageSelector', () => {
  it('shows the selected language label, matching a legacy uppercase stored value', async () => {
    render(<SearchableLanguageSelector value="PL" onChange={jest.fn()} label="Preferred Language" />);
    expect(await screen.findByText('Polish')).toBeInTheDocument();
  });

  it('filters by search and calls onChange with the active language code on selection', async () => {
    const onChange = jest.fn();
    render(<SearchableLanguageSelector onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(await screen.findByPlaceholderText('Search languages...'), { target: { value: 'cze' } });

    fireEvent.click(await screen.findByRole('button', { name: 'Czech' }));

    expect(onChange).toHaveBeenCalledWith('cz');
  });

  it('always offers the Other fallback alongside the active languages', async () => {
    render(<SearchableLanguageSelector onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('button', { name: 'Other' })).toBeInTheDocument();
  });
});

it('displays legacy Czech aliases and retains disabled saved values', async () => {
  const view = render(<SearchableLanguageSelector value="cs-CZ" onChange={jest.fn()} />);
  expect(await screen.findByText('Czech')).toBeInTheDocument();
  view.rerender(<SearchableLanguageSelector value="de" onChange={jest.fn()} />);
  expect(screen.getByText('DE · current')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button'));
  expect(screen.queryByRole('button', { name: 'German' })).not.toBeInTheDocument();
});
it('refreshes mounted selectors after settings changes', async () => {
  render(<SearchableLanguageSelector onChange={jest.fn()} />);
  await waitFor(() => expect(languagesApi.getActive).toHaveBeenCalled());
  (languagesApi.getActive as jest.Mock).mockResolvedValue({ data: [{ code: 'de', name: 'German' }] });
  fireEvent(window, new Event('languages-updated'));
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('button', { name: 'German' })).toBeInTheDocument();
});
it('shows an actionable retry if language loading fails', async () => {
  (languagesApi.getActive as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  render(<SearchableLanguageSelector onChange={jest.fn()} />);
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load languages');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByRole('button', { name: 'Polish' })).toBeInTheDocument();
});
