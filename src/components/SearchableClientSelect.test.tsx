import { fireEvent, render, screen } from '@testing-library/react';
import SearchableClientSelect from './SearchableClientSelect';

const clients: any[] = [
  { _id: 'c1', firstName: 'Ada', lastName: 'Lovelace', display_id: 1206, email: 'ada@example.com' },
  { _id: 'c2', firstName: 'Emil', lastName: 'Karkocha', display_id: 1205, email: 'emil@example.com' },
  { _id: 'c3', firstName: 'No', lastName: 'Number' },
];

describe('SearchableClientSelect', () => {
  it('shows and clears the selected client with the primary callback', () => {
    const onClientSelect = jest.fn();
    render(<SearchableClientSelect clients={clients} selectedClientId="c1" onClientSelect={onClientSelect} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('#1206 Ada Lovelace');
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onClientSelect).toHaveBeenCalledWith('');
    expect(input).toHaveFocus();
  });

  it('falls back to onChange and supports clicking an option', () => {
    const onChange = jest.fn();
    render(<SearchableClientSelect clients={clients} value="" onChange={onChange} placeholder="Find client" className="custom" />);
    const input = screen.getByPlaceholderText('Find client');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'emil@example.com' } });
    expect(screen.getByText('Emil Karkocha')).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByText('Emil Karkocha'));
    fireEvent.click(screen.getByText('Emil Karkocha'));
    expect(onChange).toHaveBeenCalledWith('c2');
  });

  it('searches by hashed and plain client number and shows an empty result', () => {
    render(<SearchableClientSelect clients={clients} onChange={jest.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '#1206' } });
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '1205' } });
    expect(screen.getByText('Emil Karkocha')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'missing' } });
    expect(screen.getByText('No clients found matching "missing"')).toBeInTheDocument();
  });

  it('opens and selects using the keyboard', () => {
    const onChange = jest.fn();
    render(<SearchableClientSelect clients={clients} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('c1');
  });

  it('clamps keyboard navigation and ignores Enter when no option is highlighted', () => {
    const onChange = jest.fn();
    render(<SearchableClientSelect clients={clients.slice(0, 1)} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('c1');
  });

  it('closes on Escape and on an outside click', () => {
    render(<div><SearchableClientSelect clients={clients} onChange={jest.fn()} /><button>Outside</button></div>);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    fireEvent.focus(input);
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('opens from the chevron and renders clients without display ids', () => {
    render(<SearchableClientSelect clients={[clients[2]]} onChange={jest.fn()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('No ID')).toBeInTheDocument();
    expect(screen.getByText('No Number')).toBeInTheDocument();
  });
});
