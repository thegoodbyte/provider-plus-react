import { duplicateRetreatRequest, duplicateServiceRequest } from './paymentRequestDuplication';
const source = () => ({
 _id:'source', context:'retreat', clientId:{_id:'c'}, retreatId:{_id:'r'},bookingId:{_id:'b'}, currency:'PLN',requestedAmount:102,
 invoiceNumber:'OLD', display_id:44,publicHash:'old-secret', status:'paid',amountPaid:102,amountReceived:102,paidDate:'2026-01-01',paymentId:'p',receiptId:'receipt',revolutPaymentLink:'old-one-use',consentAcceptedAt:'old',serviceDraftKey:'old-key',
 lineItems:[...Array.from({length:5},(_,i)=>({_id:'row'+i,type:'charge',description:'Call '+i,quantity:2,unitPrice:10,amount:20,clientId:{_id:'c'},bookingId:{_id:'b'}})),{type:'discount',description:'Percentage',discountType:'percentage',discountPercent:10,amount:-10},{type:'discount',description:'Fixed',discountType:'fixed',amount:-2},{type:'info',description:'Details',amount:0}]
});
it('copies all eight ordered item rows and ownership/pricing without settlement, tokens or mutable references',()=>{
 const original=source(), result=duplicateRetreatRequest(original);
 expect(result.lineItems).toHaveLength(8);expect(result.lineItems.map((i:any)=>i.description)).toEqual(original.lineItems.map(i=>i.description));
 expect(result.lineItems[5]).toMatchObject({discountType:'percentage',discountPercent:10,amount:-10});
 expect(result).toMatchObject({status:'pending',clientId:'c',bookingId:'b',retreatId:'r'});
 for(const field of ['_id','display_id','invoiceNumber','publicHash','paidDate','paymentId','receiptId','amountPaid','amountReceived','revolutPaymentLink','consentAcceptedAt','serviceDraftKey','dueDate']) expect(result).not.toHaveProperty(field);
 result.lineItems[0].description='Edited';expect(original.lineItems[0].description).toBe('Call 0');expect(result.lineItems[0]).not.toHaveProperty('_id');
});
it('copies service invoice items and billing context into a draft with current default methods and a fresh due date',()=>{
 const original={...source(),context:'standalone_service',serviceDocument:{title:'Integration',language:'pl',policy:{code:'current'},billingRecipient:{name:'Company',address:'Address',email:'a@example.invalid'},paymentMethods:{revolutUrl:'one-use'}}};
 const result=duplicateServiceRequest(original);
 expect(result).toMatchObject({clientId:'c',title:'Integration',language:'pl',currency:'PLN',policyCode:'current',dueDate:'',overrideMethods:false,recipientMode:'client'});
 expect(result.items).toHaveLength(8);expect(result).not.toHaveProperty('methods');expect(result).not.toHaveProperty('publicHash');
 result.billingRecipient.name='Different';expect(original.serviceDocument.billingRecipient.name).toBe('Company');
});
it('preserves a one-off recipient and does not fabricate incomplete billing overrides for legacy client requests',()=>{
 const s={...source(),context:'standalone_service',clientId:undefined,serviceDocument:{client:{name:'One off',email:'one@example.invalid',address:'Address'}}};
 expect(duplicateServiceRequest(s)).toMatchObject({recipientMode:'recipient',billingRecipient:{name:'One off'}});
 expect(duplicateServiceRequest({...s,clientId:'c'}).billingRecipient).toEqual({});
 expect(()=>duplicateServiceRequest({...s,lineItems:[]})).toThrow();
});
