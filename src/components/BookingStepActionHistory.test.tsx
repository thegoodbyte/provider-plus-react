import React from 'react';
import { render, screen } from '@testing-library/react';
import BookingStepActionHistory, { describeBookingStepActionLog, getBookingStepActionLogDate, sortBookingStepActionLogs } from './BookingStepActionHistory';

describe('BookingStepActionHistory', () => {
  it('uses performed date before created date and sorts without mutation', () => {
    const old: any = { _id: 'old', performedAt: '2026-01-01', createdAt: '2026-03-01' };
    const recent: any = { _id: 'recent', createdAt: '2026-02-01' };
    const undated: any = { _id: 'undated' };
    const logs = [old, undated, recent];
    expect(getBookingStepActionLogDate(old)).toBe('2026-01-01');
    expect(getBookingStepActionLogDate(recent)).toBe('2026-02-01');
    expect(sortBookingStepActionLogs(logs).map((log) => log._id)).toEqual(['recent', 'old', 'undated']);
    expect(logs[0]).toBe(old);
  });

  it('describes available audit details and has a safe fallback', () => {
    expect(describeBookingStepActionLog({ performedAt: '2026-01-01', metadata: { sentEmailDisplayId: 42 }, performedByEmail: 'admin@test.com', statusAfter: 'sent_for_review' } as any)).toContain('Email #42 • admin@test.com • Status: sent for review');
    expect(describeBookingStepActionLog({} as any)).toBe('Recorded action');
  });

  it('renders nothing for empty history', () => {
    const { container } = render(<BookingStepActionHistory label="Send" logs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders count, sorted details, notes and labels', () => {
    render(<BookingStepActionHistory label="Send" logs={[
      { _id: 'old', performedAt: '2026-01-01', notes: 'Old note', actionLabel: 'Old action' },
      { createdAt: '2026-02-01', notes: 'Recent note', actionLabel: 'Recent action' },
    ] as any} />);
    expect(screen.getByRole('button')).toHaveTextContent(/Send: 2x, last/);
    expect(screen.getByText('Send history')).toBeInTheDocument();
    expect(screen.getByText('Recent note')).toBeInTheDocument();
    expect(screen.getByText('Old note')).toBeInTheDocument();
    expect(screen.getByText('Recent action')).toBeInTheDocument();
  });

  it('renders an undated latest action without a last-date suffix', () => {
    render(<BookingStepActionHistory label="Manual" logs={[{ notes: 'Only action' }] as any} />);
    expect(screen.getByRole('button')).toHaveTextContent('Manual: 1x');
    expect(screen.getByRole('button')).not.toHaveTextContent('last');
  });
});
