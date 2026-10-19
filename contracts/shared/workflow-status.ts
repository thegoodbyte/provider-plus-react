// Generated from the API-owned shared contract. Do not edit this snapshot.
export const clientWorkflowStatusAliases: Record<string, string> = {
  potential: 'entered',
  screening: 'screening_scheduled',
  approved: 'screened_accepted',
  rejected: 'screened_declined',
  booked: 'booked_paid',
  completed: 'retreat_completed',
};

export const clientWorkflowStatusValues = [
  'self_submit',
  'entered',
  'screening_scheduled',
  'screened_accepted',
  'screened_conditional',
  'screened_declined',
  'payment_request_sent',
  'booked_paid',
  'retreat_completed',
  'cancelled',
  'blacklisted',
] as const;

export type ClientWorkflowStatus = typeof clientWorkflowStatusValues[number];

export const clientWorkflowStatusLabels: Record<ClientWorkflowStatus | keyof typeof clientWorkflowStatusAliases, string> = {
  self_submit: 'Self-submit',
  entered: 'Entered',
  screening_scheduled: 'Screening scheduled',
  screened_accepted: 'Screened accepted',
  screened_conditional: 'Screened conditional',
  screened_declined: 'Screened declined',
  payment_request_sent: 'Payment request sent',
  booked_paid: 'Booked - paid',
  retreat_completed: 'Retreat - completed',
  cancelled: 'Cancelled',
  blacklisted: 'Blacklisted',
  potential: 'Entered',
  screening: 'Screening scheduled',
  approved: 'Screened accepted',
  rejected: 'Screened declined',
  booked: 'Booked - paid',
  completed: 'Retreat - completed',
};

export const clientWorkflowStatusLeadValues = ['entered', 'screening_scheduled'] as const satisfies readonly ClientWorkflowStatus[];
export const clientWorkflowStatusBookedValues = ['screened_accepted', 'screened_conditional', 'payment_request_sent', 'booked_paid', 'retreat_completed'] as const satisfies readonly ClientWorkflowStatus[];
export const clientWorkflowStatusTerminalValues = ['screened_declined', 'cancelled', 'blacklisted'] as const satisfies readonly ClientWorkflowStatus[];

export const leadWorkflowStatuses = new Set<ClientWorkflowStatus>(clientWorkflowStatusLeadValues);
export const bookedWorkflowStatuses = new Set<ClientWorkflowStatus>(clientWorkflowStatusBookedValues);
export const terminalWorkflowStatuses = new Set<ClientWorkflowStatus>(clientWorkflowStatusTerminalValues);

export const normalizeClientWorkflowStatus = (status?: string | null): ClientWorkflowStatus | undefined => {
  if (!status) return undefined;
  const normalized = clientWorkflowStatusAliases[status] || status;
  return clientWorkflowStatusValues.includes(normalized as ClientWorkflowStatus)
    ? normalized as ClientWorkflowStatus
    : undefined;
};
