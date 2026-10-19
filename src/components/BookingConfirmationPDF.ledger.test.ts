import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createBookingConfirmationPdf } from './BookingConfirmationPDF';
import { paymentsApi, bookingFlowApi, medicalArtifactsApi } from '../services/api';
jest.mock('html2canvas', () => jest.fn());
jest.mock('jspdf', () => jest.fn().mockImplementation(() => ({ addImage: jest.fn(), output: () => new Blob(['pdf']) })));
jest.mock('../services/api', () => ({ paymentsApi: { getFinancialSummary: jest.fn(), getByBooking: jest.fn().mockResolvedValue({data:[]}), convertToUsd: jest.fn().mockResolvedValue({data:{usd_amount:1}}) }, bookingFlowApi:{getBookingRequirements:jest.fn().mockResolvedValue({data:[]})}, medicalArtifactsApi:{getAll:jest.fn().mockResolvedValue({data:[]})}, housesApi:{},medicalReviewRequestsApi:{} }));
let html: string;
beforeEach(() => {
 (jsPDF as unknown as jest.Mock).mockImplementation(() => ({addImage: jest.fn(),output:()=>new Blob(['pdf'])}));
 (paymentsApi.getByBooking as jest.Mock).mockResolvedValue({data:[]});
 (paymentsApi.convertToUsd as jest.Mock).mockResolvedValue({data:{usd_amount:1}});
 (bookingFlowApi.getBookingRequirements as jest.Mock).mockResolvedValue({data:[]});
 (medicalArtifactsApi.getAll as jest.Mock).mockResolvedValue({data:[]});
 Object.defineProperty(HTMLImageElement.prototype, 'complete', {configurable:true,get:()=>true});
 (html2canvas as jest.Mock).mockImplementation(async (element: HTMLElement) => { html=element.textContent || '';return {width:100,height:100,toDataURL:()=>''}; });
});
it('uses the fresh server price/balance/refund/credit even when local fields and payment list disagree', async () => {
 (paymentsApi.getFinancialSummary as jest.Mock).mockResolvedValue({data:{price:1000,currency:'USD',netPaid:900,balance:100,refunded:200,overpayment:0,paidInFull:false,sourceState:'verified_ledger'}});
 await createBookingConfirmationPdf({booking:{_id:'b1',bookingNumber:891,totalAmount:9999,amountPaid:9999,clientId:{firstName:'Fixture'},retreatId:{startDate:'2027-06-01',endDate:'2027-06-08'}},language:'en'});
 expect(paymentsApi.getFinancialSummary).toHaveBeenCalledWith('b1');
 expect(html).toContain('100.00');expect(html).toContain('900.00');expect(html).toContain('200.00');expect(html).not.toContain('9,999');expect(html).not.toContain('The retreat price has been paid in full');
});
it('fails generation if authoritative summary is unavailable', async () => {
 (paymentsApi.getFinancialSummary as jest.Mock).mockRejectedValue(new Error('offline'));
 await expect(createBookingConfirmationPdf({booking:{_id:'b1'}})).rejects.toThrow('offline');
});
