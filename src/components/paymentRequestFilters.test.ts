import { emptyRequestFilters as empty, matchesRequestFilters as matches, requestFilterError } from './paymentRequestFilters';
const request = { clientId: { firstName: 'Ewa', lastName: 'Franus' }, requestedAmount: 2500.25, fullPriceQuote: 9500, currency: 'PLN', paymentDate: '2026-10-29' };
it('intersects independent name, exact amount, currency and inclusive date bounds', () => {
 const filters = { ...empty, clientName: ' FRANUS ', amountMin: '2500.25', amountMax: '2500.25', currency: 'PLN', dateFrom: '2026-10-29', dateTo: '2026-10-29' };
 expect(matches(request, filters)).toBe(true);
 for (const override of [{clientName:'Samuel'}, {amountMin:'2500.26'}, {amountMax:'2500.24'}, {currency:'EUR'}, {dateFrom:'2026-10-30'}, {dateTo:'2026-10-28'}]) expect(matches(request, {...filters,...override})).toBe(false);
});
it('uses installment rather than quote and preserves zero and legacy amounts', () => {
 expect(matches(request, {...empty,amountMin:'9500'})).toBe(false);
 expect(matches({...request,requestedAmount:0}, {...empty,amountMin:'0',amountMax:'0'})).toBe(true);
 expect(matches({...request,requestedAmount:undefined,amountPaid:1200}, {...empty,amountMin:'1200',amountMax:'1200'})).toBe(true);
});
it('excludes missing or invalid dates only when dates are filtered; handles month/leap-day boundaries', () => {
 for(const paymentDate of [undefined,null,'invalid']) {
  expect(matches({...request,paymentDate},empty)).toBe(true);
  expect(matches({...request,paymentDate},{...empty,dateFrom:'2026-01-01'})).toBe(false);
 }
 expect(matches({...request,paymentDate:'2028-02-29'},{...empty,dateFrom:'2028-02-29',dateTo:'2028-02-29'})).toBe(true);
 expect(matches({...request,paymentDate:'2028-03-01'},{...empty,dateTo:'2028-02-29'})).toBe(false);
 expect(matches({...request,clientId:null},{...empty,clientName:'Ewa'})).toBe(false);
});
it('rejects reversed and invalid numeric ranges, allowing exact and open bounds', () => {
 for(const filters of [{amountMin:'2',amountMax:'1'},{amountMin:'-1'},{amountMax:'NaN'},{dateFrom:'2026-11-01',dateTo:'2026-10-31'}]) expect(requestFilterError({...empty,...filters})).not.toBe('');
 expect(requestFilterError({...empty,amountMin:'0',amountMax:'0',dateFrom:'2026-10-29',dateTo:'2026-10-29'})).toBe('');
});
