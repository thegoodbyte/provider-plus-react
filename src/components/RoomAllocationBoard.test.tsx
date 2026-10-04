import React from 'react';
import userEvent from '@testing-library/user-event';
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
    Object.assign(globalThis, { ResizeObserver: class { observe() {} unobserve() {} disconnect() {} } });
    // jsdom does not implement the browser task channel used by Ant Design's picker.
    Object.assign(globalThis, { MessageChannel: class {
      port1 = { onmessage: null as any };
      port2 = { postMessage: (data: unknown) => setTimeout(() => this.port1.onmessage?.({ data }), 0) };
    } });
    Object.defineProperty(window, "matchMedia", { writable: true, value: jest.fn().mockImplementation(() => ({ matches: false, addListener: jest.fn(), removeListener: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() })) });
    (authService.getUser as jest.Mock).mockReturnValue({ role: 'admin' });
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: JSON.parse(JSON.stringify(fixture)) });
  });
  it('offers numbered shared beds only up to the retreat limit', async () => {
    render(<RoomAllocationBoard retreatId="retreat1" />);
    await screen.findByRole('combobox', { name: 'Room 1 Shared bed 1 guest' });
    expect(screen.getByRole('combobox', { name: 'Room 1 Shared bed 2 guest' })).toBeEnabled();
    expect(screen.queryByRole('combobox', { name: 'Room 1 Shared bed 3 guest' })).not.toBeInTheDocument();
  });
  it('switches to a single private slot and prioritizes paid private guests', async () => {
    const configured = JSON.parse(JSON.stringify(fixture)); configured.revision = 1; configured.rooms[0].availableBeds = 1;
    (roomAllocationApi.change as jest.Mock).mockResolvedValue({ data: configured });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Private', exact: true }));
    const dropdown = await screen.findByRole('combobox', { name: 'Room 1 Private room guest' });
    expect(screen.queryByRole('combobox', { name: 'Room 1 Shared bed 1 guest' })).not.toBeInTheDocument();
    await userEvent.click(dropdown);
    expect(await screen.findByRole('option', { name: /Anna/ })).toBeInTheDocument();
    expect(screen.getByText('Matching room preference')).toBeInTheDocument();
    expect(screen.getByText('Other guests — check preference')).toBeInTheDocument();
    expect(roomAllocationApi.change).toHaveBeenCalledWith('retreat1', { revision: 0, action: 'configure', roomId: 'r1', availableBeds: 1, use: 'private' });
  });
  it('locks the occupied room configuration and excludes an assigned guest from other slots', async () => {
    const assigned = JSON.parse(JSON.stringify(fixture)); assigned.rooms[0].occupants = [{ bed: 1, bookingId: 'b' }];
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: assigned });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    const secondBed = await screen.findByRole('combobox', { name: 'Room 1 Shared bed 2 guest' });
    await userEvent.click(secondBed);
    await screen.findByRole('option', { name: /Anna/ });
    expect(screen.queryByRole('option', { name: /Bob/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Private', exact: true })).toBeDisabled();
    expect(screen.getByLabelText('Room 1 available beds')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Room 1 Shared bed 1 guest' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Refresh from house' })).toBeDisabled();
    expect(screen.getByText('1 beds available')).toBeInTheDocument();
  });
  it('releases a guest through the API and reopens the bed', async () => {
    const assigned = JSON.parse(JSON.stringify(fixture)); assigned.rooms[0].occupants = [{ bed: 1, bookingId: 'b' }];
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: assigned });
    (roomAllocationApi.change as jest.Mock).mockResolvedValue({ data: fixture });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Release Bob' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Room 1 Shared bed 1 guest' })).toBeEnabled());
    expect(roomAllocationApi.change).toHaveBeenCalledWith('retreat1', { action: 'assign', revision: 0, roomId: 'r1', bed: 1, bookingId: null });
  });
  it('reloads a concurrent change and keeps the conflict message visible', async () => {
    (roomAllocationApi.change as jest.Mock).mockRejectedValue({ response: { status: 409, data: { message: 'Room allocations changed. Refresh and try again' } } });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    await userEvent.click(await screen.findByRole('combobox', { name: 'Room 1 Shared bed 1 guest' }));
    fireEvent.click(await screen.findByRole('option', { name: /Bob/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Room allocations changed');
    expect(roomAllocationApi.get).toHaveBeenCalledTimes(2);
  });
  it('lets medical staff read the board without changing beds', async () => {
    (authService.getUser as jest.Mock).mockReturnValue({ role: 'medical_staff' });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    expect(await screen.findByRole('combobox', { name: 'Room 1 Shared bed 1 guest' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Refresh from house' })).not.toBeInTheDocument();
  });
  it('keeps a one-bed shared room shared and includes client photos in searchable HTML options', async () => {
    const board = JSON.parse(JSON.stringify(fixture));
    board.rooms[0].availableBeds = 1; board.rooms[0].use = 'shared';
    board.guests[1].clientId = 'client-b'; board.guests[1].profilePictureUrl = 'https://example.com/bob.jpg';
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: board });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    const picker = await screen.findByRole('combobox', { name: 'Room 1 Shared bed 1 guest' });
    await userEvent.click(picker);
    const option = await screen.findByRole('option', { name: /Bob/ });
    expect(option.querySelector('img')).toHaveAttribute('src', 'https://example.com/bob.jpg');
    fireEvent.change(picker, { target: { value: 'Bob' } });
    await waitFor(() => expect(screen.queryByRole('option', { name: /Anna/ })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Shared', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('combobox', { name: 'Room 1 Private room guest' })).not.toBeInTheDocument();
  });
  it('disables shared use when the house prohibits sharing', async () => {
    const board = JSON.parse(JSON.stringify(fixture)); board.rooms[0].allowsSharing = false; board.rooms[0].availableBeds = 1;
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: board });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    expect(await screen.findByRole('button', { name: 'Shared', exact: true })).toBeDisabled();
    expect(screen.getByText(/configured for private use only/)).toBeInTheDocument();
  });
  it('explains how to allocate guests whose booking has no accommodation choice', async () => {
    const board = JSON.parse(JSON.stringify(fixture)); board.guests[0].roomType = 'unspecified';
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: board });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    expect(await screen.findByText(/Guests without an accommodation choice/)).toHaveTextContent('selected in their booking');
  });
  it('hides every booking for an assigned client until that client is released', async () => {
    const board: AllocationBoard = JSON.parse(JSON.stringify(fixture));
    board.guests[1].clientId = 'bob-client';
    board.guests.push({ ...board.guests[1], id: 'duplicate-b', bookingNumber: 104 });
    board.rooms[0].occupants = [{ bed: 1, bookingId: 'b' }];
    board.rooms.push({ ...board.rooms[0], id: 'r2', name: 'Room 2', occupants: [] });
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: board });
    const released: AllocationBoard = JSON.parse(JSON.stringify(board));
    released.rooms[0].occupants = [];
    (roomAllocationApi.change as jest.Mock).mockResolvedValue({ data: released });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    const picker = await screen.findByRole('combobox', { name: 'Room 2 Shared bed 1 guest' });
    await userEvent.click(picker);
    await screen.findByRole('option', { name: /Anna/ });
    expect(screen.queryByRole('option', { name: /Bob/ })).not.toBeInTheDocument();
    fireEvent.keyDown(picker, { key: 'Escape', code: 'Escape', keyCode: 27 });
    fireEvent.click(screen.getByRole('button', { name: 'Release Bob' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Room 2 Shared bed 1 guest' })).toBeEnabled());
    await userEvent.click(screen.getByRole('combobox', { name: 'Room 2 Shared bed 1 guest' }));
    expect((await screen.findAllByRole('option', { name: /Bob/ })).length).toBe(2);
  });
  it('shows an actionable empty-house configuration message', async () => {
    (roomAllocationApi.get as jest.Mock).mockResolvedValue({ data: { ...fixture, rooms: [] } });
    render(<RoomAllocationBoard retreatId="retreat1" />);
    expect(await screen.findByText(/No bedrooms configured/)).toHaveTextContent('Houses');
  });
});
