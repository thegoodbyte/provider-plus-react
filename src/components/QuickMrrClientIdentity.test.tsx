import { render, screen } from '@testing-library/react';
import QuickMrrClientIdentity from './QuickMrrClientIdentity';

it('shows the human client number and updates the identity when a different artifact is selected', () => {
  const { rerender } = render(<QuickMrrClientIdentity client={{ _id: 'internal-a', firstName: 'Ewa', lastName: 'Franus', display_id: 1333 } as any} />);
  expect(screen.getByText('Ewa Franus')).toBeInTheDocument();
  expect(screen.getByText('Client #1333')).toBeInTheDocument();
  rerender(<QuickMrrClientIdentity client={{ _id: 'internal-b', firstName: 'Anna', lastName: 'Kowalska', display_id: 1334 } as any} />);
  expect(screen.getByText('Anna Kowalska')).toBeInTheDocument();
  expect(screen.getByText('Client #1334')).toBeInTheDocument();
  expect(screen.queryByText('Ewa Franus')).not.toBeInTheDocument();
  expect(screen.queryByText('Client #1333')).not.toBeInTheDocument();
});
it.each([undefined, null, '507f1f77bcf86cd799439011', { _id: '507f1f77bcf86cd799439011' }, { display_id: '507f1f77bcf86cd799439011' }])('does not expose internal identifiers when client identity is unavailable: %j', client => {
  const { container } = render(<QuickMrrClientIdentity client={client as any} />);
  expect(screen.getByText('Client name unavailable')).toBeInTheDocument();
  expect(screen.getByText('Client ID unavailable')).toBeInTheDocument();
  expect(container).not.toHaveTextContent('507f1f77bcf86cd799439011');
});
it('supports legacy name fields without substituting email for a client name', () => {
  render(<QuickMrrClientIdentity client={{ fname: ' Ewa ', lname: ' Franus ', display_id: 1333 } as any} />);
  expect(screen.getByText('Ewa Franus')).toBeInTheDocument();
});
