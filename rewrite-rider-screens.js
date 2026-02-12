var fs = require('fs');

// 1. Update rider AuthContext - add loginWithPin and registerUser
var authFile = 'C:/Users/bassa/Projects/terango-final/rider-app/src/context/AuthContext.js';
var ac = fs.readFileSync(authFile, 'utf8');

ac = ac.replace(
  "  const login = async (phone, otp, name, role) => {",
  "  const loginWithPin = async (phone, pin) => {\n    try {\n      const response = await authService.loginWithPin(phone, pin);\n      if (response.success) {\n        await AsyncStorage.setItem('token', response.token);\n        await AsyncStorage.setItem('user', JSON.stringify(response.user));\n        setUser(response.user);\n        setIsAuthenticated(true);\n        registerForPushNotifications().then((token) => {\n          if (token) authService.registerPushToken(token);\n        });\n        return response;\n      } else {\n        throw new Error(response.message || 'Login failed');\n      }\n    } catch (error) {\n      console.error('Login error:', error);\n      throw error;\n    }\n  };\n\n  const registerUser = async (phone, name, email, pin) => {\n    try {\n      const response = await authService.register(phone, name, email, pin, 'rider');\n      if (response.success) {\n        await AsyncStorage.setItem('token', response.token);\n        await AsyncStorage.setItem('user', JSON.stringify(response.user));\n        setUser(response.user);\n        setIsAuthenticated(true);\n        registerForPushNotifications().then((token) => {\n          if (token) authService.registerPushToken(token);\n        });\n        return response;\n      } else {\n        throw new Error(response.message || 'Registration failed');\n      }\n    } catch (error) {\n      console.error('Register error:', error);\n      throw error;\n    }\n  };\n\n  const login = async (phone, otp, name, role) => {"
);

ac = ac.replace(
  "        login,\n        logout,",
  "        login,\n        loginWithPin,\n        registerUser,\n        logout,"
);

fs.writeFileSync(authFile, ac, 'utf8');
console.log('1. Rider AuthContext updated');

