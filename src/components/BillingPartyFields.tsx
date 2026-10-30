import React from 'react';
export const emptyBillingParty = { name: '', email: '', address: '', registrationNumber: '', taxId: '', taxNote: '' };
export function BillingPartyFields({ value, onChange, issuer = false }: { value: any; onChange: (value: any) => void; issuer?: boolean }) {
  return <div className="sr-fields">{[
    ['name', issuer ? 'Seller legal name' : 'Recipient / company name'],
    ['email', issuer ? 'Seller email' : 'Billing email'],
    ['address', issuer ? 'Seller billing address' : 'Recipient billing address'],
    ['registrationNumber', 'Registration number (optional)'], ['taxId', 'Tax ID (optional)'],
    ...(issuer ? [['taxNote', 'Tax wording on invoice']] : []),
  ].map(([key, label]) => <label key={key}>{label}{key === 'address' || key === 'taxNote' ? <textarea maxLength={1000} value={value?.[key] || ''} onChange={e => onChange({ ...value, [key]: e.target.value })} /> : <input maxLength={200} type={key === 'email' ? 'email' : 'text'} value={value?.[key] || ''} onChange={e => onChange({ ...value, [key]: e.target.value })} />}</label>)}</div>;
}
