import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../services/api';

type Kind = 'client' | 'booking' | 'request' | 'payment' | 'retreat';
export type RelatedRecord = { kind: Kind; value: any };
const paths: Record<Kind, string> = { client: 'clients', booking: 'bookings', request: 'payment-requests', payment: 'payments', retreat: 'retreats' };
const names: Record<Kind, string> = { client: 'Client', booking: 'Booking', request: 'Payment request', payment: 'Payment', retreat: 'Retreat' };
export const relatedId = (value: any): string => typeof value === 'string' ? value : typeof value?._id === 'string' ? value._id : '';
const numberOf = (kind: Kind, value: any) => kind === 'booking' ? value?.bookingNumber || value?.display_id : kind === 'retreat' ? value?.code || value?.retreatCode || value?.display_id : kind === 'request' ? value?.display_id || value?.invoiceNumber : value?.display_id || value?.displayId;

export function recordRelations(record: any): RelatedRecord[] {
  if (!record) return [];
  const ref = (id: any, detail: any) => detail && (!id || relatedId(id) === relatedId(detail)) ? detail : id;
  return [
    { kind: 'client', value: ref(record.clientId, record.clientDetails) },
    { kind: 'booking', value: ref(record.bookingId, record.bookingDetails) },
    { kind: 'request', value: record.paymentRequestId },
    { kind: 'request', value: record.linkedPaymentRequestId },
    { kind: 'payment', value: record.paymentId },
    { kind: 'retreat', value: ref(record.retreatId, record.retreatDetails) },
    ...(record.lineItems || []).flatMap((line: any): RelatedRecord[] => [{ kind: 'client', value: line.clientId }, { kind: 'booking', value: line.bookingId }]),
    ...(record.allocations || []).flatMap((line: any): RelatedRecord[] => [{ kind: 'client', value: line.clientId }, { kind: 'booking', value: line.bookingId }, { kind: 'payment', value: line.paymentId }]),
  ] as RelatedRecord[];
}

export default function RelatedRecords({ records }: { records: RelatedRecord[] }) {
  const { pathname } = useLocation();
  const first = pathname.split('/').filter(Boolean)[0];
  const prefix = ['admin', 'medical', 'staff', 'user'].includes(first) ? `/${first}` : '';
  const byId = new Map<string, RelatedRecord>();
  for (const record of records) {
    const id = relatedId(record.value); if (!id) continue;
    const key = `${record.kind}:${id}`, existing = byId.get(key);
    if (!existing || (!numberOf(existing.kind, existing.value) && numberOf(record.kind, record.value))) byId.set(key, record);
  }
  const unique = Array.from(byId.values());
  const signature = JSON.stringify(unique);
  const [details, setDetails] = useState<Record<string, any>>({});
  useEffect(() => {
    let active = true; setDetails({});
    const items: RelatedRecord[] = JSON.parse(signature);
    void Promise.all(items.filter(r => !numberOf(r.kind, r.value)).map(async r => {
      const id = relatedId(r.value);
      try {
        const { data } = await api.get(`/${paths[r.kind]}/${encodeURIComponent(id)}`, { suppressGlobalError: true } as any);
        if (active && relatedId(data) === id) setDetails(old => ({ ...old, [`${r.kind}:${id}`]: data }));
      } catch { /* The direct relationship remains usable without optional label enrichment. */ }
    }));
    return () => { active = false; };
  }, [signature]);
  const links = unique.map(r => {
    const id = relatedId(r.value); const key = `${r.kind}:${id}`; const value = numberOf(r.kind, r.value) ? r.value : details[key] || r.value;
    const route = r.kind === 'request' && value?.context === 'standalone_service' ? 'payment-requests/services' : paths[r.kind];
    const to = `${prefix}/${route}/${encodeURIComponent(id)}`;
    const number = numberOf(r.kind, value);
    const person = r.kind === 'client' ? [value?.firstName || value?.fname, value?.lastName || value?.lname].filter(Boolean).join(' ') : '';
    return { key, to, label: `${names[r.kind]}${number ? ` #${number}` : ''}${person ? ` · ${person}` : ''}` };
  }).filter(link => link.to !== pathname.replace(/\/$/, ''));
  if (!links.length) return null;
  return <nav aria-label="Related records" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h2 className="mb-3 text-base font-semibold text-slate-900">Related records</h2>
    <ul className="flex flex-wrap gap-3">{links.map(link => <li key={link.key}><Link className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-blue-700 underline hover:bg-blue-50" to={link.to}>{link.label}</Link></li>)}</ul>
  </nav>;
}
