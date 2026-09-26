import React from 'react';
import { Activity, ClipboardList, FilePlus2, FileQuestion, HeartPulse, Leaf, Pill, Scale, Utensils } from 'lucide-react';

const types = {
  ekg: { label: 'EKG', Icon: HeartPulse, className: 'border-red-200 bg-red-50 text-red-700' },
  liver: { label: 'Liver panel', Icon: Leaf, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  bp: { label: 'Blood pressure', Icon: Activity, className: 'border-blue-200 bg-blue-50 text-blue-700' },
  medications: { label: 'Medications', Icon: Pill, className: 'border-purple-200 bg-purple-50 text-purple-700' },
  questionnaire: { label: 'Questionnaire', Icon: ClipboardList, className: 'border-cyan-200 bg-cyan-50 text-cyan-700' },
  food: { label: 'Food form', Icon: Utensils, className: 'border-orange-200 bg-orange-50 text-orange-700' },
  contract: { label: 'Contract', Icon: Scale, className: 'border-amber-200 bg-amber-50 text-amber-800' },
  question: { label: 'Question', Icon: FileQuestion, className: 'border-indigo-200 bg-indigo-50 text-indigo-700' },
  other: { label: 'Other', Icon: FilePlus2, className: 'border-gray-200 bg-gray-50 text-gray-700' },
};
const aliases: Record<string, keyof typeof types> = {
  ecg: 'ekg', ceremony_ekg: 'ekg', liver_panel: 'liver', blood_pressure: 'bp',
  meds: 'medications', medication_list: 'medications', medications_form: 'medications',
  health_questionnaire: 'questionnaire', food_intake: 'food', food_form: 'food', dietary: 'food',
  contract_signed: 'contract', signed_contract: 'contract', client_contract: 'contract',
  client_agreement: 'contract', signed_client_agreement: 'contract', additional: 'other',
};
export const getMedicalDocumentType = (...values: Array<string | undefined>) => {
  for (const value of values) {
    const key = String(value || '').trim().toLowerCase().replace(/[ -]+/g, '_').replace(/_review$/, '');
    const canonical = aliases[key] || key;
    if (canonical !== 'other' && Object.prototype.hasOwnProperty.call(types, canonical)) return types[canonical as keyof typeof types];
  }
  return { ...types.other, label: values.find(Boolean)?.replace(/_/g, ' ') || 'Other' };
};

/** Shared 24px type symbol; adjacent labels remain the primary accessible text. */
const MedicalDocumentTypeIcon = ({ type, fallbackType }: { type?: string; fallbackType?: string }) => {
  const config = getMedicalDocumentType(type, fallbackType);
  return <span title={config.label} className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${config.className}`}><config.Icon aria-hidden="true" className="h-6 w-6 shrink-0" /></span>;
};
export default MedicalDocumentTypeIcon;
