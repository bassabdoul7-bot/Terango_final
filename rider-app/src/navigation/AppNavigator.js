import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import SearchDestinationScreen from '../screens/SearchDestinationScreen';
import RideSelectionScreen from '../screens/RideSelectionScreen';
import ActiveRideScreen from '../screens/ActiveRideScreen';
import RatingScreen from '../screens/RatingScreen';
import ThiakThiakScreen from '../screens/ThiakThiakScreen';
import ColisScreen from '../screens/ColisScreen';
import CommandeScreen from '../screens/CommandeScreen';
import RestaurantListScreen from '../screens/RestaurantListScreen';
import RestaurantMenuScreen from '../screens/RestaurantMenuScreen';
import ActiveDeliveryScreen from '../screens/ActiveDeliveryScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
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
            <Stack.Screen name="SearchDestination" component={SearchDestinationScreen} />
            <Stack.Screen name="RideSelection" component={RideSelectionScreen} />
            <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
            <Stack.Screen name="Rating" component={RatingScreen} />
            <Stack.Screen name="ThiakThiak" component={ThiakThiakScreen} />
            <Stack.Screen name="Colis" component={ColisScreen} />
            <Stack.Screen name="Commande" component={CommandeScreen} />
            <Stack.Screen name="RestaurantList" component={RestaurantListScreen} />
            <Stack.Screen name="RestaurantMenuScreen" component={RestaurantMenuScreen} />
        <Stack.Screen name="ActiveDeliveryScreen" component={ActiveDeliveryScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

