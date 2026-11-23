jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' } }) }));
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {Tasks} from './Tasks';
import {bookingFlowApi} from '../../services/api';
import {taskService} from '../../services/taskService';
jest.mock('../../services/taskService',()=>({taskService:{getTasks:jest.fn(),isOverdue:()=>false}}));
jest.mock('../../services/api',()=>({bookingFlowApi:{getItems:jest.fn().mockResolvedValue({data:[]})}}));
jest.mock('../../components/Tasks/TaskList',()=>({TaskList:({tasks}:any)=><div>{tasks.map((t:any)=><p key={t.id}>{t.name}</p>)}</div>}));
jest.mock('../../components/Tasks/TaskForm',()=>({TaskForm:()=>null}));
let mockChangeFilters:any;
jest.mock('../../components/Tasks/TaskFiltersPanel',()=>({TaskFiltersPanel:({onFiltersChange}:any)=>{mockChangeFilters=onFiltersChange;return <button onClick={()=>onFiltersChange({status:'pending'})}>Pending only</button>;}}));
jest.mock('../../components/Tasks/TasksCalendarView',()=>()=>null);
jest.mock('../../components/Tasks/SprintBoard',()=>({SprintBoard:()=>null}));
jest.mock('../../components/Tasks/ClientSupportInbox',()=>()=>null);
const task=(id:string,name:string,sourceType?:string)=>({id,name,sourceType,type:'client',status:'pending',tags:[]});
const api=taskService.getTasks as jest.Mock;
beforeEach(()=>{jest.clearAllMocks();(bookingFlowApi.getItems as jest.Mock).mockResolvedValue({data:[]});});
const view=()=>render(<MemoryRouter><Tasks/></MemoryRouter>);
test('canonical support requests stay in their specialist inbox instead of generic action lists',async()=>{
 api.mockResolvedValue([task('a','Client follow up'),task('b','Support request','client_support')]);view();
 expect(await screen.findByText('Client follow up')).toBeVisible();expect(screen.queryByText('Support request')).not.toBeInTheDocument();
 expect(screen.getByRole('link',{name:'IbogaReady tasks'})).toHaveAttribute('href','/admin/tasks?support=all');
});
test('an unavailable task list offers retry and recovers without claiming an empty queue',async()=>{
 api.mockRejectedValueOnce(Error('Offline')).mockResolvedValue([task('a','Recovered task')]);view();
 expect(await screen.findByText('Offline')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Retry loading tasks'}));
 expect(await screen.findByText('Recovered task')).toBeVisible();
});
test('a slow earlier refresh cannot replace the newer filtered queue',async()=>{
 let finish:(v:any)=>void=()=>{};api.mockResolvedValueOnce([task('a','Initial')]).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;})).mockResolvedValueOnce([task('b','Latest')]);
 view();await screen.findByText('Initial');
 await act(async()=>mockChangeFilters({status:'pending'}));
 await waitFor(()=>expect(api).toHaveBeenCalledTimes(2));
 await act(async()=>mockChangeFilters({status:'completed'}));
 expect(await screen.findByText('Latest')).toBeVisible();
 await act(async()=>finish([task('old','Older response')]));
 expect(screen.getByText('Latest')).toBeVisible();expect(screen.queryByText('Older response')).not.toBeInTheDocument();
});
