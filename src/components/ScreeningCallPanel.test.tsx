import React from 'react';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import ScreeningCallPanel from './ScreeningCallPanel';
import { clientsApi,communicationsApi } from '../services/api';
jest.mock('../services/api',()=>({clientsApi:{update:jest.fn()},communicationsApi:{getTemplates:jest.fn(),previewEmail:jest.fn()}}));
jest.mock('./EmailComposeModal',()=>({__esModule:true,default:({initialValues,onClose}:any)=><div role="dialog"><p>{initialValues.subject}</p><pre>{initialValues.bodyText}</pre><button onClick={onClose}>Cancel preview</button></div>}));
const client:any={_id:'client',firstName:'Eva',email:'eva@example.invalid',language:'CZ',screeningCallAt:'2026-10-25T14:30:00.000Z',screeningCallTimeZone:'Europe/Prague'};
beforeEach(()=>{
 (clientsApi.update as jest.Mock).mockResolvedValue({data:client});
 (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({data:[{_id:'template',templateKey:'screening_call_preparation',language:'cz',active:true}]});
 (communicationsApi.previewEmail as jest.Mock).mockResolvedValue({data:{templateId:'template',subject:'Before our call',bodyText:'Three forms and call time',bodyHtml:'<p>Preview</p>'}});
});
it('saves the scheduled instant and timezone without sending an email',async()=>{
 const onSaved=jest.fn();render(<ScreeningCallPanel client={client} onSaved={onSaved}/>);
 expect(screen.getByLabelText('Call date and time')).toHaveValue('2026-10-25T15:30');
 fireEvent.change(screen.getByLabelText('Call date and time'),{target:{value:'2026-10-25T16:30'}});
 expect(screen.getByRole('button',{name:'Prepare before-call email'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Save call details'}));
 await waitFor(()=>expect(clientsApi.update).toHaveBeenCalledWith('client',{screeningCallAt:'2026-10-25T15:30:00.000Z',screeningCallTimeZone:'Europe/Prague'}));
 expect(onSaved).toHaveBeenCalled();expect(communicationsApi.previewEmail).not.toHaveBeenCalled();
});
it('retains draft values after a failed save',async()=>{
 (clientsApi.update as jest.Mock).mockRejectedValue({response:{status:503}});
 render(<ScreeningCallPanel client={client} onSaved={jest.fn()}/>);
 fireEvent.change(screen.getByLabelText('Call date and time'),{target:{value:'2026-10-25T16:30'}});
 fireEvent.click(screen.getByRole('button',{name:'Save call details'}));await screen.findByRole('alert');
 expect(screen.getByLabelText('Call date and time')).toHaveValue('2026-10-25T16:30');
 expect(screen.getByRole('button',{name:'Save call details'})).toBeEnabled();
});
it('prepares a localized client-only preview and cancel makes no write',async()=>{
 render(<ScreeningCallPanel client={client} onSaved={jest.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Prepare before-call email'}));await screen.findByRole('dialog');
 expect(communicationsApi.previewEmail).toHaveBeenCalledWith({templateId:'template',clientId:'client',relatedEntityType:'client',relatedEntityId:'client'});
 fireEvent.click(screen.getByRole('button',{name:'Cancel preview'}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(clientsApi.update).not.toHaveBeenCalled();
});
it('explains missing templates and blocks invalid DST dates before saving',async()=>{
 (communicationsApi.getTemplates as jest.Mock).mockResolvedValue({data:[]});
 render(<ScreeningCallPanel client={client} onSaved={jest.fn()}/>);
 fireEvent.click(screen.getByRole('button',{name:'Prepare before-call email'}));await screen.findByText(/before-call template is unavailable/);
 fireEvent.change(screen.getByLabelText('Call date and time'),{target:{value:'2026-03-29T02:30'}});
 fireEvent.click(screen.getByRole('button',{name:'Save call details'}));await screen.findByText(/does not exist/);
 expect(clientsApi.update).not.toHaveBeenCalled();
});
