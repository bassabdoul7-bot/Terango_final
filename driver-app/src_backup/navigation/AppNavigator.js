import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { driverService } from '../services/api.service';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import RideRequestsScreen from '../screens/RideRequestsScreen';
import DeliveryRequestsScreen from '../screens/DeliveryRequestsScreen';
import ActiveRideScreen from '../screens/ActiveRideScreen';
import MenuScreen from '../screens/MenuScreen';
import DocumentUploadScreen from '../screens/DocumentUploadScreen';
import PendingVerificationScreen from '../screens/PendingVerificationScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();
  const [driverStatus, setDriverStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const checkDriverStatus = async () => {
    try {
      const res = await driverService.getVerificationStatus();
      setDriverStatus({
        status: res.verificationStatus,
        hasDocuments: res.hasDocuments,
      });
    } catch (error) {
      console.error('Check driver status error:', error);
      setDriverStatus({ status: 'approved', hasDocuments: true });
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      checkDriverStatus();
    } else {
      setDriverStatus(null);
      setStatusLoading(false);
    }
  }, [isAuthenticated]);

  if (loading || (isAuthenticated && statusLoading)) {
    return null;
  }

  const needsDocumentUpload = isAuthenticated && driverStatus &&
    driverStatus.status === 'pending' && !driverStatus.hasDocuments;

  const isPendingVerification = isAuthenticated && driverStatus &&
    driverStatus.status === 'pending' && driverStatus.hasDocuments;

  if (needsDocumentUpload) {
    return (
      <DocumentUploadScreen
        onComplete={() => {
          setDriverStatus({ status: 'pending', hasDocuments: true });
        }}
      />
    );
  }

  if (isPendingVerification) {
    return (
      <PendingVerificationScreen
        onApproved={() => {
          setDriverStatus({ status: 'approved', hasDocuments: true });
        }}
        onUploadNeeded={() => {
          setDriverStatus({ status: 'pending', hasDocuments: false });
        }}
      />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="RideRequests" component={RideRequestsScreen} />
            <Stack.Screen name="DeliveryRequests" component={DeliveryRequestsScreen} />
            <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
            <Stack.Screen name="Menu" component={MenuScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;