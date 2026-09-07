import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchableLanguageSelector from './SearchableLanguageSelector';

describe('SearchableLanguageSelector', () => {
  it('shows the selected language label', () => {
    render(<SearchableLanguageSelector value="PL" onChange={jest.fn()} label="Preferred Language" />);
    expect(screen.getByText('Polish')).toBeInTheDocument();
  });

  it('filters by search and calls onChange with the language code on selection', () => {
    const onChange = jest.fn();
    render(<SearchableLanguageSelector onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Search languages...'), { target: { value: 'cze' } });

    fireEvent.click(screen.getByRole('button', { name: 'Czech' }));

    expect(onChange).toHaveBeenCalledWith('CZ');
  });
});
