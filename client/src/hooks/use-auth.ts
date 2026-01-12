import { useState, useEffect, useCallback } from "react";
import type { User } from "@shared/schema";

const SESSION_TOKEN_KEY = "auth_session_token";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  require2FA: boolean;
}

interface LoginResult {
  success: boolean;
  require2FA?: boolean;
  error?: string;
}

interface Verify2FAResult {
  success: boolean;
  error?: string;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem(SESSION_TOKEN_KEY);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    require2FA: false,
  });

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    
    if (!token) {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        require2FA: false,
      });
      return;
    }

    try {
      const res = await fetchWithAuth("/api/auth/me");
      
      if (res.status === 401) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          require2FA: false,
        });
        return;
      }

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "2FA Required") {
          const userRes = await fetchWithAuth("/api/auth/me?skip2FA=true");
          const userData = userRes.ok ? await userRes.json() : null;
          setState({
            user: userData?.user || null,
            isLoading: false,
            isAuthenticated: true,
            require2FA: true,
          });
          return;
        }
      }

      if (!res.ok) {
        throw new Error("Failed to fetch user");
      }

      const data = await res.json();
      setState({
        user: data.user,
        isLoading: false,
        isAuthenticated: true,
        require2FA: false,
      });
    } catch (error) {
      console.error("Auth fetch error:", error);
      localStorage.removeItem(SESSION_TOKEN_KEY);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        require2FA: false,
      });
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || "Login failed" };
      }

      if (data.sessionToken) {
        localStorage.setItem(SESSION_TOKEN_KEY, data.sessionToken);
      }

      if (data.require2FA) {
        setState(prev => ({
          ...prev,
          user: data.user || null,
          isAuthenticated: true,
          require2FA: true,
        }));
        return { success: true, require2FA: true };
      }

      setState({
        user: data.user,
        isLoading: false,
        isAuthenticated: true,
        require2FA: false,
      });

      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }, []);

  const verify2FA = useCallback(async (code: string): Promise<Verify2FAResult> => {
    try {
      const res = await fetchWithAuth("/api/auth/verify-2fa", {
        method: "POST",
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || "Verification failed" };
      }

      setState(prev => ({
        ...prev,
        require2FA: false,
      }));

      return { success: true };
    } catch (error) {
      console.error("2FA verification error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }, []);

  const resend2FA = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetchWithAuth("/api/auth/resend-2fa", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || "Failed to resend code" };
      }

      return { success: true };
    } catch (error) {
      console.error("Resend 2FA error:", error);
      return { success: false, error: "Network error. Please try again." };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetchWithAuth("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem(SESSION_TOKEN_KEY);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        require2FA: false,
      });
    }
  }, []);

  return {
    user: state.user,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    require2FA: state.require2FA,
    login,
    logout,
    verify2FA,
    resend2FA,
    refetch: fetchUser,
  };
}

export { fetchWithAuth };
