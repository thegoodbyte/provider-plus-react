import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
