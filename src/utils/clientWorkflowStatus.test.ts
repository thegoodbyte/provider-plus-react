import { clientWorkflowStatusLabels, normalizeClientWorkflowStatus } from './clientWorkflowStatus';

describe('clientWorkflowStatus', () => {
  it('normalizes legacy workflow aliases to the new lifecycle statuses', () => {
    expect(normalizeClientWorkflowStatus('potential')).toBe('entered');
    expect(normalizeClientWorkflowStatus('screening')).toBe('screening_scheduled');
    expect(normalizeClientWorkflowStatus('approved')).toBe('screened_accepted');
    expect(normalizeClientWorkflowStatus('rejected')).toBe('screened_declined');
    expect(normalizeClientWorkflowStatus('booked')).toBe('booked_paid');
    expect(normalizeClientWorkflowStatus('completed')).toBe('retreat_completed');
  });

  it('returns user-facing labels for the canonical statuses', () => {
    expect(clientWorkflowStatusLabels.entered).toBe('Entered');
    expect(clientWorkflowStatusLabels.screening_scheduled).toBe('Screening scheduled');
    expect(clientWorkflowStatusLabels.booked_paid).toBe('Booked - paid');
  });
});
