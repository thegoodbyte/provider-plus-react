import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SearchableSelect } from './SearchableSelect';

const options = [
  { id: '1', label: 'Eva Novak', sublabel: 'eva@example.com' },
  { id: '2', label: 'Pawel Dolata', sublabel: 'Booking #1235' },
  { id: '3', label: 'Generic option' },
];

const Controlled = ({ initial = '', onChange = jest.fn() }: { initial?: string; onChange?: jest.Mock }) => {
  const [value, setValue] = useState(initial);
  return <SearchableSelect id="client" name="client" value={value} options={options} placeholder="Search clients" required onChange={(next) => { onChange(next); setValue(next); }} />;
};

describe('SearchableSelect', () => {
  it('opens, filters labels and sublabels, and selects an option', () => {
    const onChange = jest.fn();
    render(<Controlled onChange={onChange} />);
    const input = screen.getByPlaceholderText('Search clients');
    expect(input).toBeRequired();
    fireEvent.focus(input);
    expect(screen.getByText('Eva Novak')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '1235' } });
    expect(screen.queryByText('Eva Novak')).not.toBeInTheDocument();
    expect(screen.getByText('Pawel Dolata')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Pawel Dolata'));
    expect(onChange).toHaveBeenCalledWith('2');
    expect(input).toHaveValue('Pawel Dolata');
  });

  it('shows, preserves, and clears a selected option', () => {
    const onChange = jest.fn();
    render(<Controlled initial="1" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Eva Novak');
    expect(input).toHaveClass('has-value');
    fireEvent.click(screen.getByLabelText('Clear selection'));
    expect(onChange).toHaveBeenCalledWith('');
    expect(input).toHaveFocus();
    expect(input).toHaveValue('');
  });

  it('restores the selected label when clicking outside', () => {
    render(<div><SearchableSelect id="client" name="client" value="1" options={options} placeholder="Search" onChange={jest.fn()} /><button>Outside</button></div>);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'temporary' } });
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(input).toHaveValue('Eva Novak');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('clears an unmatched search when clicking outside', () => {
    render(<div><SearchableSelect id="client" name="client" value="" options={options} placeholder="Search" onChange={jest.fn()} /><button>Outside</button></div>);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'unknown' } });
    expect(screen.getByText('No options found')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(input).toHaveValue('');
  });

  it('shows loading states and updates when options arrive', () => {
    const { rerender } = render(<SearchableSelect id="client" name="client" value="" options={[]} placeholder="Search" onChange={jest.fn()} loading />);
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByText('⟳')).toBeInTheDocument();
    rerender(<SearchableSelect id="client" name="client" value="3" options={options} placeholder="Search" onChange={jest.fn()} loading={false} />);
    expect(screen.getByRole('textbox')).toHaveValue('Generic option');
    expect(screen.getByLabelText('Clear selection')).toBeInTheDocument();
  });
});
