import { matchingBookingReturnPath } from './BookingEditorPage';
it('returns only to allowlisted same-origin matching screens after explicit booking save',()=>{
 const path='/admin/payments/scratchpad/000000000000000000000001';
 expect(matchingBookingReturnPath(path,'/admin','booking','https://admin.test')).toBe(path+'?createdBookingId=booking&match=1');
 expect(matchingBookingReturnPath('/admin/payments/joint/new?receiptId=abc','/admin','booking','https://admin.test')).toContain('receiptId=abc&createdBookingId=booking');
 for(const value of ['https://evil.test'+path,'//evil.test'+path,'/admin/users','/medical/payments/scratchpad/000000000000000000000001','https://[invalid'])expect(matchingBookingReturnPath(value,'/admin','booking','https://admin.test')).toBeNull();
});
