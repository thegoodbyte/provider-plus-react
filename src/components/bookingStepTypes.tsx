import React from 'react';
import { Bell, ClipboardCheck, ClipboardList, CreditCard, FileCheck2, Send, UserRoundCheck, Wrench } from 'lucide-react';
import { BookingFlowTemplate } from '../types';

export type BookingStepType = NonNullable<BookingFlowTemplate['stepType']>;

export const BOOKING_STEP_TYPES: Array<{ value: BookingStepType; label: string; description: string; icon: React.ElementType }> = [
  { value: 'notification_sent', label: 'Notification sent', description: 'Information was sent; no submission is expected.', icon: Bell },
  { value: 'request_sent', label: 'Request sent', description: 'The client was asked to complete or provide something.', icon: Send },
  { value: 'submission_received', label: 'Submission received', description: 'A requested document, form, or reading arrived.', icon: FileCheck2 },
  { value: 'review_requested', label: 'Review requested', description: 'A submission was handed to a reviewer.', icon: ClipboardList },
  { value: 'review_completed', label: 'Review completed', description: 'A reviewer recorded a result or decision.', icon: UserRoundCheck },
  { value: 'payment_received', label: 'Payment received', description: 'A required payment milestone was completed.', icon: CreditCard },
  { value: 'internal_task', label: 'Internal task', description: 'An operational staff action was completed.', icon: Wrench },
];

export const inferBookingStepType = (key = ''): BookingStepType => {
  if (['payment_received', 'payment_balance_due'].includes(key)) return 'payment_received';
  if (key.endsWith('_mrr_sent')) return 'review_requested';
  if (key.endsWith('_review_result') || key.endsWith('_reviewed')) return 'review_completed';
  if (key.endsWith('_received') || key === 'contract_signed') return 'submission_received';
  if (['payment_request_sent', 'medical_labs_requested', 'blood_pressure_requested', 'contract_sent', 'medications_form_initial_sent', 'medications_form_30_day_sent', 'questionnaire_sent', 'food_form_sent'].includes(key)) return 'request_sent';
  if (['booking_confirmation_sent', 'no_coffee_sent', 'no_food_sent', 'address_sent', 'prep_instructions_sent'].includes(key)) return 'notification_sent';
  return 'internal_task';
};

export const getBookingStepType = (value?: string, key?: string) => BOOKING_STEP_TYPES.find((item) => item.value === (value || inferBookingStepType(key))) || { value: 'internal_task' as const, label: 'Internal task', description: 'An operational staff action was completed.', icon: ClipboardCheck };

export const BookingStepTypeIcon = ({ type, stepKey, className = 'h-4 w-4' }: { type?: string; stepKey?: string; className?: string }) => {
  const Icon = getBookingStepType(type, stepKey).icon;
  return <Icon className={className} aria-hidden="true" />;
};
