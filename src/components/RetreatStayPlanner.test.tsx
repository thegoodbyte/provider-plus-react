import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import RetreatStayPlanner from './RetreatStayPlanner';
import {bookingsApi} from '../services/api';
jest.mock('../services/api',()=>({bookingsApi:{getByRetreatWithDetails:jest.fn()}}));
const retreat={startDate:'2026-10-24',endDate:'2026-10-31',capacity:8};
const one={_id:'booking-one',bookingNumber:1311,status:'confirmed',bookingType:'full_retreat',clientId:{firstName:'Ewa',lastName:'Synthetic'}};
const mount=()=>render(<MemoryRouter><RetreatStayPlanner retreatId="retreat" retreat={retreat}/></MemoryRouter>);
beforeEach(()=>jest.clearAllMocks());
it('shows real booking links and all eight capacity lanes, including empty places',async()=>{
 (bookingsApi.getByRetreatWithDetails as jest.Mock).mockResolvedValue({data:[one]});mount();expect(await screen.findByRole('link',{name:/Full retreat #1311/})).toHaveAttribute('href','/admin/bookings/booking-one');expect(screen.getByLabelText('Place 8')).toBeInTheDocument();expect(bookingsApi.getByRetreatWithDetails).toHaveBeenCalledWith('retreat',{suppressGlobalError:true});
});
it('exposes unknown-date and over-capacity warnings without inventing availability',async()=>{
 (bookingsApi.getByRetreatWithDetails as jest.Mock).mockResolvedValue({data:[{...one,bookingType:'booster'}]});mount();expect(await screen.findByRole('alert')).toHaveTextContent('missing or invalid dates');expect(screen.getByRole('link',{name:'Booking #1311'})).toHaveAttribute('href','/admin/bookings/booking-one');expect(screen.getByText('Needs review')).toBeInTheDocument();
});
it('refreshes fresh data and handles an empty retreat',async()=>{
 (bookingsApi.getByRetreatWithDetails as jest.Mock).mockResolvedValueOnce({data:[one]}).mockResolvedValueOnce({data:[]});mount();await screen.findByRole('link',{name:/Full retreat #1311/});fireEvent.click(screen.getByRole('button',{name:'Refresh stays'}));await screen.findByText(/No confirmed full stays/);expect(screen.queryByRole('link',{name:/Full retreat #1311/})).not.toBeInTheDocument();
});
it('handles API errors and ignores a late response after changing retreat',async()=>{
 (bookingsApi.getByRetreatWithDetails as jest.Mock).mockRejectedValueOnce(Error('offline'));mount();expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');
});
it('does not render old retreat records when a slower previous request resolves',async()=>{
 let finish:(v:any)=>void=()=>{};(bookingsApi.getByRetreatWithDetails as jest.Mock).mockReturnValueOnce(new Promise(resolve=>{finish=resolve})).mockResolvedValueOnce({data:[]});
 const view=render(<MemoryRouter><RetreatStayPlanner retreatId="old" retreat={retreat}/></MemoryRouter>);view.rerender(<MemoryRouter><RetreatStayPlanner retreatId="new" retreat={retreat}/></MemoryRouter>);await screen.findByText(/No confirmed full stays/);finish({data:[one]});await waitFor(()=>expect(screen.queryByRole('link',{name:/Full retreat #1311/})).not.toBeInTheDocument());
});
it('does not report empty/free capacity for a malformed successful API response',async()=>{
 (bookingsApi.getByRetreatWithDetails as jest.Mock).mockResolvedValue({data:{items:[]}});mount();expect(await screen.findByRole('alert')).toHaveTextContent('Could not load');expect(screen.queryByText('Minimum free places per night')).not.toBeInTheDocument();
});

it('keeps saved accommodation on each booking when boosters reuse a lane, without guessing from preference or room number',async()=>{
 const rows=[{...one,roomType:'shared'},
  {...one,_id:'first-booster',bookingNumber:1312,bookingType:'booster',roomStayStart:'2026-10-24',roomStayEnd:'2026-10-27',roomType:'private'},
  {...one,_id:'second-booster',bookingNumber:1313,bookingType:'booster',roomStayStart:'2026-10-27',roomStayEnd:'2026-10-31',roomType:'private_ensuite'},
  {...one,_id:'unknown',bookingNumber:1314,roomNumber:'Private 1',clientId:{firstName:'Other',roomType:'private'}},
  {...one,_id:'legacy',bookingNumber:1315,roomType:'unexpected-legacy-value'},
 ];
 (bookingsApi.getByRetreatWithDetails as jest.Mock).mockResolvedValue({data:rows});mount();
 const full=await screen.findByRole('link',{name:/Full retreat #1311/});
 expect(within(full).getByRole('img',{name:'Shared room'})).toBeInTheDocument();
 const first=screen.getByRole('link',{name:/Booster #1312/}), second=screen.getByRole('link',{name:/Booster #1313/});
 expect(first.parentElement).toBe(second.parentElement);
 expect(within(first).getByRole('img',{name:'Private room'})).toBeInTheDocument();
 expect(within(second).getByRole('img',{name:'Private room with private bathroom'})).toBeInTheDocument();
 expect(within(screen.getByRole('link',{name:/Full retreat #1314/})).getByRole('img',{name:'Room type unknown'})).toBeInTheDocument();
 expect(within(screen.getByRole('link',{name:/Full retreat #1315/})).getByRole('img',{name:'Room type unknown'})).toBeInTheDocument();
 expect(screen.getAllByText('4 occupied · 4 free')).toHaveLength(7);
});
it('updates the room indicator after refresh without retaining the previous accommodation',async()=>{
 (bookingsApi.getByRetreatWithDetails as jest.Mock).mockResolvedValueOnce({data:[{...one,roomType:'shared'}]}).mockResolvedValueOnce({data:[{...one,roomType:'private'}]});mount();
 await screen.findByRole('img',{name:'Shared room'});fireEvent.click(screen.getByRole('button',{name:'Refresh stays'}));
 await screen.findByRole('img',{name:'Private room'});expect(screen.queryByRole('img',{name:'Shared room'})).not.toBeInTheDocument();
});
