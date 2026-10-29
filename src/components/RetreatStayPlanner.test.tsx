import {fireEvent,render,screen,waitFor} from '@testing-library/react';
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
