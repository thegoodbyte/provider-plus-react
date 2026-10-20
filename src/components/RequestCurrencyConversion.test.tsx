import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import RequestCurrencyConversion, { emptyRequestConversion, RequestConversion } from './RequestCurrencyConversion';
import { paymentsApi } from '../services/api';
jest.mock('../services/api', () => ({ paymentsApi: { conversionQuote: jest.fn() } }));
function Form() { const [value,setValue] = useState<RequestConversion>(emptyRequestConversion); return <RequestCurrencyConversion amount="100" currency="EUR" target="PLN" paymentDate="2026-10-18" value={value} onChange={patch => setValue(v=>({...v,...patch}))} />; }
beforeEach(()=>jest.clearAllMocks());
it('shows the historical published quote date and derived rate', async()=>{
 (paymentsApi.conversionQuote as jest.Mock).mockResolvedValue({data:{amount:430,rate:4.3,rateDate:'2026-10-16',source:'ECB reference rate'}});
 render(<Form/>);expect(await screen.findByText('Published ECB rate date: 2026-10-16')).toBeVisible();expect(screen.getByLabelText('PLN credited equivalent')).toHaveValue(430);expect(screen.getByLabelText('PLN credited equivalent')).toHaveAttribute('readonly');expect(screen.getByText('1 EUR = 4.300000 PLN')).toBeVisible();
});
it('keeps a confirmed manual equivalent when an older automatic request finishes late',async()=>{
 let resolve: any; (paymentsApi.conversionQuote as jest.Mock).mockReturnValue(new Promise(r=>{resolve=r}));
 render(<Form/>);await waitFor(()=>expect(paymentsApi.conversionQuote).toHaveBeenCalled());
 fireEvent.change(screen.getByLabelText('Request conversion method'),{target:{value:'manual'}});fireEvent.change(screen.getByLabelText('PLN credited equivalent'),{target:{value:'425'}});fireEvent.change(screen.getByLabelText('Request conversion source'),{target:{value:'Bank confirmation'}});
 await act(async()=>resolve({data:{amount:430,rateDate:'2026-10-16',source:'ECB reference rate'}}));
 expect(screen.getByLabelText('PLN credited equivalent')).toHaveValue(425);expect(screen.getByLabelText('Request conversion source')).toHaveValue('Bank confirmation');expect(screen.queryByText('Calculating the dated equivalent…')).toBeNull();
});
it('offers manual recovery when a dated rate is unavailable',async()=>{
 (paymentsApi.conversionQuote as jest.Mock).mockRejectedValue(Error('offline'));render(<Form/>);expect(await screen.findByRole('alert')).toHaveTextContent('confirmed equivalent');fireEvent.change(screen.getByLabelText('Request conversion method'),{target:{value:'manual'}});expect(screen.queryByRole('alert')).toBeNull();expect(screen.getByLabelText('Request conversion source')).toBeRequired();expect(screen.getByLabelText('Request conversion date')).toBeRequired();
});
