export type BookingStepTone = {
  label: string;
  groupCell: string;
  groupText: string;
  stepCell: string;
  badge: string;
  stepStripe: string;
  dot: string;
  border: string;
  ring: string;
};

export const BOOKING_STEP_TONES: Record<string, BookingStepTone> = {
  booking: {
    label: 'Booking Admin',
    groupCell: 'bg-sky-100',
    groupText: 'text-sky-950',
    stepCell: 'bg-sky-50',
    badge: 'bg-sky-200 text-sky-950',
    stepStripe: 'border-l-sky-400',
    dot: 'bg-sky-400',
    border: 'border-sky-300',
    ring: 'ring-sky-200',
  },
  admin: {
    label: 'Booking Admin',
    groupCell: 'bg-sky-100',
    groupText: 'text-sky-950',
    stepCell: 'bg-sky-50',
    badge: 'bg-sky-200 text-sky-950',
    stepStripe: 'border-l-sky-400',
    dot: 'bg-sky-400',
    border: 'border-sky-300',
    ring: 'ring-sky-200',
  },
  booking_admin: {
    label: 'Booking Admin',
    groupCell: 'bg-sky-100',
    groupText: 'text-sky-950',
    stepCell: 'bg-sky-50',
    badge: 'bg-sky-200 text-sky-950',
    stepStripe: 'border-l-sky-400',
    dot: 'bg-sky-400',
    border: 'border-sky-300',
    ring: 'ring-sky-200',
  },
  medical: {
    label: 'Medical',
    groupCell: 'bg-emerald-100',
    groupText: 'text-emerald-950',
    stepCell: 'bg-emerald-50',
    badge: 'bg-emerald-200 text-emerald-950',
    stepStripe: 'border-l-emerald-400',
    dot: 'bg-emerald-400',
    border: 'border-emerald-300',
    ring: 'ring-emerald-200',
  },
  questionnaire: {
    label: 'Questionnaires',
    groupCell: 'bg-violet-100',
    groupText: 'text-violet-950',
    stepCell: 'bg-violet-50',
    badge: 'bg-violet-200 text-violet-950',
    stepStripe: 'border-l-violet-400',
    dot: 'bg-violet-400',
    border: 'border-violet-300',
    ring: 'ring-violet-200',
  },
  questionnaires: {
    label: 'Questionnaires',
    groupCell: 'bg-violet-100',
    groupText: 'text-violet-950',
    stepCell: 'bg-violet-50',
    badge: 'bg-violet-200 text-violet-950',
    stepStripe: 'border-l-violet-400',
    dot: 'bg-violet-400',
    border: 'border-violet-300',
    ring: 'ring-violet-200',
  },
  questionaires: {
    label: 'Questionnaires',
    groupCell: 'bg-violet-100',
    groupText: 'text-violet-950',
    stepCell: 'bg-violet-50',
    badge: 'bg-violet-200 text-violet-950',
    stepStripe: 'border-l-violet-400',
    dot: 'bg-violet-400',
    border: 'border-violet-300',
    ring: 'ring-violet-200',
  },
  payment: {
    label: 'Payments',
    groupCell: 'bg-amber-100',
    groupText: 'text-amber-950',
    stepCell: 'bg-amber-50',
    badge: 'bg-amber-200 text-amber-950',
    stepStripe: 'border-l-amber-400',
    dot: 'bg-amber-400',
    border: 'border-amber-300',
    ring: 'ring-amber-200',
  },
  contract: {
    label: 'Contracts',
    groupCell: 'bg-indigo-100',
    groupText: 'text-indigo-950',
    stepCell: 'bg-indigo-50',
    badge: 'bg-indigo-200 text-indigo-950',
    stepStripe: 'border-l-indigo-400',
    dot: 'bg-indigo-400',
    border: 'border-indigo-300',
    ring: 'ring-indigo-200',
  },
  document: {
    label: 'Documents',
    groupCell: 'bg-indigo-100',
    groupText: 'text-indigo-950',
    stepCell: 'bg-indigo-50',
    badge: 'bg-indigo-200 text-indigo-950',
    stepStripe: 'border-l-indigo-400',
    dot: 'bg-indigo-400',
    border: 'border-indigo-300',
    ring: 'ring-indigo-200',
  },
  documents: {
    label: 'Documents',
    groupCell: 'bg-indigo-100',
    groupText: 'text-indigo-950',
    stepCell: 'bg-indigo-50',
    badge: 'bg-indigo-200 text-indigo-950',
    stepStripe: 'border-l-indigo-400',
    dot: 'bg-indigo-400',
    border: 'border-indigo-300',
    ring: 'ring-indigo-200',
  },
  dietary: {
    label: 'Dietary',
    groupCell: 'bg-lime-100',
    groupText: 'text-lime-950',
    stepCell: 'bg-lime-50',
    badge: 'bg-lime-200 text-lime-950',
    stepStripe: 'border-l-lime-400',
    dot: 'bg-lime-400',
    border: 'border-lime-300',
    ring: 'ring-lime-200',
  },
  message: {
    label: 'Messages',
    groupCell: 'bg-cyan-100',
    groupText: 'text-cyan-950',
    stepCell: 'bg-cyan-50',
    badge: 'bg-cyan-200 text-cyan-950',
    stepStripe: 'border-l-cyan-400',
    dot: 'bg-cyan-400',
    border: 'border-cyan-300',
    ring: 'ring-cyan-200',
  },
  access: {
    label: 'Access',
    groupCell: 'bg-fuchsia-100',
    groupText: 'text-fuchsia-950',
    stepCell: 'bg-fuchsia-50',
    badge: 'bg-fuchsia-200 text-fuchsia-950',
    stepStripe: 'border-l-fuchsia-400',
    dot: 'bg-fuchsia-400',
    border: 'border-fuchsia-300',
    ring: 'ring-fuchsia-200',
  },
  approval: {
    label: 'Approvals',
    groupCell: 'bg-teal-100',
    groupText: 'text-teal-950',
    stepCell: 'bg-teal-50',
    badge: 'bg-teal-200 text-teal-950',
    stepStripe: 'border-l-teal-400',
    dot: 'bg-teal-400',
    border: 'border-teal-300',
    ring: 'ring-teal-200',
  },
  reminder: {
    label: 'Reminders',
    groupCell: 'bg-rose-100',
    groupText: 'text-rose-950',
    stepCell: 'bg-rose-50',
    badge: 'bg-rose-200 text-rose-950',
    stepStripe: 'border-l-rose-400',
    dot: 'bg-rose-400',
    border: 'border-rose-300',
    ring: 'ring-rose-200',
  },
  other: {
    label: 'Other',
    groupCell: 'bg-slate-100',
    groupText: 'text-slate-950',
    stepCell: 'bg-slate-50',
    badge: 'bg-slate-200 text-slate-950',
    stepStripe: 'border-l-slate-400',
    dot: 'bg-slate-400',
    border: 'border-slate-300',
    ring: 'ring-slate-200',
  },
};

export const normalizeBookingStepGroup = (value?: string | null) => (
  String(value || 'other').trim().toLowerCase().replace(/[\s-]+/g, '_') || 'other'
);

export const getBookingStepTone = (groupKey?: string | null): BookingStepTone => {
  const normalized = normalizeBookingStepGroup(groupKey);
  return BOOKING_STEP_TONES[normalized] || BOOKING_STEP_TONES.other;
};

export const titleizeBookingStepGroup = (value?: string | null) => {
  const normalized = normalizeBookingStepGroup(value);
  const tone = BOOKING_STEP_TONES[normalized];
  if (tone) return tone.label;
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const getBookingStepGroupKey = (step?: any) => {
  const template = typeof step?.templateId === 'object' ? step.templateId : null;
  return String(
    step?.metadata?.readinessGroup ||
    step?.readinessGroup ||
    template?.readinessGroup ||
    step?.category ||
    template?.category ||
    'other',
  );
};
