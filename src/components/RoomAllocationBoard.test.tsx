import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import RoomAllocationBoard, { AllocationBoard } from './RoomAllocationBoard';
import { roomAllocationApi } from '../services/api';
import { authService } from '../services/authService';

jest.mock('../services/api', () => ({ roomAllocationApi: { get: jest.fn(), change: jest.fn() } }));
jest.mock('../services/authService', () => ({ authService: { getUser: jest.fn() } }));
export const fixture: AllocationBoard = {
  retreatId: 'retreat1', houseName: 'Mountain house', houseChanged: false, revision: 0,
  rooms: [{ id: 'r1', name: 'Room 1', floor: '1', bedCount: 3, hasBathroom: false, allowsSharing: true, availableBeds: 2, occupants: [] }],
  guests: [
    { id: 'a', name: 'Anna', bookingNumber: 101, roomType: 'private', amountPaid: 500, currency: 'EUR' },
    { id: 'b', name: 'Bob', bookingNumber: 102, roomType: 'shared', amountPaid: 500, currency: 'EUR' },
    { id: 'c', name: 'Carol', bookingNumber: 103, roomType: 'private', amountPaid: 0, currency: 'EUR' },
  ],
};
describe('RoomAllocationBoard', () => {
  beforeEach(() => {
    (authService.getUser as jest.Mock).mockReturnValue({ role: 'admin' });
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: JSON.parse(JSON.stringify(fixture)) });
  });
  it('offers numbered shared beds only up to the retreat limit', async () => {
    render(<RoomAllocationBoard retreatId="retreat1" />);
    await screen.findByLabelText('Room 1 Shared bed 1 guest');
    expect(screen.getByLabelText('Room 1 Shared bed 2 guest')).toBeEnabled();
    expect(screen.queryByLabelText('Room 1 Shared bed 3 guest')).not.toBeInTheDocument();
  });
  it('switches to a single private slot and prioritizes paid private guests', async () => {
    const configured = JSON.parse(JSON.stringify(fixture)); configured.revision = 1; configured.rooms[0].availableBeds = 1;
    (roomAllocationApi.change as jest.Mock).mockResolvedValue({ data: configured });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    fireEvent.change(await screen.findByLabelText('Room 1 available beds'), { target: { value: '1' } });
    const dropdown = await screen.findByLabelText('Room 1 Private room guest');
    expect(screen.queryByLabelText('Room 1 Shared bed 1 guest')).not.toBeInTheDocument();
    expect(within(dropdown).getByRole('group', { name: 'Matching room preference' })).toHaveTextContent('Anna');
    expect(within(dropdown).getByRole('group', { name: 'Other guests — check preference' })).toHaveTextContent('Carol');
    expect(roomAllocationApi.change).toHaveBeenCalledWith('retreat1', { revision: 0, action: 'configure', roomId: 'r1', availableBeds: 1 });
  });
  it('locks the occupied room configuration and excludes an assigned guest from other slots', async () => {
    const assigned = JSON.parse(JSON.stringify(fixture)); assigned.rooms[0].occupants = [{ bed: 1, bookingId: 'b' }];
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: assigned });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    const secondBed = await screen.findByLabelText('Room 1 Shared bed 2 guest');
    expect(within(secondBed).queryByRole('option', { name: /Bob/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Room 1 available beds')).toBeDisabled();
    expect(screen.getByLabelText('Room 1 Shared bed 1 guest')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh from house' })).toBeDisabled();
    expect(screen.getByText('1 beds available')).toBeInTheDocument();
  });
  it('releases a guest through the API and reopens the bed', async () => {
    const assigned = JSON.parse(JSON.stringify(fixture)); assigned.rooms[0].occupants = [{ bed: 1, bookingId: 'b' }];
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: assigned });
    (roomAllocationApi.change as jest.Mock).mockResolvedValue({ data: fixture });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Release Bob' }));
    await waitFor(() => expect(screen.getByLabelText('Room 1 Shared bed 1 guest')).toBeEnabled());
    expect(roomAllocationApi.change).toHaveBeenCalledWith('retreat1', { action: 'assign', revision: 0, roomId: 'r1', bed: 1, bookingId: null });
  });
  it('reloads a concurrent change and keeps the conflict message visible', async () => {
    (roomAllocationApi.change as jest.Mock).mockRejectedValue({ response: { status: 409, data: { message: 'Room allocations changed. Refresh and try again' } } });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    fireEvent.change(await screen.findByLabelText('Room 1 Shared bed 1 guest'), { target: { value: 'b' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Room allocations changed');
    expect(roomAllocationApi.get).toHaveBeenCalledTimes(2);
  });
  it('lets medical staff read the board without changing beds', async () => {
    (authService.getUser as jest.Mock).mockReturnValue({ role: 'medical_staff' });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    expect(await screen.findByLabelText('Room 1 Shared bed 1 guest')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Refresh from house' })).not.toBeInTheDocument();
  });
  it('shows an actionable empty-house configuration message', async () => {
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: { ...fixture, rooms: [] } });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    expect(await screen.findByText(/No bedrooms configured/)).toHaveTextContent('Houses');
  });
});
