import React, { createContext, useState, useContext, useEffect } from 'react';
import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authService, driverService } from '../services/api.service';
import { registerForPushNotifications } from '../services/notifications';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [driver, setDriver] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
    var sub = DeviceEventEmitter.addListener('force-logout', function() {
      setUser(null); setDriver(null); setIsAuthenticated(false);
    });
    return function() { sub.remove(); };
  }, []);

  const checkAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
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
        // Register push on auto-login
        registerForPushNotifications().then(function(token) {
          if (token) authService.registerPushToken(token);
        });
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

  const loginWithPin = async (phone, pin) => {
    try {
      const response = await authService.loginWithPin(phone, pin);
      if (response.success) {
        await SecureStore.setItemAsync('token', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);
        setIsAuthenticated(true);
        await fetchDriverProfile();
        registerForPushNotifications().then(function(token) {
          if (token) authService.registerPushToken(token);
        });
        return response;
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const registerUser = async (phone, name, email, pin) => {
    try {
      const response = await authService.register(phone, name, email, pin, 'driver');
      if (response.success) {
        await SecureStore.setItemAsync('token', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);
        setIsAuthenticated(true);
        // Don't block registration if profile fetch fails
        fetchDriverProfile().catch(function(err) { console.log('Profile fetch after register:', err); });
        registerForPushNotifications().then(function(token) {
          if (token) authService.registerPushToken(token);
        });
        return response;
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
  };

  const login = async (phone, otp, name = 'Driver', role = 'driver', vehicleInfo = null) => {
    try {
      const response = await authService.verifyOTP(phone, otp, name, role);
      
      if (response.success) {
        await SecureStore.setItemAsync('token', response.token);
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
      await SecureStore.deleteItemAsync('token');
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
          loginWithPin,
          registerUser,
          logout,
          updateUser,
        fetchDriverProfile,
          checkAuth,
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





