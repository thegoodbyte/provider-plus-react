import { fireEvent, render, screen } from '@testing-library/react';
import SearchableRetreatSelect from './SearchableRetreatSelect';

const retreats: any[] = [
  { _id: 'r1', name: 'Poland Autumn', location: 'Poznan', code: 'POL-1' },
  { _id: 'r2', name: 'Czech Spring', location_town: 'Prague', retreatCode: 'CZ-2' },
  { _id: 'r3', name: 'Quiet Week', locationTown: 'Brno' },
  { _id: 'r4', name: 'Remote' },
];

describe('SearchableRetreatSelect', () => {
  it('displays and clears a selected retreat', () => {
    const onSelect = jest.fn();
    render(<SearchableRetreatSelect retreats={retreats} selectedRetreatId="r1" onRetreatSelect={onSelect} required className="wide" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('Poland Autumn - Poznan');
    expect(input).toBeRequired();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onSelect).toHaveBeenCalledWith('');
  });

  it('searches by name, location and id and selects the result', () => {
    const onSelect = jest.fn();
    render(<SearchableRetreatSelect retreats={retreats} selectedRetreatId="" onRetreatSelect={onSelect} placeholder="Find retreat" />);
    const input = screen.getByPlaceholderText('Find retreat');
    fireEvent.change(input, { target: { value: 'prague' } });
    expect(screen.getByText('Czech Spring (CZ-2)')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'r3' } });
    expect(screen.getByText('Quiet Week')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'poland' } });
    fireEvent.click(screen.getByText('Poland Autumn (POL-1)'));
    expect(onSelect).toHaveBeenCalledWith('r1');
    expect(screen.queryByText('Prague')).not.toBeInTheDocument();
  });

  it('renders all location variants and an explicit empty result', () => {
    render(<SearchableRetreatSelect retreats={retreats} selectedRetreatId="" onRetreatSelect={jest.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.click(input);
    expect(screen.getByText('Prague')).toBeInTheDocument();
    expect(screen.getByText('Brno')).toBeInTheDocument();
    expect(screen.getByText('No location town')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'absent' } });
    expect(screen.getByText('No retreats found')).toBeInTheDocument();
  });

  it('toggles the list and closes it after an outside click', () => {
    render(<div><SearchableRetreatSelect retreats={retreats} selectedRetreatId="" onRetreatSelect={jest.fn()} /><button>Outside</button></div>);
    const toggle = screen.getAllByRole('button')[0];
    fireEvent.click(toggle);
    expect(screen.getByText('Poland Autumn (POL-1)')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText('Poland Autumn (POL-1)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('textbox'));
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(screen.queryByText('Poland Autumn (POL-1)')).not.toBeInTheDocument();
  });
});
