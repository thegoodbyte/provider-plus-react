import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import RoomAllocationBoard, { AllocationBoard } from './RoomAllocationBoard';
import { roomAllocationApi } from '../services/api';
import { authService } from '../services/authService';
jest.mock('../services/api', () => ({ roomAllocationApi: { get: jest.fn(), change: jest.fn() } }));
jest.mock('../services/authService', () => ({ authService: { getUser: jest.fn() } }));
const fixture: AllocationBoard = {
 retreatId:'retreat1',houseName:'Mountain house',houseChanged:false,revision:0,
 rooms:[{id:'r1',name:'Room 1',floor:'1',bedCount:3,hasBathroom:false,allowsSharing:true,availableBeds:2,occupants:[]}],
 guests:[{id:'a',name:'Anna',clientId:'anna',profilePictureUrl:'https://example.com/anna.jpg',bookingNumber:101,roomType:'private',amountPaid:500,currency:'EUR'},{id:'b',name:'Bob',clientId:'bob',profilePictureUrl:'https://example.com/bob.jpg',bookingNumber:102,roomType:'shared',amountPaid:500,currency:'EUR'},{id:'c',name:'Carol',bookingNumber:103,roomType:'private',amountPaid:0,currency:'EUR'}]
};
const copy=():AllocationBoard=>JSON.parse(JSON.stringify(fixture));
const edit=async(label='Room 1 Shared bed 1')=>fireEvent.click(await screen.findByRole('button',{name:`Edit ${label}`}));
const choose=async(name='Bob',label='Room 1 Shared bed 1')=>{const picker=await screen.findByRole('combobox',{name:`${label} guest`});fireEvent.mouseDown(picker);fireEvent.click(await screen.findByRole('option',{name:new RegExp(name)}));};
beforeEach(()=>{
 Object.assign(globalThis,{ResizeObserver:class{observe(){}unobserve(){}disconnect(){}},MessageChannel:class{port1={onmessage:null as any};port2={postMessage:(data:unknown)=>setTimeout(()=>this.port1.onmessage?.({data}),0)}}});
 Object.defineProperty(window,'matchMedia',{writable:true,value:jest.fn().mockImplementation(()=>({matches:false,addListener:jest.fn(),removeListener:jest.fn(),addEventListener:jest.fn(),removeEventListener:jest.fn()}))});
 (authService.getUser as jest.Mock).mockReturnValue({role:'admin'});
 (roomAllocationApi.get as jest.Mock).mockResolvedValue({data:copy()});
});
it('starts with vacant read-only slots and no guest selectors',async()=>{
 render(<RoomAllocationBoard retreatId="retreat1"/>);await screen.findByRole('button',{name:'Edit Room 1 Shared bed 1'});
 expect(screen.getAllByText('Vacant')).toHaveLength(2);expect(screen.queryByRole('combobox',{name:/guest/})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:/Save Room/})).not.toBeInTheDocument();
});
it('shows the saved guest name and picture in a room slot',async()=>{
 const board=copy();board.rooms[0].occupants=[{bed:1,bookingId:'b'}];(roomAllocationApi.get as jest.Mock).mockResolvedValue({data:board});render(<RoomAllocationBoard retreatId="retreat1"/>);
 const slot=await screen.findByLabelText('Room 1 Shared bed 1 slot');expect(within(slot).getByText('Bob')).toBeInTheDocument();expect(slot.querySelector('img')).toHaveAttribute('src','https://example.com/bob.jpg');expect(screen.queryByRole('combobox',{name:/guest/})).not.toBeInTheDocument();
});
it('stages a choice until Save, then shows a static guest card',async()=>{
 const saved=copy();saved.revision=1;saved.rooms[0].occupants=[{bed:1,bookingId:'b'}];(roomAllocationApi.change as jest.Mock).mockResolvedValue({data:saved});render(<RoomAllocationBoard retreatId="retreat1"/>);await edit();await choose();
 expect(roomAllocationApi.change).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Edit Room 1 Shared bed 2'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Save Room 1 Shared bed 1'}));await screen.findByText('Room allocation saved.');
 expect(roomAllocationApi.change).toHaveBeenCalledWith('retreat1',{revision:0,action:'assign',roomId:'r1',bed:1,bookingId:'b'});expect(screen.queryByRole('combobox',{name:/guest/})).not.toBeInTheDocument();expect(within(screen.getByLabelText('Room 1 Shared bed 1 slot')).getByText('Bob')).toBeInTheDocument();
});
it('Cancel discards a staged assignment without sending it',async()=>{
 render(<RoomAllocationBoard retreatId="retreat1"/>);await edit();await choose();fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(roomAllocationApi.change).not.toHaveBeenCalled();expect(screen.getAllByText('Vacant')).toHaveLength(2);
 await edit();expect(screen.getByRole('combobox',{name:'Room 1 Shared bed 1 guest'})).toHaveValue('');
});
it('removes a guest only on Save and makes them selectable elsewhere',async()=>{
 const board=copy();board.rooms[0].occupants=[{bed:1,bookingId:'b'}];(roomAllocationApi.get as jest.Mock).mockResolvedValue({data:board});(roomAllocationApi.change as jest.Mock).mockResolvedValue({data:copy()});render(<RoomAllocationBoard retreatId="retreat1"/>);await edit();fireEvent.click(screen.getByRole('button',{name:'Remove Bob'}));expect(roomAllocationApi.change).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Save Room 1 Shared bed 1'}));await screen.findByText('Room allocation saved.');expect(screen.getAllByText('Vacant')).toHaveLength(2);expect(roomAllocationApi.change).toHaveBeenCalledWith('retreat1',{action:'assign',revision:0,roomId:'r1',bed:1,bookingId:null});await edit('Room 1 Shared bed 2');fireEvent.mouseDown(screen.getByRole('combobox',{name:'Room 1 Shared bed 2 guest'}));expect(await screen.findByRole('option',{name:/Bob/})).toBeInTheDocument();
});
it('Cancel preserves an existing guest after a staged removal',async()=>{
 const board=copy();board.rooms[0].occupants=[{bed:1,bookingId:'b'}];(roomAllocationApi.get as jest.Mock).mockResolvedValue({data:board});render(<RoomAllocationBoard retreatId="retreat1"/>);await edit();fireEvent.click(screen.getByRole('button',{name:'Remove Bob'}));fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(within(screen.getByLabelText('Room 1 Shared bed 1 slot')).getByText('Bob')).toBeInTheDocument();expect(roomAllocationApi.change).not.toHaveBeenCalled();
});
it('keeps the draft editable when Save fails',async()=>{
 (roomAllocationApi.change as jest.Mock).mockRejectedValue({response:{status:500,data:{message:'Unable to save'}}});render(<RoomAllocationBoard retreatId="retreat1"/>);await edit();await choose();fireEvent.click(screen.getByRole('button',{name:'Save Room 1 Shared bed 1'}));expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save');expect(screen.getByRole('button',{name:'Save Room 1 Shared bed 1'})).toBeEnabled();expect(screen.queryByText('Room allocation saved.')).not.toBeInTheDocument();
});
it('refreshes a concurrent change and returns to the saved read-only view',async()=>{
 const board=copy();board.rooms[0].occupants=[{bed:1,bookingId:'c'}];(roomAllocationApi.get as jest.Mock).mockResolvedValueOnce({data:copy()}).mockResolvedValueOnce({data:board});(roomAllocationApi.change as jest.Mock).mockRejectedValue({response:{status:409,data:{message:'Room allocations changed'}}});render(<RoomAllocationBoard retreatId="retreat1"/>);await edit();await choose();fireEvent.click(screen.getByRole('button',{name:'Save Room 1 Shared bed 1'}));expect(await screen.findByRole('alert')).toHaveTextContent('Room allocations changed');expect(within(screen.getByLabelText('Room 1 Shared bed 1 slot')).getByText('Carol')).toBeInTheDocument();expect(screen.queryByRole('combobox',{name:/guest/})).not.toBeInTheDocument();
});
it('excludes other bookings for an assigned client',async()=>{
 const board=copy();board.rooms[0].occupants=[{bed:1,bookingId:'b'}];board.guests.push({...board.guests[1],id:'duplicate-b',bookingNumber:104});(roomAllocationApi.get as jest.Mock).mockResolvedValue({data:board});render(<RoomAllocationBoard retreatId="retreat1"/>);await edit('Room 1 Shared bed 2');fireEvent.mouseDown(screen.getByRole('combobox',{name:'Room 1 Shared bed 2 guest'}));await screen.findByRole('option',{name:/Anna/});expect(screen.queryByRole('option',{name:/Bob/})).not.toBeInTheDocument();
});
it('medical staff see guest cards and vacancies without Edit controls',async()=>{
 (authService.getUser as jest.Mock).mockReturnValue({role:'medical_staff'});render(<RoomAllocationBoard retreatId="retreat1"/>);await screen.findByText('Unassigned guests (3)');expect(screen.queryByRole('button',{name:/Edit Room/})).not.toBeInTheDocument();expect(screen.getAllByText('Vacant')).toHaveLength(2);
});
it('does not write when an unchanged edit is saved',async()=>{
 render(<RoomAllocationBoard retreatId="retreat1"/>);await edit();fireEvent.click(screen.getByRole('button',{name:'Save Room 1 Shared bed 1'}));expect(roomAllocationApi.change).not.toHaveBeenCalled();await screen.findByRole('button',{name:'Edit Room 1 Shared bed 1'});
});

