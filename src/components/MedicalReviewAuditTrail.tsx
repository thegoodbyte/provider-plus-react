import React from 'react';
import { MedicalReviewRequest } from '../types';

export const MedicalReviewAuditTrail = ({ request }: { request: MedicalReviewRequest }) => (
  <details className="my-4 rounded-md border border-gray-200 p-3" open>
    <summary className="cursor-pointer font-semibold">Approval audit trail</summary>
    {request.decisionHistory?.length ? [...request.decisionHistory].reverse().map((entry, index) => (
      <article key={index} className="mt-3 rounded bg-gray-50 p-3 text-sm">
        <strong>{entry.decision || entry.status || 'Decision recorded'}</strong>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <div><dt>Recorded by (actual user)</dt><dd>{entry.actualActorName || 'Not recorded (legacy entry)'}{entry.actualActorEmail && entry.actualActorEmail !== entry.actualActorName ? ` · ${entry.actualActorEmail}` : ''}</dd></div>
          <div><dt>Approval / decision time (UTC)</dt><dd>{entry.reviewedAt && !Number.isNaN(new Date(entry.reviewedAt).getTime()) ? new Date(entry.reviewedAt).toISOString().replace('T', ' ').replace('Z', ' UTC') : 'Not recorded'}</dd></div>
          <div><dt>IP address</dt><dd>{entry.ipAddress || 'Not recorded'}</dd></div>
          <div><dt>Access method</dt><dd>{entry.accessType || 'Not recorded'}</dd></div>
          {entry.onBehalfOfName && <div><dt>On behalf of</dt><dd>{entry.onBehalfOfName}</dd></div>}
          {entry.delegationReason && <div><dt>Reason for delegated approval</dt><dd>{entry.delegationReason}</dd></div>}
          {!entry.actualActorName && entry.reviewedBy && <div><dt>Previously recorded reviewer</dt><dd>{entry.reviewedBy}</dd></div>}
        </dl>
        <p className="mt-2 whitespace-pre-wrap">{entry.medicalStaffNotes || entry.overallNotes || entry.notes || 'No notes recorded'}</p>
        {entry.fileReviews?.map((file, fileIndex) => <p key={fileIndex}>{file.fileName || file.fileKey || `File ${fileIndex + 1}`}: {file.decision || 'No decision'}{file.notes ? ` — ${file.notes}` : ''}</p>)}
      </article>
    )) : <p className="mt-2 text-sm">No decision history recorded.</p>}
  </details>
);
