import React from 'react';
import './MedicalReviewListRow.css';
interface Props {
  requestId: React.ReactNode;
  client: React.ReactNode;
  clientNumber?: string;
  retreat?: string;
  type: React.ReactNode;
  status: React.ReactNode;
  stage: React.ReactNode;
  created: React.ReactNode;
  received: React.ReactNode;
  advisor: React.ReactNode;
  actions: React.ReactNode;
}
export default function MedicalReviewListRow({ requestId, client, clientNumber, retreat, type, status, stage, created, received, advisor, actions }: Props) {
  return <article className="mrr-list-row" role="row">
    <div className="mrr-row-identity" role="cell"><div className="mrr-row-id">{requestId}</div><div className="mrr-row-type">{type}</div></div>
    <div className="mrr-row-client" role="cell"><div className="mrr-row-client-name">{client}</div><div className="mrr-row-retreat">{[clientNumber,retreat || 'Unknown Retreat'].filter(Boolean).join(' · ')}</div></div>
    <div className="mrr-row-created" role="cell"><span className="mrr-cell-label">Created</span>{created}</div>
    <div className="mrr-row-received" role="cell"><span className="mrr-cell-label">Artifact received</span>{received}</div>
    <div className="mrr-row-advisor" role="cell"><span className="mrr-cell-label">Medical advisor</span>{advisor}</div>
    <div className="mrr-row-status" role="cell">{status}<div className="mrr-row-stage">{stage}</div></div>
    <div className="mrr-row-actions" role="cell" aria-label="Review actions">{actions}</div>
  </article>;
}
