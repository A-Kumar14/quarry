import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMe = useCallback(async () => {
    try {
      const resp = await apiRequest('/auth/me');
      if (resp.ok) {
        const data = await resp.json();
        setUser(data);
      } else {
        setUser(null);
        if (resp.status !== 401) {
          console.error('Failed to fetch user:', await resp.text());
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (username, password) => {
    setError(null);
    try {
      const resp = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      const data = await resp.json();
      if (resp.ok) {
        localStorage.setItem('quarry_token', data.token);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.detail || 'Login failed');
        return { success: false, message: data.detail };
      }
    } catch (err) {
      setError('Connection error');
      return { success: false, message: 'Connection error' };
    }
  };

  const register = async (username, email, password) => {
    setError(null);
    try {
      const resp = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });

      const data = await resp.json();
      if (resp.ok) {
        localStorage.setItem('quarry_token', data.token);
        setUser(data.user);
        return { success: true };
      } else {
        setError(data.detail || 'Registration failed');
        return { success: false, message: data.detail };
      }
    } catch (err) {
      setError('Connection error');
      return { success: false, message: 'Connection error' };
    }
  };

  const logout = () => {
    localStorage.removeItem('quarry_token');
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    try {
      const resp = await apiRequest('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(profileData),
      });
      if (resp.ok) {
        const updated = await resp.json();
        setUser(updated);
        return { success: true };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
