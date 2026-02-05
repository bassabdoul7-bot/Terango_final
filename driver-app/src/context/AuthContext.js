import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, driverService } from '../services/api.service';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [driver, setDriver] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userData = await AsyncStorage.getItem('user');
      const driverData = await AsyncStorage.getItem('driver');
      
      if (token && userData) {
        setUser(JSON.parse(userData));
        setIsAuthenticated(true);
        
        if (driverData) {
          setDriver(JSON.parse(driverData));
        } else {
          await fetchDriverProfile();
        }
      }
    } catch (error) {
      console.error('Check auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverProfile = async () => {
    try {
      const response = await driverService.getProfile();
      if (response.success) {
        setDriver(response.driver);
        await AsyncStorage.setItem('driver', JSON.stringify(response.driver));
      }
    } catch (error) {
      console.error('Fetch driver profile error:', error);
    }
  };

  const login = async (phone, otp) => {
    try {
      const response = await authService.verifyOTP(phone, otp);
      
      if (response.success) {
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        
        setUser(response.user);
        setIsAuthenticated(true);
        
        await fetchDriverProfile();
        
        return response;
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const updateUser = async (updatedFields) => {
      try {
        const updatedUser = { ...user, ...updatedFields };
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      } catch (error) {
        console.error('Update user error:', error);
      }
    };

    const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('driver');
      setUser(null);
      setDriver(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        driver,
        isAuthenticated,
        loading,
        login,
          logout,
          updateUser,
        fetchDriverProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
