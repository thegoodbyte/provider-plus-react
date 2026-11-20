import React from 'react';
import { Client } from '../types';

export default function QuickMrrClientIdentity({ client }: { client?: string | Client | null }) {
  const record = client && typeof client === 'object' ? client : undefined;
  const name = [record?.firstName || record?.fname, record?.lastName || record?.lname]
    .map(value => value?.trim()).filter(Boolean).join(' ');
  const number = record?.display_id;
  const hasNumber = /^[1-9]\d*$/.test(String(number)) && Number.isSafeInteger(Number(number));
  return <div aria-label="Client for this review" className="my-3 min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    <p className="break-words text-base font-semibold text-slate-900">{name || 'Client name unavailable'}</p>
    <p className="text-sm text-slate-600">{hasNumber ? `Client #${number}` : 'Client ID unavailable'}</p>
  </div>;
}
