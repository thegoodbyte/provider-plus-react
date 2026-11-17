import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/authService', () => ({ authService: { logout: jest.fn() } }));
const mockUseAuth = useAuth as jest.Mock;

const view = (path: string) => render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/medical/review-groups/:id" element={<ProtectedRoute requiredRole={['medical_advisor']}><div>Allowed group</div></ProtectedRoute>} />
  <Route path="/medical/review-requests/:id/edit" element={<ProtectedRoute requiredRole={['medical_advisor']}><div>Allowed review</div></ProtectedRoute>} />
  <Route path="/medical/medical-dashboard" element={<ProtectedRoute requiredRole={['medical_advisor']}><div>Dashboard</div></ProtectedRoute>} />
  <Route path="/admin/users" element={<ProtectedRoute requiredRole={['admin']}><div>User Management page</div></ProtectedRoute>} />
  <Route path="/admin/permissions" element={<ProtectedRoute requiredRole={['admin']}><div>Permission Management page</div></ProtectedRoute>} />
  <Route path="/login" element={<div>Login required</div>} />
  <Route path="/unauthorized" element={<div>Unauthorized</div>} />
</Routes></MemoryRouter>);

describe('ProtectedRoute medical access', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lets a normally logged-in medical advisor open any packet they are assigned to, by direct URL', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'medical_advisor' } });
    view('/medical/review-groups/g1');
    expect(screen.getByText('Allowed group')).toBeInTheDocument();
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('lets a normally logged-in medical advisor freely navigate elsewhere in the app', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'medical_advisor' } });
    view('/medical/medical-dashboard');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('bounces a magic-link session that navigates elsewhere back to its own review, without logging it out', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'medical_advisor', accessType: 'medical_review_magic_link', medicalReviewRequestId: 'r1' } });
    view('/medical/medical-dashboard');
    expect(screen.getByText('Allowed review')).toBeInTheDocument();
    expect(authService.logout).not.toHaveBeenCalled();
  });

  it('logs out a magic-link session with no assigned review at all (a genuinely broken session)', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'medical_advisor', accessType: 'medical_review_magic_link', medicalReviewRequestId: undefined } });
    view('/medical/medical-dashboard');
    expect(screen.getByText('Login required')).toBeInTheDocument();
    expect(authService.logout).toHaveBeenCalled();
  });

  it('allows a magic-link session to open its assigned review directly', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'medical_advisor', accessType: 'medical_review_magic_link', medicalReviewRequestId: 'r1' } });
    view('/medical/review-requests/r1/edit');
    expect(screen.getByText('Allowed review')).toBeInTheDocument();
    expect(authService.logout).not.toHaveBeenCalled();
  });
});

describe('ProtectedRoute and the "Simple view" nav preference (PPVC-1036)', () => {
  beforeEach(() => jest.clearAllMocks());

  // PPVC-1036's navPreference is UI-density only (it narrows what AppleSidebar renders) and must
  // never restrict which routes an admin can actually open. A "simple view" admin navigating
  // directly to a URL for a page outside the 5 simple-nav sections (e.g. Settings & Setup's User
  // Management or Permission Management) must still reach it normally.
  it('still renders the Users admin page by direct URL for an admin with navPreference "simple"', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'admin', navPreference: 'simple' } });
    view('/admin/users');
    expect(screen.getByText('User Management page')).toBeInTheDocument();
  });

  it('still renders the Permissions admin page by direct URL for an admin with navPreference "simple"', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, user: { role: 'admin', navPreference: 'simple' } });
    view('/admin/permissions');
    expect(screen.getByText('Permission Management page')).toBeInTheDocument();
  });
});
