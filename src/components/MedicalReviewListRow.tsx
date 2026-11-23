import React from 'react';
import { Tooltip } from 'antd';
import { Info } from 'lucide-react';
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
    <div className="mrr-row-info" role="cell">
      <Tooltip
        trigger={['hover', 'focus', 'click']}
        title={<div className="mrr-info-tooltip">
          <div><span className="mrr-info-tooltip-label">Created</span>{created}</div>
          <div><span className="mrr-info-tooltip-label">Artifact received</span>{received}</div>
        </div>}
      >
        <button type="button" className="mrr-icon-button" aria-label="Show created and artifact-received details">
          <Info size={16} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>
    <div className="mrr-row-advisor" role="cell"><span className="mrr-cell-label">Medical advisor</span>{advisor}</div>
    <div className="mrr-row-status" role="cell">{status}<div className="mrr-row-stage">{stage}</div></div>
    <div className="mrr-row-actions" role="cell" aria-label="Review actions">{actions}</div>
  </article>;
}
