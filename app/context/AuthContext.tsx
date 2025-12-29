import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { callVisitorAPI } from '../utils/visitor-api';

interface AuthContextType {
  isAuthenticated: boolean;
  authToken: string | null;
  login: (token: string, expiresAt: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
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
  const [authToken, setAuthToken] = useState<string | null>(null);
  const visitorIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const expiresAt = await AsyncStorage.getItem('tokenExpiresAt');
      
      if (token && expiresAt) {
        const expirationDate = new Date(expiresAt);
        const now = new Date();
        
        if (expirationDate > now) {
          setAuthToken(token);
          setIsAuthenticated(true);
        } else {
          // Token expired, remove it
          await logout();
        }
      } else {
        setIsAuthenticated(false);
        setAuthToken(null);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
      setAuthToken(null);
    }
  };

  const login = async (token: string, expiresAt: string) => {
    try {
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('tokenExpiresAt', expiresAt);
      setAuthToken(token);
      setIsAuthenticated(true);
      
      // Call visitor API immediately after login
      callVisitorAPI(token).catch(err => {
        console.error('Error calling visitor API after login:', err);
      });
    } catch (error) {
      console.error('Error saving auth token:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear visitor polling interval
      if (visitorIntervalRef.current) {
        clearInterval(visitorIntervalRef.current);
        visitorIntervalRef.current = null;
      }
      
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('tokenExpiresAt');
      setAuthToken(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error removing auth token:', error);
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Set up visitor API polling when user is authenticated
  useEffect(() => {
    // Clear any existing interval
    if (visitorIntervalRef.current) {
      clearInterval(visitorIntervalRef.current);
      visitorIntervalRef.current = null;
    }

    if (isAuthenticated && authToken) {
      // Call immediately
      callVisitorAPI(authToken).catch(err => {
        console.error('Error calling visitor API:', err);
      });

      // Set up polling every 30 seconds
      visitorIntervalRef.current = setInterval(() => {
        if (authToken) {
          callVisitorAPI(authToken).catch(err => {
            console.error('Error calling visitor API in interval:', err);
          });
        }
      }, 30000); // 30 seconds

      return () => {
        if (visitorIntervalRef.current) {
          clearInterval(visitorIntervalRef.current);
          visitorIntervalRef.current = null;
        }
      };
    }
  }, [isAuthenticated, authToken]);

  const value: AuthContextType = {
    isAuthenticated,
    authToken,
    login,
    logout,
    checkAuthStatus,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Add default export
export default AuthProvider;
