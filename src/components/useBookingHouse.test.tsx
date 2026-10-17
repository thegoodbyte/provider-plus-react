import { act, renderHook, waitFor } from '@testing-library/react';
import useBookingHouse from './useBookingHouse';
import { housesApi } from '../services/api';
jest.mock('../services/api', () => ({ housesApi: { getOne: jest.fn() } }));
const house = { _id: 'h1', bedrooms: [{ name: 'Garden room' }], allowsRoomSharing: false };
it('resolves a raw house ID to its named bedrooms', async () => {
 (housesApi.getOne as jest.Mock).mockResolvedValue({data:house}); const {result} = renderHook(() => useBookingHouse({_id:'r1',houseId:'h1'} as any));
 await waitFor(() => expect(result.current.house).toEqual(house)); expect(housesApi.getOne).toHaveBeenCalledWith('h1');
});
it('fetches a partially populated house that omits its bedrooms', async () => {
 (housesApi.getOne as jest.Mock).mockResolvedValue({data:house}); const {result} = renderHook(() => useBookingHouse({_id:'r1',houseId:{_id:'h1',name:'House'}} as any));
 await waitFor(() => expect(result.current.house?.bedrooms).toEqual(house.bedrooms));
});
it('uses a complete populated house without another request', async () => {
 const {result} = renderHook(() => useBookingHouse({_id:'r1',houseId:house} as any)); await waitFor(() => expect(result.current.house).toEqual(house)); expect(housesApi.getOne).not.toHaveBeenCalled();
});
it('shows and recovers from loading errors', async () => {
 (housesApi.getOne as jest.Mock).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({data:house}); const retreat = {_id:'r1',houseId:'h1'} as any;
 const {result} = renderHook(() => useBookingHouse(retreat)); await waitFor(() => expect(result.current.error).toBeTruthy()); act(() => result.current.retry()); await waitFor(() => expect(result.current.house).toEqual(house)); expect(result.current.error).toBe('');
});
it('does not apply stale results after the retreat changes', async () => {
 let resolve!: (x:any) => void; (housesApi.getOne as jest.Mock).mockImplementation((id:string) => id==='h1' ? new Promise(r=>{resolve=r;}) : Promise.resolve({data:{_id:'h2',bedrooms:[{name:'Lake room'}]}}));
 const {result,rerender} = renderHook(({retreat})=>useBookingHouse(retreat),{initialProps:{retreat:{_id:'r1',houseId:'h1'} as any}});
 rerender({retreat:{_id:'r2',houseId:'h2'}}); await waitFor(()=>expect(result.current.house?._id).toBe('h2')); await act(async()=>resolve({data:house})); expect(result.current.house?._id).toBe('h2');
});
it('clears rooms when no house is assigned', async () => {
 const {result} = renderHook(()=>useBookingHouse({_id:'r1'} as any)); await waitFor(()=>expect(result.current.loading).toBe(false)); expect(result.current.house).toBeUndefined(); expect(housesApi.getOne).not.toHaveBeenCalled();
});
it('rejects a response for a different house', async () => {
 (housesApi.getOne as jest.Mock).mockResolvedValue({data:{_id:'other',bedrooms:[{name:'Wrong room'}]}}); const {result} = renderHook(()=>useBookingHouse({_id:'r1',houseId:'h1'} as any)); await waitFor(()=>expect(result.current.error).toBeTruthy()); expect(result.current.house).toBeUndefined();
});
