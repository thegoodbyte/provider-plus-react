import React, { useEffect, useMemo, useState } from 'react';
import { RevolutPaymentLink, revolutPaymentLinksApi } from '../services/api';

type Props = { value: string; amount?: string | number; currency?: string; onChange: (url: string) => void; onMismatchChange?: (mismatched: boolean) => void };

const RevolutPaymentLinkPicker: React.FC<Props> = ({ value, amount, currency, onChange, onMismatchChange }) => {
  const [links, setLinks] = useState<RevolutPaymentLink[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    revolutPaymentLinksApi.list().then(response => setLinks(response.data || [])).catch(() => setError('Catalog unavailable; you can still paste a link.'));
  }, []);
  const selected = links.find(link => link.checkoutUrl === value);
  const mismatched = Boolean(selected && (selected.currency !== currency || Number(selected.amount) !== Number(amount)));
  // Only a selection that actually matches a catalog entry can mismatch --
  // a hand-pasted custom link has nothing to compare against, so it never
  // blocks the form.
  useEffect(() => { onMismatchChange?.(mismatched); }, [mismatched, onMismatchChange]);
  const sorted = useMemo(() => [...links].filter(link => link.status === 'active').sort((a, b) => {
    const aMatch = a.currency === currency && Number(a.amount) === Number(amount);
    const bMatch = b.currency === currency && Number(b.amount) === Number(amount);
    return Number(bMatch) - Number(aMatch) || a.amount - b.amount;
  }), [amount, currency, links]);

  return <div className="space-y-3">
    <label className="block text-sm font-medium text-gray-700">Choose from payment-link catalog
      <select aria-label="Choose from payment-link catalog" value={selected?._id || ''} onChange={event => {
        const link = links.find(item => item._id === event.target.value);
        if (link) onChange(link.checkoutUrl);
      }} className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
        <option value="">Paste a custom link below</option>
        {sorted.map(link => <option key={link._id} value={link._id}>{link.name} — {link.amount.toLocaleString()} {link.currency} — {link.remainingPayments == null ? 'unlimited' : `${link.remainingPayments} uses left`}</option>)}
      </select>
    </label>
    {mismatched && selected && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">This catalog link is for {selected.amount.toLocaleString()} {selected.currency}, but this request is for {Number(amount || 0).toLocaleString()} {currency}. Choose a matching link or paste a custom one before sending.</div>}
    <label className="block text-sm font-medium text-gray-700">Revolut payment link
      <input type="url" value={value} onChange={event => onChange(event.target.value)} className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://checkout.revolut.com/pay/..." />
    </label>
    {error && <p className="text-xs text-amber-700">{error}</p>}
    <p className="text-xs text-gray-500">Choose a reusable link from the catalog or paste a one-off Revolut link.</p>
  </div>;
};

export default RevolutPaymentLinkPicker;

