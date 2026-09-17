import React from 'react';
import { render, screen } from '@testing-library/react';
import { MedicalReviewAuditTrail } from './MedicalReviewAuditTrail';

it('shows the real operator separately from the represented advisor with time and IP', () => {
  render(<MedicalReviewAuditTrail request={{ decisionHistory: [{ decision: 'OK', actualActorName: 'Martin', actualActorEmail: 'martin@example.com', onBehalfOfName: 'Seeda', delegationReason: 'Confirmed by phone', reviewedAt: '2026-09-17T08:30:00Z', ipAddress: '192.0.2.5', accessType: 'authenticated' }] } as any} />);
  expect(screen.getByText('Martin · martin@example.com')).toBeInTheDocument();
  expect(screen.getByText('Seeda')).toBeInTheDocument();
  expect(screen.getByText('2026-09-17 08:30:00.000 UTC')).toBeInTheDocument();
  expect(screen.getByText('192.0.2.5')).toBeInTheDocument();
  expect(screen.getByText('Confirmed by phone')).toBeInTheDocument();
});
it('does not misrepresent a legacy reviewer label as a verified actor', () => {
  render(<MedicalReviewAuditTrail request={{ decisionHistory: [{ reviewedBy: 'Seeda' }] } as any} />);
  expect(screen.getByText('Not recorded (legacy entry)')).toBeInTheDocument();
  expect(screen.getByText('Previously recorded reviewer')).toBeInTheDocument();
});
