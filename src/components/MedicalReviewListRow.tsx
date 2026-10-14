import React from 'react';
import './MedicalReviewListRow.css';
interface Props {
  requestId: React.ReactNode;
  client: React.ReactNode;
  retreat?: string;
  type: React.ReactNode;
  status: React.ReactNode;
  details: React.ReactNode;
  actions: React.ReactNode;
}
export default function MedicalReviewListRow({ requestId, client, retreat, type, status, details, actions }: Props) {
  return <article className="mrr-list-row">
    <div className="mrr-row-identity"><div className="mrr-row-id">{requestId}</div><div className="mrr-row-type">{type}</div></div>
    <div className="mrr-row-client"><div className="mrr-row-client-name">{client}</div><div className="mrr-row-retreat">{retreat || 'No retreat assigned'}</div></div>
    <div className="mrr-row-status">{status}</div>
    <dl className="mrr-row-details">{details}</dl>
    <div className="mrr-row-actions" aria-label="Review actions">{actions}</div>
  </article>;
}
