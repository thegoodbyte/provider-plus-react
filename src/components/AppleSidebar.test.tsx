import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('collapses and expands the sidebar on toggle', () => {
    render(
      <AppleSidebar
        activeItem="launcher"
        isOpen
        onClose={jest.fn()}
        onItemClick={jest.fn()}
        onLogout={jest.fn()}
        userRole="admin"
        user={{
          email: 'admin@example.com',
          role: 'admin',
        }}
      />
    );

    expect(screen.getByText('Provider Plus')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Collapse sidebar'));
    expect(screen.queryByText('Provider Plus')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand sidebar'));
    expect(screen.getByText('Provider Plus')).toBeInTheDocument();
  });

  it('shows only receipt and expense navigation in shopping mode', () => {
    render(
      <AppleSidebar
        activeItem="expenses"
        isOpen
        onClose={jest.fn()}
        onItemClick={jest.fn()}
        onLogout={jest.fn()}
        userRole="admin"
        appMode="shopping"
      />
    );

    expect(screen.getByText('Shopping')).toBeInTheDocument();
    expect(screen.getByText('Receipts & expenses')).toBeInTheDocument();
    expect(screen.queryByText('Clients')).not.toBeInTheDocument();
    expect(screen.queryByText('Payments')).not.toBeInTheDocument();
  });

  it('shows only the selected retreat dashboard in retreat mode', () => {
    render(
      <AppleSidebar
        activeItem="selected-retreat"
        isOpen
        onClose={jest.fn()}
        onItemClick={jest.fn()}
        onLogout={jest.fn()}
        userRole="admin"
        appMode="retreat"
        selectedRetreatLabel="JULY-2026"
      />
    );

    expect(screen.getByText('JULY-2026')).toBeInTheDocument();
    expect(screen.getByText('Retreat dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Payment Requests')).not.toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });
});
