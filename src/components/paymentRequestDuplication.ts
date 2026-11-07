/** Deliberate allowlists: payment/receipt/consent/delivery fields never become new input. */
const pick = (value: any, keys: string[]) => Object.fromEntries(keys.filter(k => value?.[k] !== undefined).map(k => [k, value[k]]));
const idOf = (value: any) => value?._id || value?.id || value || undefined;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const itemFields = ['type', 'description', 'quantity', 'unitPrice', 'amount', 'discountType', 'discountPercent', 'allocationAmount', 'clientName', 'bookingLabel'];
export function duplicateRetreatRequest(source: any) {
  if (!source || source.context === 'standalone_service') throw Error('Open this service request to duplicate it.');
  const result: any = pick(source, ['context','bookingType','roomType','accommodationKey','accommodationLabel','roomAdjustmentType','roomAdjustmentAmount','ceremonyNumber','requestType','baseBookingPrice','fullPrice','fullPriceQuote','requestedAmount','currency','note','notes','paymentInstructions','consentRequired']);
  for (const key of ['clientId','retreatId','bookingId','ceremonyId']) result[key] = idOf(source[key]);
  result.lineItems = (source.lineItems || []).map((item: any) => ({ ...pick(item, itemFields), ...Object.fromEntries(['clientId','bookingId'].filter(k => item[k]).map(k => [k,idOf(item[k])])) }));
  result.status = 'pending';
  return copy(result);
}
export function duplicateServiceRequest(source: any) {
  if (source?.context !== 'standalone_service' || !source.serviceDocument || !source.lineItems?.length) throw Error('This request does not have itemized service details to copy.');
  const doc = source.serviceDocument;
  const billing = doc.billingRecipient || (source.clientId ? {} : doc.client || {});
  return copy({
    clientId: idOf(source.clientId) || '',
    recipientMode: source.clientId ? 'client' : 'recipient',
    billingRecipient: pick(billing, ['name','email','address','registrationNumber','taxId','taxNote']),
    title: doc.title || source.description || 'Service payment request',
    currency: source.currency,
    policyCode: doc.policy?.code || '',
    language: doc.language || 'en',
    dueDate: '',
    overrideMethods: false,
    items: source.lineItems.map((item: any) => pick(item, ['type','serviceCode','description','quantity','unitPrice','amount'])),
  });
}
