import React from 'react';
import reportError from './src/utils/errorReporter';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput, ActivityIndicator, View } from 'react-native';
import { useFonts, LexendDeca_300Light, LexendDeca_400Regular, LexendDeca_500Medium, LexendDeca_600SemiBold, LexendDeca_700Bold, LexendDeca_800ExtraBold } from '@expo-google-fonts/lexend-deca';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

const defaultHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  reportError('Global', error?.message || 'Unknown crash', error?.stack);
  if (defaultHandler) defaultHandler(error, isFatal);
});

Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = { fontFamily: 'LexendDeca_400Regular' };
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = { fontFamily: 'LexendDeca_400Regular' };

export default function App() {
  const [fontsLoaded] = useFonts({
    LexendDeca_300Light,
    LexendDeca_400Regular,
    LexendDeca_500Medium,
    LexendDeca_600SemiBold,
    LexendDeca_700Bold,
    LexendDeca_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#FFFFFF'}}><ActivityIndicator size="large" color="#00853F" /></View>;
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </AuthProvider>
  );
}