// 2. Rewrite rider LoginScreen with PIN (ES5 style - var, function)
var loginFile = 'C:/Users/bassa/Projects/terango-final/rider-app/src/screens/LoginScreen.js';
var loginCode = `import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, TouchableWithoutFeedback, Keyboard,
  Alert, Image, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api.service';

var DARK_BG = '#0a0a0a';
var MINT = 'rgba(179, 229, 206, 0.95)';
var MINT_LIGHT = 'rgba(179, 229, 206, 0.12)';
var MINT_BORDER = 'rgba(179, 229, 206, 0.25)';
var GREEN = '#4CD964';

function LoginScreen(props) {
  var navigation = props.navigation;
  var auth = useAuth();
  var loginWithPin = auth.loginWithPin;

  var phoneState = useState('');
  var phone = phoneState[0];
  var setPhone = phoneState[1];

  var pinState = useState('');
  var pin = pinState[0];
  var setPin = pinState[1];

  var loadingState = useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  // Forgot PIN states
  var forgotState = useState(false);
  var showForgot = forgotState[0];
  var setShowForgot = forgotState[1];

  var forgotStepState = useState('phone');
  var forgotStep = forgotStepState[0];
  var setForgotStep = forgotStepState[1];

  var otpState = useState('');
  var otp = otpState[0];
  var setOtp = otpState[1];

  var newPinState = useState('');
  var newPin = newPinState[0];
  var setNewPin = newPinState[1];

  var confirmPinState = useState('');
  var confirmPin = confirmPinState[0];
  var setConfirmPin = confirmPinState[1];

  var fullPhone = phone.startsWith('+221') ? phone : '+221' + phone;

  function handleLogin() {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Num\\u00e9ro de t\\u00e9l\\u00e9phone invalide');
      return;
    }
    if (!pin || pin.length !== 4) {
      Alert.alert('Erreur', 'Le PIN doit contenir 4 chiffres');
      return;
    }
    setLoading(true);
    loginWithPin(fullPhone, pin).then(function() {
      setLoading(false);
    }).catch(function(error) {
      setLoading(false);
      Alert.alert('Erreur', error.message || 'PIN incorrect');
    });
  }

  function handleForgotPin() {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Entrez votre num\\u00e9ro d\\'abord');
      return;
    }
    setLoading(true);
    authService.forgotPin(fullPhone).then(function(response) {
      setLoading(false);
      if (response.success) {
        setShowForgot(true);
        setForgotStep('otp');
        Alert.alert('Code envoy\\u00e9', 'V\\u00e9rifiez votre email');
      }
    }).catch(function(error) {
      setLoading(false);
      Alert.alert('Erreur', error.message || 'Aucun email associ\\u00e9 \\u00e0 ce num\\u00e9ro');
    });
  }

  function handleResetPin() {
    if (!otp || otp.length !== 6) {
      Alert.alert('Erreur', 'Code \\u00e0 6 chiffres requis');
      return;
    }
    if (!newPin || newPin.length !== 4) {
      Alert.alert('Erreur', 'Le PIN doit contenir 4 chiffres');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('Erreur', 'Les PINs ne correspondent pas');
      return;
    }
    setLoading(true);
    authService.resetPin(fullPhone, otp, newPin).then(function(response) {
      setLoading(false);
      if (response.success) {
        Alert.alert('Succ\\u00e8s', 'PIN r\\u00e9initialis\\u00e9!');
        setShowForgot(false);
        setForgotStep('phone');
        setOtp('');
        setNewPin('');
        setConfirmPin('');
        setPin('');
      }
    }).catch(function(error) {
      setLoading(false);
      Alert.alert('Erreur', error.message || 'Code invalide');
    });
  }

  function renderForgotPin() {
    return React.createElement(View, { style: styles.card }, [
      React.createElement(Text, { key: 't', style: styles.title }, 'R\\u00e9initialiser PIN'),
      React.createElement(Text, { key: 's', style: styles.subtitle }, 'Entrez le code re\\u00e7u par email'),
      React.createElement(Text, { key: 'l1', style: styles.label }, 'Code (6 chiffres)'),
      React.createElement(TextInput, { key: 'i1', style: styles.input, value: otp, onChangeText: setOtp, keyboardType: 'number-pad', maxLength: 6, placeholder: '000000', placeholderTextColor: 'rgba(255,255,255,0.3)' }),
      React.createElement(Text, { key: 'l2', style: styles.label }, 'Nouveau PIN (4 chiffres)'),
      React.createElement(TextInput, { key: 'i2', style: styles.input, value: newPin, onChangeText: setNewPin, keyboardType: 'number-pad', maxLength: 4, secureTextEntry: true, placeholder: '\\u2022\\u2022\\u2022\\u2022', placeholderTextColor: 'rgba(255,255,255,0.3)' }),
      React.createElement(Text, { key: 'l3', style: styles.label }, 'Confirmer PIN'),
      React.createElement(TextInput, { key: 'i3', style: styles.input, value: confirmPin, onChangeText: setConfirmPin, keyboardType: 'number-pad', maxLength: 4, secureTextEntry: true, placeholder: '\\u2022\\u2022\\u2022\\u2022', placeholderTextColor: 'rgba(255,255,255,0.3)' }),
      React.createElement(TouchableOpacity, { key: 'b1', style: styles.submitBtn, onPress: handleResetPin },
        React.createElement(Text, { style: styles.submitBtnText }, loading ? 'Envoi...' : 'R\\u00e9initialiser')
      ),
      React.createElement(TouchableOpacity, { key: 'b2', style: styles.skipBtn, onPress: function() { setShowForgot(false); } },
        React.createElement(Text, { style: styles.skipBtnText }, 'Retour')
      )
    ]);
  }

  if (showForgot) {
    return React.createElement(View, { style: styles.container }, renderForgotPin());
  }

  return React.createElement(KeyboardAvoidingView, {
    behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    style: styles.container
  },
    React.createElement(TouchableWithoutFeedback, { onPress: Keyboard.dismiss },
      React.createElement(ScrollView, { contentContainerStyle: styles.scrollContent, keyboardShouldPersistTaps: 'handled' }, [
        React.createElement(Text, { key: 'logo', style: styles.appTitle }, 'TeranGO'),
        React.createElement(View, { key: 'card', style: styles.card }, [
          React.createElement(Text, { key: 't', style: styles.title }, 'Connexion'),
          React.createElement(Text, { key: 's', style: styles.subtitle }, 'Connectez-vous avec votre PIN'),
          React.createElement(Text, { key: 'l1', style: styles.label }, 'T\\u00e9l\\u00e9phone'),
          React.createElement(TextInput, { key: 'i1', style: styles.input, placeholder: '77 123 45 67', placeholderTextColor: 'rgba(255,255,255,0.3)', value: phone, onChangeText: setPhone, keyboardType: 'phone-pad', maxLength: 12 }),
          React.createElement(Text, { key: 'l2', style: styles.label }, 'PIN (4 chiffres)'),
          React.createElement(TextInput, { key: 'i2', style: styles.input, placeholder: '\\u2022\\u2022\\u2022\\u2022', placeholderTextColor: 'rgba(255,255,255,0.3)', value: pin, onChangeText: setPin, keyboardType: 'number-pad', maxLength: 4, secureTextEntry: true }),
          React.createElement(TouchableOpacity, { key: 'b1', style: styles.submitBtn, onPress: handleLogin },
            React.createElement(Text, { style: styles.submitBtnText }, loading ? 'Connexion...' : 'Se connecter')
          ),
          React.createElement(TouchableOpacity, { key: 'b2', style: { marginTop: 16, alignItems: 'center' }, onPress: handleForgotPin },
            React.createElement(Text, { style: { color: GREEN, fontSize: 14 } }, 'PIN oubli\\u00e9?')
          )
        ]),
        React.createElement(TouchableOpacity, { key: 'reg', style: styles.registerLink, onPress: function() { navigation.navigate('Register'); } }, [
          React.createElement(Text, { key: 'r1', style: styles.registerText }, 'Nouveau? '),
          React.createElement(Text, { key: 'r2', style: styles.registerBold }, 'S\\'inscrire')
        ])
      ])
    )
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  appTitle: { fontSize: 36, fontWeight: 'bold', color: GREEN, textAlign: 'center', marginBottom: 32 },
  card: { backgroundColor: MINT_LIGHT, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: MINT_BORDER, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, fontSize: 16, color: '#fff', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  submitBtn: { backgroundColor: GREEN, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  skipBtn: { padding: 16, alignItems: 'center' },
  skipBtnText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  registerText: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  registerBold: { color: GREEN, fontSize: 15, fontWeight: 'bold' },
});

export default LoginScreen;
`;
fs.writeFileSync(loginFile, loginCode, 'utf8');
console.log('2. Rider LoginScreen rewritten with PIN');

