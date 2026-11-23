import React from 'react';
import { MessageCircle, Phone } from 'lucide-react';

export const WhatsAppMark = () => <span className="mrr-whatsapp-mark" aria-hidden="true"><MessageCircle size={19}/><Phone size={10}/></span>;

export function QueueDate({ value, compact = false }: { value?: string | Date | null; compact?: boolean }) {
  if (!value) return <>—</>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>—</>;
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(compact ? {} : { year: 'numeric' }) });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return <time dateTime={date.toISOString()} title={date.toLocaleString()} aria-label={date.toLocaleString()} className={compact ? 'mrr-date-inline' : 'mrr-date'}><span>{day}{compact && <span className="mrr-date-year">, {date.getFullYear()}</span>}</span>{compact ? ' · ' : null}<span>{time}</span></time>;
}

export default function MedicalReviewQueueTable({ children, label = 'Medical review queue' }: { children: React.ReactNode; label?: string }) {
  return <div className="mrr-table-scroll" role="region" aria-label={`${label} table`} tabIndex={0}>
    <div role="table" aria-label={label} className="mrr-compact-table">
      <div role="rowgroup"><div role="row" className="mrr-table-head">{['Case','Client · retreat','Info','Medical advisor','Status','Actions'].map(title => <div role="columnheader" key={title}>{title}</div>)}</div></div>
      <div role="rowgroup">{children}</div>
    </div>
  </div>;
}
