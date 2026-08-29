import { fireEvent, render, screen } from '@testing-library/react';
import SearchableMedicalTrackingSelect from './SearchableMedicalTrackingSelect';

const items: any[] = [
  { _id: 'm1', client_id: 'c1', clientDisplayId: 12, firstName: 'Ada', lastName: 'Lovelace', type: 'EKG', ekgFileName: 'ada-ekg.pdf', source: 'booking' },
  { _id: 'm2', client_id: 'c2', clientName: 'Emil Karkocha', type: 'Liver', liverPanelFileName: 'liver.pdf', source: 'manual', display_id: 44 },
];

describe('SearchableMedicalTrackingSelect UI', () => {
  it('displays, clears and selects tracking records', () => {
    const onChange = jest.fn();
    render(<SearchableMedicalTrackingSelect items={items} value="m1" onChange={onChange} className="wide" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('#12 Ada Lovelace · EKG');
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onChange).toHaveBeenCalledWith('');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'liver.pdf' } });
    expect(screen.getByText('Emil Karkocha · Liver')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Emil Karkocha · Liver'));
    expect(onChange).toHaveBeenLastCalledWith('m2');
  });

  it('searches all supported metadata and reports empty results', () => {
    render(<SearchableMedicalTrackingSelect items={items} onChange={jest.fn()} placeholder="Find record" />);
    const input = screen.getByPlaceholderText('Find record');
    for (const term of ['12', 'c1', 'Ada', 'EKG', 'booking']) {
      fireEvent.change(input, { target: { value: term } });
      expect(screen.getByText('#12 Ada Lovelace · EKG')).toBeInTheDocument();
    }
    fireEvent.change(input, { target: { value: 'absent' } });
    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('toggles from the button and closes on an outside click', () => {
    render(<div><SearchableMedicalTrackingSelect items={items} onChange={jest.fn()} /><button>Outside</button></div>);
    const toggle = screen.getAllByRole('button')[0];
    fireEvent.click(toggle);
    expect(screen.getByText('#12 Ada Lovelace · EKG')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText('#12 Ada Lovelace · EKG')).not.toBeInTheDocument();
    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.mouseDown(screen.getByText('Outside'));
    expect(screen.queryByText('#12 Ada Lovelace · EKG')).not.toBeInTheDocument();
  });
});