// 3. Rewrite rider RegisterScreen with PIN (ES5 style)
var regFile = 'C:/Users/bassa/Projects/terango-final/rider-app/src/screens/RegisterScreen.js';
var regCode = `import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, TouchableWithoutFeedback, Keyboard,
  Alert, TouchableOpacity,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

var DARK_BG = '#0a0a0a';
var MINT_LIGHT = 'rgba(179, 229, 206, 0.12)';
var MINT_BORDER = 'rgba(179, 229, 206, 0.25)';
var GREEN = '#4CD964';

function RegisterScreen(props) {
  var navigation = props.navigation;
  var auth = useAuth();
  var registerUser = auth.registerUser;

  var nameState = useState('');
  var name = nameState[0];
  var setName = nameState[1];

  var phoneState = useState('');
  var phone = phoneState[0];
  var setPhone = phoneState[1];

  var emailState = useState('');
  var email = emailState[0];
  var setEmail = emailState[1];

  var pinState = useState('');
  var pin = pinState[0];
  var setPin = pinState[1];

  var confirmPinState = useState('');
  var confirmPin = confirmPinState[0];
  var setConfirmPin = confirmPinState[1];

  var loadingState = useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var fullPhone = phone.startsWith('+221') ? phone : '+221' + phone;

  function handleRegister() {
    if (!name.trim()) { Alert.alert('Erreur', 'Nom requis'); return; }
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Num\\u00e9ro invalide'); return; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Erreur', 'Email valide requis (pour r\\u00e9cup\\u00e9ration du PIN)'); return; }
    if (!pin || pin.length !== 4) { Alert.alert('Erreur', 'PIN de 4 chiffres requis'); return; }
    if (pin !== confirmPin) { Alert.alert('Erreur', 'Les PINs ne correspondent pas'); return; }

    setLoading(true);
    registerUser(fullPhone, name, email, pin).then(function() {
      setLoading(false);
    }).catch(function(error) {
      setLoading(false);
      Alert.alert('Erreur', error.message || 'Erreur lors de l\\'inscription');
    });
  }

  return React.createElement(KeyboardAvoidingView, {
    behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    style: styles.container
  },
    React.createElement(TouchableWithoutFeedback, { onPress: Keyboard.dismiss },
      React.createElement(ScrollView, { contentContainerStyle: styles.scrollContent, keyboardShouldPersistTaps: 'handled' }, [
        React.createElement(Text, { key: 'logo', style: styles.appTitle }, 'TeranGO'),
        React.createElement(View, { key: 'card', style: styles.card }, [
          React.createElement(Text, { key: 't', style: styles.title }, 'Inscription'),
          React.createElement(Text, { key: 's', style: styles.subtitle }, 'Cr\\u00e9ez votre compte passager'),

          React.createElement(Text, { key: 'l1', style: styles.label }, 'Nom complet'),
          React.createElement(TextInput, { key: 'i1', style: styles.input, placeholder: 'Votre nom', placeholderTextColor: 'rgba(255,255,255,0.3)', value: name, onChangeText: setName }),

          React.createElement(Text, { key: 'l2', style: styles.label }, 'T\\u00e9l\\u00e9phone'),
          React.createElement(TextInput, { key: 'i2', style: styles.input, placeholder: '77 123 45 67', placeholderTextColor: 'rgba(255,255,255,0.3)', value: phone, onChangeText: setPhone, keyboardType: 'phone-pad', maxLength: 12 }),

          React.createElement(Text, { key: 'l3', style: styles.label }, 'Email (pour r\\u00e9cup\\u00e9ration PIN)'),
          React.createElement(TextInput, { key: 'i3', style: styles.input, placeholder: 'votre@email.com', placeholderTextColor: 'rgba(255,255,255,0.3)', value: email, onChangeText: setEmail, keyboardType: 'email-address', autoCapitalize: 'none' }),

          React.createElement(Text, { key: 'l4', style: styles.label }, 'Cr\\u00e9er un PIN (4 chiffres)'),
          React.createElement(TextInput, { key: 'i4', style: styles.input, placeholder: '\\u2022\\u2022\\u2022\\u2022', placeholderTextColor: 'rgba(255,255,255,0.3)', value: pin, onChangeText: setPin, keyboardType: 'number-pad', maxLength: 4, secureTextEntry: true }),

          React.createElement(Text, { key: 'l5', style: styles.label }, 'Confirmer le PIN'),
          React.createElement(TextInput, { key: 'i5', style: styles.input, placeholder: '\\u2022\\u2022\\u2022\\u2022', placeholderTextColor: 'rgba(255,255,255,0.3)', value: confirmPin, onChangeText: setConfirmPin, keyboardType: 'number-pad', maxLength: 4, secureTextEntry: true }),

          React.createElement(TouchableOpacity, { key: 'b1', style: styles.submitBtn, onPress: handleRegister },
            React.createElement(Text, { style: styles.submitBtnText }, loading ? 'Inscription...' : 'S\\'inscrire')
          )
        ]),
        React.createElement(TouchableOpacity, { key: 'back', style: styles.registerLink, onPress: function() { navigation.navigate('Login'); } }, [
          React.createElement(Text, { key: 'r1', style: styles.registerText }, 'D\\u00e9j\\u00e0 un compte? '),
          React.createElement(Text, { key: 'r2', style: styles.registerBold }, 'Se connecter')
        ])
      ])
    )
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  appTitle: { fontSize: 36, fontWeight: 'bold', color: GREEN, textAlign: 'center', marginBottom: 32 },
  card: { backgroundColor: MINT_LIGHT, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: MINT_BORDER, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 6 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, fontSize: 16, color: '#fff', marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  submitBtn: { backgroundColor: GREEN, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  registerText: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  registerBold: { color: GREEN, fontSize: 15, fontWeight: 'bold' },
});

export default RegisterScreen;
`;
fs.writeFileSync(regFile, regCode, 'utf8');
console.log('3. Rider RegisterScreen rewritten with PIN');

console.log('\\nAll rider screens updated!');
