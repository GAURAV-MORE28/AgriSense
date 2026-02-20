/**
 * Authentication Context – single source of truth for auth state
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4001/api/v1';

interface User {
  userId: string;
  mobile: string;
  role: string;
}

interface FarmerProfile {
  profile_id: string;
  name: string;
  mobile: string;
  state: string;
  district: string;
  village?: string;
  land_type: string;
  acreage: number;
  main_crops: string[];
  family_count: number;
  annual_income: number;
  farmer_type: string;
  // Extended fields
  education_level?: string;
  irrigation_available?: boolean;
  loan_status?: string;
  bank_account_linked?: boolean;
  aadhaar_linked?: boolean;
  caste_category?: string;
  livestock?: string[];
  soil_type?: string;
  water_source?: string;
  machinery_owned?: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  profile: FarmerProfile | null;
  isAuthenticated: boolean;
  hasProfile: boolean;
  isAdmin: boolean;
  profileLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setProfile: (p: FarmerProfile) => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'krishi-token';
const USER_KEY = 'krishi-user';
const PROFILE_KEY = 'krishi-profile';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfileState] = useState<FarmerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // --- Hydrate from localStorage on mount ---
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    const savedProfile = localStorage.getItem(PROFILE_KEY);

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch (e) { /* corrupted – ignore */ }
    }
    if (savedProfile) {
      try { setProfileState(JSON.parse(savedProfile)); } catch (e) { /* ignore */ }
    }
  }, []);

  // --- Fetch profile from backend when token is available ---
  const refreshProfile = useCallback(async () => {
    const t = token || localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    setProfileLoading(true);
    try {
      const res = await fetch(`${API_URL}/profile`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) {
        const data = await res.json();
        const p = data.profile || data;
        setProfileState(p);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      } else if (res.status === 404) {
        // No profile yet – clear stale cache
        setProfileState(null);
        localStorage.removeItem(PROFILE_KEY);
      }
    } catch (e) {
      // Offline or network error – keep localStorage cache
    } finally {
      setProfileLoading(false);
    }
  }, [token]);

  // Always re-fetch profile from backend when token is available
  // This ensures profile persists even after page reload / DB changes
  useEffect(() => {
    if (token) {
      refreshProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setProfileState(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PROFILE_KEY);
  };

  const setProfile = (p: FarmerProfile) => {
    setProfileState(p);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      profile,
      isAuthenticated: !!token,
      hasProfile: !!profile,
      isAdmin: user?.role === 'admin',
      profileLoading,
      login,
      logout,
      setProfile,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
