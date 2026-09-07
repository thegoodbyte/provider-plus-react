import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SearchableCountryNameSelector from './SearchableCountryNameSelector';

describe('SearchableCountryNameSelector', () => {
  it('shows the selected country name and flag', () => {
    render(<SearchableCountryNameSelector value="PL" onChange={jest.fn()} label="Country" />);
    expect(screen.getByText('Poland')).toBeInTheDocument();
  });

  it('shows a placeholder when nothing is selected', () => {
    render(<SearchableCountryNameSelector onChange={jest.fn()} placeholder="Select country" />);
    expect(screen.getByText('Select country')).toBeInTheDocument();
  });

  it('filters the list by search and calls onChange with the ISO code on selection', () => {
    const onChange = jest.fn();
    render(<SearchableCountryNameSelector onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Search countries...'), { target: { value: 'Pola' } });

    const option = screen.getByRole('button', { name: /Poland/i });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('PL');
  });
});
