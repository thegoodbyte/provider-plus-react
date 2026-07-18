import React from 'react';
import { Activity, FilePlus2, HeartPulse, Leaf } from 'lucide-react';
import { MedicalReviewRequest } from '../types';

type MedicalReviewTypeBadgeProps = {
  requestType?: MedicalReviewRequest['requestType'] | string;
  className?: string;
};

type BadgeConfig = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  className: string;
  iconClassName: string;
};

const badgeConfigByType: Record<string, BadgeConfig> = {
  ekg: { label: 'EKG', Icon: HeartPulse, className: 'border-red-200 bg-red-50 text-red-700', iconClassName: 'text-red-700' },
  ekg_review: { label: 'EKG', Icon: HeartPulse, className: 'border-red-200 bg-red-50 text-red-700', iconClassName: 'text-red-700' },
  ceremony_ekg_review: { label: 'EKG', Icon: HeartPulse, className: 'border-red-200 bg-red-50 text-red-700', iconClassName: 'text-red-700' },
  liver: { label: 'LVR', Icon: Leaf, className: 'border-green-200 bg-green-50 text-green-700', iconClassName: 'text-green-700' },
  liver_panel: { label: 'LVR', Icon: Leaf, className: 'border-green-200 bg-green-50 text-green-700', iconClassName: 'text-green-700' },
  liver_panel_review: { label: 'LVR', Icon: Leaf, className: 'border-green-200 bg-green-50 text-green-700', iconClassName: 'text-green-700' },
  bp: { label: 'BP', Icon: Activity, className: 'border-blue-200 bg-blue-50 text-blue-700', iconClassName: 'text-blue-700' },
  blood_pressure: { label: 'BP', Icon: Activity, className: 'border-blue-200 bg-blue-50 text-blue-700', iconClassName: 'text-blue-700' },
  blood_pressure_review: { label: 'BP', Icon: Activity, className: 'border-blue-200 bg-blue-50 text-blue-700', iconClassName: 'text-blue-700' },
  additional: { label: 'ADL', Icon: FilePlus2, className: 'border-gray-200 bg-gray-50 text-gray-700', iconClassName: 'text-gray-700' },
};

const normalizeType = (value?: string) => String(value || '').trim().toLowerCase();

const MedicalReviewTypeBadge: React.FC<MedicalReviewTypeBadgeProps> = ({ requestType, className }) => {
  const normalized = normalizeType(requestType);
  const config = badgeConfigByType[normalized] || {
    label: requestType ? String(requestType).replace(/_/g, ' ').toUpperCase() : 'MEDICAL',
    Icon: FilePlus2,
    className: 'border-gray-200 bg-gray-50 text-gray-700',
    iconClassName: 'text-gray-700',
  };

  return (
    <span
      className={[
        `inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${config.className}`,
        className || '',
      ].join(' ')}
    >
      <config.Icon className={`h-3.5 w-3.5 ${config.iconClassName}`} />
      {config.label}
    </span>
  );
};

export default MedicalReviewTypeBadge;
