import React from 'react';
import { render, screen } from '@testing-library/react';
import PermissionsMatrix from './PermissionsMatrix';

// PPVC-1009: this page previously used raw bg-white rounded-lg shadow-sm cards and a
// plain table for the role/feature matrix, with no shared kit usage.
describe('PermissionsMatrix (PPVC-1009)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the role legend and permissions matrix inside the shared Card surface', () => {
    const { container } = render(<PermissionsMatrix />);
    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Permission Management' })).toBeInTheDocument();
    expect(container.querySelectorAll('.border-apple-gray-200.shadow-apple-sm').length).toBeGreaterThanOrEqual(3);
  });

  it('toggles a permission checkbox and shows unsaved changes', () => {
    render(<PermissionsMatrix />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes[0].click();
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
  });
});
