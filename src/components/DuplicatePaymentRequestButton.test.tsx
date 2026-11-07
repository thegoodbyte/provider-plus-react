import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import DuplicatePaymentRequestButton from './DuplicatePaymentRequestButton';
import { invoiceDraftsApi, serviceRequestsApi } from '../services/api';
jest.mock('../services/api',()=>({invoiceDraftsApi:{save:jest.fn(),get:jest.fn()},serviceRequestsApi:{get:jest.fn()}}));
function Location(){const l=useLocation();return <output aria-label="Location">{l.pathname+l.search}</output>}
const source={_id:'source',context:'standalone_service',currency:'EUR',clientId:'c',lineItems:[{type:'charge',description:'Call',quantity:1,unitPrice:10,amount:10}],serviceDocument:{title:'Calls',policy:{code:'full_nonrefundable'}}};
beforeEach(()=>jest.clearAllMocks());
const mount=()=>render(<MemoryRouter><DuplicatePaymentRequestButton request={source}/><Location/></MemoryRouter>);
it('guards double-clicks and recovers the same saved draft after an ambiguous response',async()=>{
 (serviceRequestsApi.get as jest.Mock).mockResolvedValue({data:source});let payload:any;
 (invoiceDraftsApi.save as jest.Mock).mockImplementation(async(id,b)=>{payload=b.payload;throw Error('Response lost')});
 (invoiceDraftsApi.get as jest.Mock).mockImplementation(async()=>({data:{status:'draft',payload}}));
 mount();const button=screen.getByRole('button',{name:'Duplicate payment request'});fireEvent.click(button);fireEvent.click(button);
 await waitFor(()=>expect(screen.getByLabelText('Location')).toHaveTextContent('/services/new?draftId='));
 expect(invoiceDraftsApi.save).toHaveBeenCalledTimes(1);expect(screen.getByLabelText('Location')).toHaveTextContent('duplicateFrom=source');
 expect(payload).not.toHaveProperty('_id');
});
it('keeps the source open and reports a failed copy without navigating or issuing',async()=>{
 (serviceRequestsApi.get as jest.Mock).mockRejectedValue(Error('Source unavailable'));mount();fireEvent.click(screen.getByRole('button',{name:'Duplicate payment request'}));
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Source unavailable'));
 expect(invoiceDraftsApi.save).not.toHaveBeenCalled();expect(screen.getByLabelText('Location')).toHaveTextContent('/');
});
