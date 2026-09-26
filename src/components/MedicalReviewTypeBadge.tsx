import React from 'react';
import { getMedicalDocumentType } from './MedicalDocumentTypeIcon';

const MedicalReviewTypeBadge = ({ requestType, className = '' }: { requestType?: string; className?: string }) => {
  const config = getMedicalDocumentType(requestType);
  return <span className={`inline-flex max-w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-xs font-semibold ${config.className} ${className}`}>
    <config.Icon aria-hidden="true" className="h-6 w-6 shrink-0" />
    <span>{config.label}</span>
  </span>;
};
export default MedicalReviewTypeBadge;
