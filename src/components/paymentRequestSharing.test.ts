import { canSharePaymentRequest, defaultShareMessages, localizedShareUrl, renderShareMessage, selectShareTemplate, shareLanguage, shareTemplateError } from './paymentRequestSharing';
const request = { publicHash: 'private/hash?', requestedAmount: 0, amountPaid: 900, currency: 'PLN', invoiceNumber: 1465, clientId: { firstName: '{{paymentUrl}}' } };
it('normalizes regional Czech aliases and preserves independent booking domains', () => {
    expect(shareLanguage('CS-CZ')).toBe('cz');
    expect(shareLanguage('PL_pl')).toBe('pl');
    expect(localizedShareUrl(request, 'en')).toBe('https://www.ibogaready.com/payment/private%2Fhash%3F');
    expect(localizedShareUrl(request, 'pl')).toBe('https://ibogaspirit.pl/clients/payment/request/private%2Fhash%3F?lang=pl');
    expect(localizedShareUrl(request, 'cz')).toBe('https://ibogaspirit.cz/clients/payment/request/private%2Fhash%3F?lang=cz');
    expect(localizedShareUrl({ ...request, context: 'standalone_service' }, 'pl')).toContain('ibogaspirit.cz/clients/payment/services/');
});
it('blocks inactive links while allowing already-paid requests for viewing', () => {
    for (const r of [{ ...request, status: 'cancelled' }, { ...request, publicLinkRevokedAt: 'now' }, { ...request, publicHash: '' }]) {
        expect(canSharePaymentRequest(r)).toBe(false);
        expect(localizedShareUrl(r, 'en')).toBe('');
    }
    expect(canSharePaymentRequest({ ...request, status: 'paid' })).toBe(true);
});
it('renders exactly once, preserves zero and requires an explicit supported link placeholder', () => {
    expect(renderShareMessage('{{firstName}} {{requestedAmount}} {{currency}} {{paymentUrl}}', request, 'en')).toBe('{{paymentUrl}} 0 PLN ' + localizedShareUrl(request, 'en'));
    expect(shareTemplateError('{{unknown}} {{paymentUrl}}')).toBeTruthy();
    expect(shareTemplateError('Pay now')).toBeTruthy();
    for (const body of Object.values(defaultShareMessages))
        expect(shareTemplateError(body)).toBe('');
});
it('chooses the latest active version without treating unrelated languages as English', () => {
    const templates = [{ _id: '1', templateKey: 'payment_request_share', language: 'en', display_id: 1001 }, { _id: '2', templateKey: 'payment_request_share', language: 'en', display_id: 1002 }, { _id: '3', templateKey: 'payment_request_share', language: 'ru', display_id: 9999 }, { _id: '4', templateKey: 'payment_request_share', language: 'cs', active: false }];
    expect(selectShareTemplate(templates, 'en').template._id).toBe('2');
    expect(selectShareTemplate(templates, 'cz').inactive).toBe(true);
    expect(selectShareTemplate(templates, 'pl').inactive).toBe(false);
});
