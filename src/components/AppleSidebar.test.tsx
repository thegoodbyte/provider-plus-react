import React from 'react';
import { render, screen } from '@testing-library/react';
import AppleSidebar from './AppleSidebar';

describe('AppleSidebar impersonation navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sidebarCollapsed', 'false');
  });

  it('shows the impersonated medical advisor menu instead of admin navigation', () => {
    render(
      <AppleSidebar
        activeItem="medical-dashboard"
        isOpen
        onClose={jest.fn()}
        onItemClick={jest.fn()}
        onLogout={jest.fn()}
        userRole="medical_advisor"
        user={{
          email: 'advisor@example.com',
          role: 'medical_advisor',
          originalRole: 'admin',
          impersonatedBy: 'admin-1',
          impersonationType: 'medical_staff_preview',
        }}
      />
    );

    expect(screen.getByText('Medical')).toBeInTheDocument();
    expect(screen.getByText('Medical Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Review Requests')).toBeInTheDocument();
    expect(screen.queryByText('Permissions')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument();
    expect(screen.queryByText('Data Backup')).not.toBeInTheDocument();
  });
});
