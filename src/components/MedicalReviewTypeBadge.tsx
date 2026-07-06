import React from 'react';
import { FilePlus2, HeartPulse, Leaf } from 'lucide-react';
import { MedicalReviewRequest } from '../types';

type MedicalReviewTypeBadgeProps = {
  requestType?: MedicalReviewRequest['requestType'] | string;
  className?: string;
};

type BadgeConfig = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const badgeConfigByType: Record<string, BadgeConfig> = {
  ekg: { label: 'EKG', Icon: HeartPulse },
  ekg_review: { label: 'EKG', Icon: HeartPulse },
  ceremony_ekg_review: { label: 'EKG', Icon: HeartPulse },
  liver: { label: 'LVR', Icon: Leaf },
  liver_panel: { label: 'LVR', Icon: Leaf },
  liver_panel_review: { label: 'LVR', Icon: Leaf },
  additional: { label: 'ADL', Icon: FilePlus2 },
};

const normalizeType = (value?: string) => String(value || '').trim().toLowerCase();

const MedicalReviewTypeBadge: React.FC<MedicalReviewTypeBadgeProps> = ({ requestType, className }) => {
  const normalized = normalizeType(requestType);
  const config = badgeConfigByType[normalized] || {
    label: requestType ? String(requestType).replace(/_/g, ' ').toUpperCase() : 'MEDICAL',
    Icon: FilePlus2,
  };

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700',
        className || '',
      ].join(' ')}
    >
      <config.Icon className="h-3.5 w-3.5 text-blue-700" />
      {config.label}
    </span>
  );
};

export default MedicalReviewTypeBadge;
