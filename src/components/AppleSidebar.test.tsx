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
    expect(screen.queryByText('Permission Management')).not.toBeInTheDocument();
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
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
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });

  it('filters permitted menu items and keeps matching sections open', () => {
    render(
      <AppleSidebar
        activeItem="launcher"
        isOpen
        onClose={jest.fn()}
        onItemClick={jest.fn()}
        onLogout={jest.fn()}
        userRole="admin"
      />
    );

    fireEvent.change(screen.getByLabelText('Search menu'), { target: { value: 'booking' } });

    expect(screen.getAllByText('Bookings').length).toBeGreaterThan(0);
    expect(screen.getByText('Booking settings')).toBeInTheDocument();
    expect(screen.getByText('Booking Requirements')).toBeInTheDocument();
    expect(screen.queryByText('Document Types & Libraries')).not.toBeInTheDocument();
    expect(screen.queryByText('Clients')).not.toBeInTheDocument();
    expect(screen.queryByText('Payments')).not.toBeInTheDocument();
  });

  it('shows an empty state and can clear the menu filter', () => {
    render(
      <AppleSidebar
        activeItem="launcher"
        isOpen
        onClose={jest.fn()}
        onItemClick={jest.fn()}
        onLogout={jest.fn()}
        userRole="admin"
      />
    );

    fireEvent.change(screen.getByLabelText('Search menu'), { target: { value: 'not-a-menu-item' } });
    expect(screen.getByText('No menu items found')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Clear menu search'));
    expect(screen.getByText('Clients')).toBeInTheDocument();
  });
});

it('limits payment focus to its permitted tools without exposing settings, and preserves medical session navigation',()=>{
 const p={activeItem:'payments',isOpen:true,onClose:jest.fn(),onItemClick:jest.fn(),onLogout:jest.fn(),userRole:'admin'};
 const v=render(<AppleSidebar {...p} staffFocus="payments"/>);
 expect(screen.getByText('Process payments')).toBeVisible();expect(screen.getByText('Choose work mode')).toBeVisible();expect(screen.queryByText('User Management')).not.toBeInTheDocument();
 v.rerender(<AppleSidebar {...p} staffFocus="tasks" focusedWorkMode/>);
 expect(screen.getByText('Medical work mode')).toBeVisible();expect(screen.queryByText('Process payments')).not.toBeInTheDocument();
});

describe('AppleSidebar "Simple view" nav preference (PPVC-1036)', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sidebarCollapsed', 'false');
  });

  const baseProps = {
    activeItem: 'launcher',
    isOpen: true,
    onClose: jest.fn(),
    onItemClick: jest.fn(),
    onLogout: jest.fn(),
    userRole: 'admin',
  };

  it('renders exactly the 6 simple-view sections (incl. Medical, PPVC-1070) and no Settings & Setup when navPreference is simple', () => {
    render(
      <AppleSidebar
        {...baseProps}
        user={{ email: 'partner@example.com', role: 'admin', navPreference: 'simple' }}
      />
    );

    // The 6 permitted sections are present.
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Retreat Operations')).toBeInTheDocument();
    expect(screen.getByText('Medical')).toBeInTheDocument();

    // Nothing else -- no Settings & Setup, no other sections/items that only exist outside the 6.
    expect(screen.queryByText('Settings & Setup')).not.toBeInTheDocument();
    expect(screen.queryByText('Client Forms')).not.toBeInTheDocument();
    expect(screen.queryByText('Operations')).not.toBeInTheDocument();
    expect(screen.queryByText('Files & Reports')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity')).not.toBeInTheDocument();
    expect(screen.queryByText('Focused work')).not.toBeInTheDocument();
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
    expect(screen.queryByText('Permission Management')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Logs')).not.toBeInTheDocument();
    expect(screen.queryByText('Data Backup')).not.toBeInTheDocument();
    expect(screen.queryByText('Languages')).not.toBeInTheDocument();

    // Exactly 6 top-level section buttons were rendered.
    const sectionButtons = screen.getAllByRole('button').filter((button) =>
      ['Home', 'Clients', 'Bookings', 'Payments', 'Retreat Operations', 'Medical'].includes(button.textContent?.trim() || '')
    );
    expect(sectionButtons).toHaveLength(6);

    // Medical expands to its two daily-work items, matching the full view's same section.
    fireEvent.click(screen.getByText('Medical'));
    expect(screen.getByText('Medical Artifacts')).toBeInTheDocument();
    expect(screen.getByText('Review Requests')).toBeInTheDocument();
  });

  it('renders the full current section set when navPreference is "full" (regression guard)', () => {
    render(
      <AppleSidebar
        {...baseProps}
        user={{ email: 'owner@example.com', role: 'admin', navPreference: 'full' }}
      />
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Bookings')).toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Retreat Operations')).toBeInTheDocument();
    expect(screen.getByText('Settings & Setup')).toBeInTheDocument();
    expect(screen.getByText('Medical')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
  });

  it('renders the full current section set when navPreference is unset (regression guard for existing users)', () => {
    render(
      <AppleSidebar
        {...baseProps}
        user={{ email: 'legacy-admin@example.com', role: 'admin' }}
      />
    );

    expect(screen.getByText('Settings & Setup')).toBeInTheDocument();
    expect(screen.getByText('Medical')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
  });

  it('also renders the full nav set when the user prop is absent entirely', () => {
    render(<AppleSidebar {...baseProps} />);
    expect(screen.getByText('Settings & Setup')).toBeInTheDocument();
  });
});
