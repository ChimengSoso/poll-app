import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setAuthToken } from '../services/api';

interface UserContextType {
  username: string | null;
  token: string | null;
  login: (username: string, token: string) => void;
  logout: () => void;
  isLoggedIn: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [username, setUsername] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const savedUsername = localStorage.getItem('openpoll-username');
    const savedToken = localStorage.getItem('openpoll-token');
    if (savedUsername && savedToken) {
      setUsername(savedUsername);
      setToken(savedToken);
      setAuthToken(savedToken);
    }
  }, []);

  const login = (newUsername: string, newToken: string) => {
    setUsername(newUsername);
    setToken(newToken);
    localStorage.setItem('openpoll-username', newUsername);
    localStorage.setItem('openpoll-token', newToken);
    setAuthToken(newToken);
  };

  const logout = () => {
    setUsername(null);
    setToken(null);
    localStorage.removeItem('openpoll-username');
    localStorage.removeItem('openpoll-token');
    setAuthToken(null);
  };

  const value: UserContextType = {
    username,
    token,
    login,
    logout,
    isLoggedIn: !!username && !!token,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
