import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  startMedicalStaffPreview: () => Promise<void>;
  stopImpersonation: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = authService.getToken();
    const storedUser = authService.getUser();

    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(storedUser);
    }

    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      setIsAuthenticated(true);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    // Force page reload to clear state
    window.location.reload();
  };

  const startMedicalStaffPreview = async () => {
    const response = await authService.startMedicalStaffPreview();
    setIsAuthenticated(true);
    setUser(response.user);
  };

  const stopImpersonation = () => {
    const restoredUser = authService.stopImpersonation();
    if (restoredUser) {
      setUser(restoredUser);
      setIsAuthenticated(true);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, startMedicalStaffPreview, stopImpersonation, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
