/**
 * AuthContext
 * Global state for user authentication, tokens, and session management
 */

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { User, login as apiLogin, register as apiRegister, logout as apiLogout, refreshAccessToken, getCurrentUser } from "@/api/auth";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, firstName?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    const savedAccessToken = localStorage.getItem("access_token") || localStorage.getItem("access");
    const savedRefreshToken = localStorage.getItem("refresh_token") || localStorage.getItem("refresh");

    if (savedAccessToken && savedRefreshToken) {
      setAccessToken(savedAccessToken);
      setRefreshToken(savedRefreshToken);

      // Try to load user profile
      getCurrentUser(savedAccessToken)
        .then((userData) => setUser(userData))
        .catch((err) => {
          console.error("Failed to load user profile:", err);
          // Clear tokens if user fetch fails (likely invalid/expired token)
          localStorage.removeItem("access_token");
          localStorage.removeItem("access");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("refresh");
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiLogin({ username, password });

      // Store tokens in localStorage
      localStorage.setItem("access_token", response.access);
      localStorage.setItem("access", response.access);
      localStorage.setItem("refresh_token", response.refresh);
      localStorage.setItem("refresh", response.refresh);

      setAccessToken(response.access);
      setRefreshToken(response.refresh);
      setUser(response.user);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Login failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string, firstName?: string, lastName?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRegister({
        username,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      });

      // Store tokens in localStorage
      localStorage.setItem("access_token", response.access);
      localStorage.setItem("access", response.access);
      localStorage.setItem("refresh_token", response.refresh);
      localStorage.setItem("refresh", response.refresh);

      setAccessToken(response.access);
      setRefreshToken(response.refresh);
      setUser(response.user);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Registration failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const currentAccessToken = accessToken || localStorage.getItem("access_token") || localStorage.getItem("access");
      const currentRefreshToken = refreshToken || localStorage.getItem("refresh_token") || localStorage.getItem("refresh");

      if (currentAccessToken && currentRefreshToken) {
        try {
          await apiLogout(currentRefreshToken, currentAccessToken);
        } catch (logoutErr) {
          console.error("Logout API call failed (this is OK):", logoutErr);
          // Continue with local logout even if API fails
        }
      }

      // Clear local state
      localStorage.removeItem("access_token");
      localStorage.removeItem("access");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("refresh");

      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Logout failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  // Auto-refresh access token when it's about to expire (or on demand)
  // This is called by API interceptors when 401 is received
  const refreshTokenIfNeeded = async (): Promise<string | null> => {
    const token = localStorage.getItem("refresh_token") || localStorage.getItem("refresh");
    if (!token) return null;

    try {
      const response = await refreshAccessToken(token);
      localStorage.setItem("access_token", response.access);
      localStorage.setItem("access", response.access);
      setAccessToken(response.access);
      return response.access;
    } catch (err) {
      console.error("Token refresh failed:", err);
      // If refresh fails, logout
      await logout();
      return null;
    }
  };

  const value: AuthContextValue = {
    user,
    token: accessToken,
    accessToken,
    refreshToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

/**
 * Helper to get access token (used by API clients)
 */
export function getAccessToken(): string {
  return localStorage.getItem("access_token") || localStorage.getItem("access") || "";
}

/**
 * Helper to refresh token on 401 (used by API interceptors)
 */
export async function refreshTokenIfNeeded(): Promise<string | null> {
  const token = localStorage.getItem("refresh_token") || localStorage.getItem("refresh");
  if (!token) return null;

  try {
    const response = await refreshAccessToken(token);
    localStorage.setItem("access_token", response.access);
    localStorage.setItem("access", response.access);
    return response.access;
  } catch (err) {
    console.error("Token refresh failed:", err);
    // Clear tokens on refresh failure
    localStorage.removeItem("access_token");
    localStorage.removeItem("access");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("refresh");
    return null;
  }
}

