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
