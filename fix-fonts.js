var fs = require('fs');

// Fix Driver App.js
var driverApp = 'C:/Users/bassa/Projects/terango-final/driver-app/App.js';
fs.writeFileSync(driverApp, `import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput, ActivityIndicator, View } from 'react-native';
import { useFonts, LexendDeca_300Light, LexendDeca_400Regular, LexendDeca_500Medium, LexendDeca_600SemiBold, LexendDeca_700Bold, LexendDeca_800ExtraBold } from '@expo-google-fonts/lexend-deca';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// Set Lexend Deca as default font globally
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
    return <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#1A1A2E'}}><ActivityIndicator size="large" color="#00853F" /></View>;
  }

  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </AuthProvider>
  );
}
`, 'utf8');
console.log('Driver App.js updated');

// Fix Rider App.js
var riderApp = 'C:/Users/bassa/Projects/terango-final/rider-app/App.js';
var riderContent = fs.readFileSync(riderApp, 'utf8');

// Check what rider App.js looks like first
console.log('Rider App.js current imports:');
console.log(riderContent.split('\\n').slice(0, 5).join('\\n'));
`, 'utf8');

console.log('Done');
