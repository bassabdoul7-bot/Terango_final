import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { driverService } from '../services/api.service';
import COLORS from '../constants/colors';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import GainsScreen from '../screens/GainsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import MenuScreen from '../screens/MenuScreen';
import RideRequestsScreen from '../screens/RideRequestsScreen';
import DeliveryRequestsScreen from '../screens/DeliveryRequestsScreen';
import ActiveRideScreen from '../screens/ActiveRideScreen';
import DocumentUploadScreen from '../screens/DocumentUploadScreen';
import PendingVerificationScreen from '../screens/PendingVerificationScreen';
import MechanicsScreen from '../screens/MechanicsScreen';

var Stack = createNativeStackNavigator();
var Tab = createBottomTabNavigator();

var tabIcons = { Courses: '\uD83D\uDE97', Gains: '\uD83D\uDCB0', Messages: '\uD83D\uDCAC', Profil: '\uD83D\uDC64' };

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={function(props) {
        var route = props.route;
        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: 'rgba(212,175,55,0.85)',
            borderTopWidth: 0,
            paddingTop: 8,
            paddingBottom: 28,
            height: 80,
            elevation: 12,
          },
          tabBarActiveTintColor: COLORS.darkBg,
          tabBarInactiveTintColor: COLORS.darkBg2,
          tabBarLabelStyle: {
            fontFamily: 'LexendDeca_600SemiBold',
            fontSize: 11,
            marginTop: 4,
          },
          tabBarIcon: function(props2) {
            var focused = props2.focused;
            var iconBg = focused ? COLORS.darkCard : 'rgba(0,26,18,0.12)';
            return React.createElement(View, {
              style: { width: 46, height: 46, borderRadius: 23, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }
            }, React.createElement(Text, { style: { fontSize: 24 } }, tabIcons[route.name]));
          },
        };
      }}
    >
      <Tab.Screen name="Courses" component={HomeScreen} />
      <Tab.Screen name="Gains" component={GainsScreen} />
      <Tab.Screen name="Messages" component={MessagesScreen} />
      <Tab.Screen name="Profil" component={MenuScreen} />
    </Tab.Navigator>
  );
}

var AppNavigator = function() {
  var auth = useAuth();
  var isAuthenticated = auth.isAuthenticated;
  var loading = auth.loading;
  var driverStatusState = useState(null);
  var driverStatus = driverStatusState[0];
  var setDriverStatus = driverStatusState[1];
  var statusLoadingState = useState(true);
  var statusLoading = statusLoadingState[0];
  var setStatusLoading = statusLoadingState[1];
  var onboardingState = useState(null);
  var showOnboarding = onboardingState[0];
  var setShowOnboarding = onboardingState[1];

  useEffect(function() {
    AsyncStorage.getItem('onboardingDone').then(function(value) {
      setShowOnboarding(value !== '1');
    });
  }, []);

  var checkDriverStatus = function() {
    driverService.getVerificationStatus().then(function(res) {
      if (res && res.success !== false) {
        setDriverStatus({ status: res.verificationStatus, hasDocuments: res.hasDocuments });
      } else {
        setDriverStatus(null);
      }
    }).catch(function() {
      setDriverStatus(null);
    }).finally(function() {
      setStatusLoading(false);
    });
  };

  useEffect(function() {
    if (isAuthenticated) { setStatusLoading(true); checkDriverStatus(); }
    else { setDriverStatus(null); setStatusLoading(false); }
  }, [isAuthenticated]);

  if (loading || showOnboarding === null || (isAuthenticated && statusLoading)) { return null; }

  var needsDocumentUpload = isAuthenticated && driverStatus && driverStatus.status === 'pending' && !driverStatus.hasDocuments;
  var isPendingVerification = isAuthenticated && driverStatus && driverStatus.status === 'pending' && driverStatus.hasDocuments;

  if (isAuthenticated && needsDocumentUpload) {
    return React.createElement(NavigationContainer, null,
      React.createElement(DocumentUploadScreen, {
        onComplete: function() { setDriverStatus({ status: 'pending', hasDocuments: true }); }
      })
    );
  }
  if (isAuthenticated && isPendingVerification) {
    return React.createElement(NavigationContainer, null,
      React.createElement(PendingVerificationScreen, {
        onApproved: function() { setDriverStatus({ status: 'approved', hasDocuments: true }); },
        onUploadNeeded: function() { setDriverStatus({ status: 'pending', hasDocuments: false }); }
      })
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            {showOnboarding && (
              <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            )}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={MainTabs} />
            <Stack.Screen name="RideRequests" component={RideRequestsScreen} />
            <Stack.Screen name="DeliveryRequests" component={DeliveryRequestsScreen} />
            <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
            <Stack.Screen name="Menu" component={MenuScreen} />
            <Stack.Screen name="Mechanics" component={MechanicsScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
