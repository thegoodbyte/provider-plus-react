import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskList } from './TaskList';
import { taskService, Task } from '../../services/taskService';
import { usersApi } from '../../services/usersApi';
import { assigneeName, remainingDays, matchesView } from './taskGrid';
jest.mock('../../services/usersApi', () => ({ usersApi: { getTaskAssignees: jest.fn() } }));
jest.mock('../../services/taskService', () => ({ taskService: { updateTask: jest.fn() } }));
const martin = { _id: 'martin', firstName: 'Martin', lastName: 'Halla', email: 'thegoodbyte@gmail.com', role: 'admin', isActive: true };
const task: Task = { id: 'one', name: 'Call guest', description: '', type: 'client', urgency: 'medium', status: 'pending', dueDate: '2026-11-30', assignedTo: martin.email, resolvedAssignee: martin, tags: [], createdAt: '', updatedAt: '' };
const props = { onEditTask: jest.fn(), onDeleteTask: jest.fn(), onCompleteTask: jest.fn() };
beforeEach(() => { jest.resetAllMocks(); (usersApi.getTaskAssignees as jest.Mock).mockResolvedValue({data:[martin]}); });
it('resolves real profile initials and edits assignment/clearing and status via field-only writes', async () => {
  const updated = jest.fn();
  (taskService.updateTask as jest.Mock).mockResolvedValueOnce({...task, assignedToUserId:null, assignedTo:'', resolvedAssignee:undefined}).mockResolvedValueOnce({...task, status:'on_hold'});
  render(<TaskList tasks={[task]} {...props} onTaskUpdated={updated} />);
  const assignee = screen.getByRole('combobox', {name:'Assignee for Call guest'});
  await waitFor(() => expect(assignee).toBeEnabled());
  expect(assignee).toHaveDisplayValue('Martin Halla');expect(screen.getByText('MH')).toBeInTheDocument();
  expect(screen.getByText('30 Nov 2026')).toBeInTheDocument();
  fireEvent.change(assignee,{target:{value:''}});
  await waitFor(() => expect(assignee).toHaveDisplayValue('Unassigned'));
  expect(taskService.updateTask).toHaveBeenLastCalledWith('one',{assignedToUserId:null});
  fireEvent.change(screen.getByRole('combobox',{name:'Status for Call guest'}),{target:{value:'on_hold'}});
  await waitFor(() => expect(screen.getByRole('combobox',{name:'Status for Call guest'})).toHaveValue('on_hold'));
  expect(taskService.updateTask).toHaveBeenLastCalledWith('one',{status:'on_hold'});expect(updated).toHaveBeenCalledTimes(2);
});
it('retains saved values after rejection, supports retry, and blocks duplicate submission while pending', async () => {
  let reject!: (e:Error)=>void;
  (taskService.updateTask as jest.Mock).mockImplementationOnce(() => new Promise((_,fail) => {reject=fail;})).mockResolvedValueOnce({...task,status:'completed'});
  render(<TaskList tasks={[task]} {...props} />);
  const status=screen.getByRole('combobox',{name:'Status for Call guest'});
  await waitFor(() => expect(screen.getByRole('combobox',{name:'Assignee for Call guest'})).toBeEnabled());
  fireEvent.change(status,{target:{value:'on_hold'}});expect(status).toBeDisabled();
  reject(new Error('Could not save task'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save task');expect(status).toHaveValue('pending');
  fireEvent.change(status,{target:{value:'completed'}});
  await waitFor(() => expect(status).toHaveValue('completed'));expect(taskService.updateTask).toHaveBeenCalledTimes(2);
});
it('directory failure is visible and retry restores editing without blocking status',async()=>{
  (usersApi.getTaskAssignees as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  render(<TaskList tasks={[task]} {...props}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load assignees');
  expect(screen.getByRole('combobox',{name:'Assignee for Call guest'})).toBeDisabled();expect(screen.getByRole('combobox',{name:'Status for Call guest'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Retry assignees'}));
  await waitFor(()=>expect(screen.getByRole('combobox',{name:'Assignee for Call guest'})).toBeEnabled());
});
it('preserves legacy labels and canonical precedence without guessing identity',()=>{
 expect(assigneeName({...task,resolvedAssignee:undefined})).toBe(martin.email);
 expect(assigneeName({...task,assignedToUserId:{firstName:'Other',lastName:'User'}})).toBe('Other User');
 expect(assigneeName({...task,assignedToUserId:undefined,resolvedAssignee:null})).toBe('Assigned user unavailable');
});
it('counts calendar days across DST/month/leap boundaries and never labels terminal work overdue',()=>{
 for(const [due,now,want]of [['2026-03-30',new Date(2026,2,28,23),'2 days remaining'],['2028-03-01',new Date(2028,1,28,12),'2 days remaining'],['2026-11-29',new Date(2026,10,30),'1 day overdue']] as const)expect(remainingDays({...task,dueDate:due},now)).toBe(want);
 expect(remainingDays({...task,status:'completed'},new Date(2027,1,1))).toBe('Done');
 expect(remainingDays({...task,status:'cancelled'},new Date(2027,1,1))).toBe('Cancelled');
 expect(remainingDays({...task,dueDate:undefined})).toBe('');
 expect(matchesView({...task,status:'on_hold'},'open')).toBe(true);
});
