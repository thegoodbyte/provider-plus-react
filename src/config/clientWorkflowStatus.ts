export const clientWorkflowStatusAliases: Record<string, string> = {
  potential: 'entered',
  screening: 'screening_scheduled',
  approved: 'screened_accepted',
  rejected: 'screened_declined',
  booked: 'booked_paid',
  completed: 'retreat_completed',
};

export const clientWorkflowStatusValues = [
  'entered',
  'screening_scheduled',
  'screened_accepted',
  'screened_declined',
  'payment_request_sent',
  'booked_paid',
  'retreat_completed',
  'cancelled',
  'blacklisted',
] as const;

export const clientWorkflowStatusLegacyValues = Object.keys(clientWorkflowStatusAliases) as Array<keyof typeof clientWorkflowStatusAliases>;

export type ClientWorkflowStatus = typeof clientWorkflowStatusValues[number];

export const clientWorkflowStatusLabels: Record<ClientWorkflowStatus | keyof typeof clientWorkflowStatusAliases, string> = {
  entered: 'Entered',
  screening_scheduled: 'Screening scheduled',
  screened_accepted: 'Screened accepted',
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

export const clientWorkflowStatusTone: Record<ClientWorkflowStatus, string> = {
  entered: 'bg-blue-100 text-blue-800',
  screening_scheduled: 'bg-amber-100 text-amber-800',
  screened_accepted: 'bg-emerald-100 text-emerald-800',
  screened_declined: 'bg-red-100 text-red-800',
  payment_request_sent: 'bg-yellow-100 text-yellow-800',
  booked_paid: 'bg-violet-100 text-violet-800',
  retreat_completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-slate-100 text-slate-800',
  blacklisted: 'bg-black text-white',
};

export const clientWorkflowStatusSelectOptions = [
  'entered',
  'screening_scheduled',
  'screened_accepted',
  'screened_declined',
  'payment_request_sent',
  'booked_paid',
  'retreat_completed',
  'cancelled',
  'blacklisted',
] as const satisfies readonly ClientWorkflowStatus[];

export const clientWorkflowStatusAliasKeys = Object.keys(clientWorkflowStatusAliases) as Array<keyof typeof clientWorkflowStatusAliases>;

export const clientWorkflowStatusLeadValues = ['entered', 'screening_scheduled'] as const satisfies readonly ClientWorkflowStatus[];
export const clientWorkflowStatusBookedValues = ['screened_accepted', 'payment_request_sent', 'booked_paid', 'retreat_completed'] as const satisfies readonly ClientWorkflowStatus[];
export const clientWorkflowStatusTerminalValues = ['screened_declined', 'cancelled', 'blacklisted'] as const satisfies readonly ClientWorkflowStatus[];

export const leadWorkflowStatuses = new Set<ClientWorkflowStatus>(clientWorkflowStatusLeadValues);
export const bookedWorkflowStatuses = new Set<ClientWorkflowStatus>(clientWorkflowStatusBookedValues);
export const terminalWorkflowStatuses = new Set<ClientWorkflowStatus>(clientWorkflowStatusTerminalValues);

export const isBookedClient = (client: { status?: string | null; workflowStatus?: string | null }) => {
  const workflowStatus = normalizeClientWorkflowStatus(client.workflowStatus || undefined);
  return client.status === 'booked' || workflowStatus === 'booked_paid';
};

export const normalizeClientWorkflowStatus = (status?: string | null): ClientWorkflowStatus => {
  const normalized = status ? clientWorkflowStatusAliases[status] || status : 'entered';
  return clientWorkflowStatusValues.includes(normalized as ClientWorkflowStatus) ? normalized as ClientWorkflowStatus : 'entered';
};
