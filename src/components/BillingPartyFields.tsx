import React from 'react';
import AppleInput from './AppleInput';
export const emptyBillingParty = { name: '', email: '', address: '', registrationNumber: '', taxId: '', taxNote: '' };
export function BillingPartyFields({ value, onChange, issuer = false }: { value: any; onChange: (value: any) => void; issuer?: boolean }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[
    ['name', issuer ? 'Seller legal name' : 'Recipient / company name'],
    ['email', issuer ? 'Seller email' : 'Billing email'],
    ['address', issuer ? 'Seller billing address' : 'Recipient billing address'],
    ['registrationNumber', 'Registration number (optional)'], ['taxId', 'Tax ID (optional)'],
    ...(issuer ? [['taxNote', 'Tax wording on invoice']] : []),
  ].map(([key, label]) => (
    <div key={key} className={key === 'address' || key === 'taxNote' ? 'col-span-full' : undefined}>
      {key === 'address' || key === 'taxNote' ? (
        <label className="block text-sm font-medium text-apple-gray-700 mb-1.5">
          {label}
          <textarea
            maxLength={1000}
            value={value?.[key] || ''}
            onChange={e => onChange({ ...value, [key]: e.target.value })}
            rows={2}
            className="mt-1.5 w-full rounded-apple border border-apple-gray-200 bg-white px-4 py-2 text-apple-gray-900 transition-all duration-200 hover:border-apple-gray-300 focus:border-apple-blue focus:outline-none focus:ring-2 focus:ring-apple-blue/20 focus:ring-offset-1"
          />
        </label>
      ) : (
        <AppleInput
          label={label}
          type={key === 'email' ? 'email' : 'text'}
          value={value?.[key] || ''}
          onChange={(v) => onChange({ ...value, [key]: v })}
          maxLength={200}
        />
      )}
    </div>
  ))}</div>;
}
