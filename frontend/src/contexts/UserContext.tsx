import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface UserContextType {
  username: string | null;
  login: (username: string) => void;
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

  // Load username from localStorage on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('openpoll-username');
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const login = (newUsername: string) => {
    setUsername(newUsername);
    localStorage.setItem('openpoll-username', newUsername);
  };

  const logout = () => {
    setUsername(null);
    localStorage.removeItem('openpoll-username');
  };

  const value: UserContextType = {
    username,
    login,
    logout,
    isLoggedIn: !!username,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
