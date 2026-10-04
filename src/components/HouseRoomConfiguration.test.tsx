import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import HouseRoomConfiguration from './HouseRoomConfiguration';

describe('HouseRoomConfiguration', () => {
  const house: any = { bedrooms: [{ _id: 'stable-id', name: 'Room 1', bedCount: 3, floor: '1', hasBathroom: true }] };
  it('preserves the bedroom ID while editing floor and bed capacity', () => {
    const onChange = jest.fn();
    render(<HouseRoomConfiguration house={house} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Bedroom 1 beds'), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith({ bedrooms: [expect.objectContaining({ _id: 'stable-id', name: 'Room 1', bedCount: 2 })] });
    fireEvent.change(screen.getByLabelText('Bedroom 1 floor'), { target: { value: 'Ground' } });
    expect(onChange).toHaveBeenLastCalledWith({ bedrooms: [expect.objectContaining({ _id: 'stable-id', floor: 'Ground' })] });
  });
  it('adds a bedroom with configurable sharing and two beds by default', () => {
    const onChange = jest.fn();
    render(<HouseRoomConfiguration house={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add bedroom' }));
    expect(onChange).toHaveBeenCalledWith({ bedrooms: [expect.objectContaining({ name: 'Room 1', bedCount: 2, allowsSharing: true })] });
  });
  it('can archive a room and turn off sharing for the house', () => {
    const onChange = jest.fn();
    render(<HouseRoomConfiguration house={house} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Archive Room 1' }));
    expect(onChange).toHaveBeenCalledWith({ bedrooms: [expect.objectContaining({ _id: "stable-id", active: false })] });
    fireEvent.click(screen.getByLabelText('This house allows shared rooms'));
    expect(onChange).toHaveBeenCalledWith({ allowsRoomSharing: false });
  });
});
