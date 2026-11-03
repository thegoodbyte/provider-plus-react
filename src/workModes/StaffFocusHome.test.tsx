import React from 'react';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import StaffFocusHome from './StaffFocusHome';
import {useStaffFocus} from './staffFocus';
const mockNavigate=jest.fn(),mockExit=jest.fn().mockResolvedValue(undefined);
let mockUser:any={id:'one',role:'admin'},mockActive=false;
jest.mock('../context/AuthContext',()=>({useAuth:()=>({user:mockUser})}));
jest.mock('./WorkModeContext',()=>({useWorkMode:()=>({active:mockActive,exit:mockExit,data:{sessions:[]}})}));
jest.mock('react-router-dom',()=>({...jest.requireActual('react-router-dom'),useNavigate:()=>mockNavigate}));
beforeEach(()=>{localStorage.clear();jest.clearAllMocks();mockUser={id:'one',role:'admin'};mockActive=false;});
it('opens payment processing and stores a scoped preference without creating a medical session',async()=>{
 render(<MemoryRouter><StaffFocusHome/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:/Process payments/}));await waitFor(()=>expect(mockNavigate).toHaveBeenCalledWith('/admin/payments/scratchpad'));expect(localStorage.getItem('staff-focus:one')).toBe('payments');expect(mockExit).not.toHaveBeenCalled();
});
it('exits only medical context when switching, preserving the durable session',async()=>{
 mockActive=true;render(<MemoryRouter><StaffFocusHome/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:/Review tasks/}));await waitFor(()=>expect(mockExit).toHaveBeenCalled());expect(mockNavigate).toHaveBeenCalledWith('/admin/tasks?support=all');
});
it('keeps focus separate across accounts, reloads, and ignores invalid stored values',()=>{
 function Probe({user}:{user:any}){const f=useStaffFocus(user);return <><span>{f.mode}</span><button onClick={()=>f.setMode('readiness')}>Choose</button></>;}
 const one={id:'one',role:'admin'},two={id:'two',role:'admin'};const v=render(<Probe user={one}/>);fireEvent.click(screen.getByText('Choose'));expect(screen.getByText('readiness')).toBeVisible();v.rerender(<Probe user={two}/>);expect(screen.getByText('all')).toBeVisible();v.rerender(<Probe user={one}/>);expect(screen.getByText('readiness')).toBeVisible();v.unmount();localStorage.setItem('staff-focus:one','__proto__');render(<Probe user={one}/>);expect(screen.getByText('all')).toBeVisible();
});

it('keeps medical focus and session access when exiting context fails',async()=>{
 mockActive=true;localStorage.setItem('staff-focus:one','medical');mockExit.mockRejectedValueOnce(new Error('offline'));render(<MemoryRouter><StaffFocusHome/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:/Process payments/}));expect(await screen.findByRole('alert')).toHaveTextContent('Your medical session is kept');expect(mockNavigate).not.toHaveBeenCalled();expect(localStorage.getItem('staff-focus:one')).toBe('medical');
});