it('keeps paid private guests in the matching-preference group',async()=>{
 const board=copy();board.rooms[0].availableBeds=1;board.rooms[0].use='private';(roomAllocationApi.get as jest.Mock).mockResolvedValue({data:board});render(<RoomAllocationBoard retreatId="retreat1"/>);await edit('Room 1 Private room');fireEvent.mouseDown(screen.getByRole('combobox',{name:'Room 1 Private room guest'}));await screen.findByRole('option',{name:/Anna/});expect(screen.getByText('Matching room preference')).toBeInTheDocument();expect(screen.getByText('Other guests — check preference')).toBeInTheDocument();
});
it('keeps house restrictions and empty-room guidance visible',async()=>{
 const board=copy();board.rooms[0].allowsSharing=false;board.rooms[0].availableBeds=1;(roomAllocationApi.get as jest.Mock).mockResolvedValue({data:board});render(<RoomAllocationBoard retreatId="retreat1"/>);expect(await screen.findByRole('button',{name:'Shared',exact:true})).toBeDisabled();expect(screen.getByText(/configured for private use only/)).toBeInTheDocument();
});
it('shows how to configure bedrooms when the house has none',async()=>{
 const board=copy();board.rooms=[];(roomAllocationApi.get as jest.Mock).mockResolvedValue({data:board});render(<RoomAllocationBoard retreatId="retreat1"/>);expect(await screen.findByText(/No bedrooms configured/)).toHaveTextContent('Houses');
});

it('preserves the current shared-bed limit when Shared is selected again',async()=>{
 const board=copy();board.rooms[0].availableBeds=1;board.rooms[0].use='shared';(roomAllocationApi.get as jest.Mock).mockResolvedValue({data:board});(roomAllocationApi.change as jest.Mock).mockResolvedValue({data:board});render(<RoomAllocationBoard retreatId="retreat1"/>);fireEvent.click(await screen.findByRole('button',{name:'Shared',exact:true}));await waitFor(()=>expect(roomAllocationApi.change).toHaveBeenCalledWith('retreat1',{revision:0,action:'configure',roomId:'r1',use:'shared',availableBeds:1}));
});
