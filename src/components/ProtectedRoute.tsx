import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
  fallbackPath?: string;
}

// Role hierarchy - higher roles inherit permissions from lower roles
const ROLE_HIERARCHY = {
  admin: 4,
  medical_advisor: 3,
  medical_staff: 3, // Alias for backwards compatibility
  facilitator: 2,
  user: 1
};

// Route prefix to minimum role mapping
const ROUTE_PERMISSIONS: Record<string, string> = {
  '/admin': 'admin',
  '/medical': 'medical_staff',
  '/staff': 'facilitator',
  '/user': 'user',
  // Default routes (backwards compatibility)
  '/medical-tracking': 'medical_staff',
  '/clients': 'user',
  '/bookings': 'facilitator',
  '/houses': 'facilitator',
  '/retreats': 'facilitator',
  '/payments': 'admin',
  '/requirements': 'admin'
};

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  fallbackPath = '/unauthorized'
}) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = user.role;
  const userRoleLevel = ROLE_HIERARCHY[userRole as keyof typeof ROLE_HIERARCHY] || 0;

  // Check if user has required role (if specified)
  if (requiredRole) {
    const hasPermission = requiredRole.some(role => {
      const requiredLevel = ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] || 999;
      return userRoleLevel >= requiredLevel;
    });

    if (!hasPermission) {
      return <Navigate to={fallbackPath} replace />;
    }
  }

  // Check route-based permissions
  const currentPath = location.pathname;

  // Find the matching route prefix
  const matchingRoute = Object.keys(ROUTE_PERMISSIONS).find(route =>
    currentPath.startsWith(route)
  );

  if (matchingRoute) {
    const requiredRoleForRoute = ROUTE_PERMISSIONS[matchingRoute];
    const requiredLevel = ROLE_HIERARCHY[requiredRoleForRoute as keyof typeof ROLE_HIERARCHY] || 999;

    if (userRoleLevel < requiredLevel) {
      // Redirect to appropriate route for user's role
      const redirectPath = getRedirectPathForRole(userRole, currentPath);
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
};

// Helper function to redirect users to appropriate routes for their role
function getRedirectPathForRole(userRole: string, currentPath: string): string {
  const basePath = currentPath.split('/').slice(2).join('/'); // Remove prefix

  switch (userRole) {
    case 'admin':
      return `/admin/${basePath}`;
    case 'medical_staff':
      return `/medical/${basePath}`;
    case 'medical_advisor':
      return `/medical/${basePath}`;
    case 'facilitator':
      return `/staff/${basePath}`;
    case 'user':
      return `/user/${basePath}`;
    default:
      return '/unauthorized';
  }
}

export default ProtectedRoute;