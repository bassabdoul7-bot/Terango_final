import React, { useState } from 'react';
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
      Alert.alert('Erreur', 'Num\u00e9ro de t\u00e9l\u00e9phone invalide');
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
      Alert.alert('Erreur', 'Entrez votre num\u00e9ro d\'abord');
      return;
    }
    setLoading(true);
    authService.forgotPin(fullPhone).then(function(response) {
      setLoading(false);
      if (response.success) {
        setShowForgot(true);
        setForgotStep('otp');
        Alert.alert('Code envoy\u00e9', 'V\u00e9rifiez votre email');
      }
    }).catch(function(error) {
      setLoading(false);
      Alert.alert('Erreur', error.message || 'Aucun email associ\u00e9 \u00e0 ce num\u00e9ro');
    });
  }

  function handleResetPin() {
    if (!otp || otp.length !== 6) {
      Alert.alert('Erreur', 'Code \u00e0 6 chiffres requis');
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
        Alert.alert('Succ\u00e8s', 'PIN r\u00e9initialis\u00e9!');
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
      React.createElement(Text, { key: 't', style: styles.title }, 'R\u00e9initialiser PIN'),
      React.createElement(Text, { key: 's', style: styles.subtitle }, 'Entrez le code re\u00e7u par email'),
      React.createElement(Text, { key: 'l1', style: styles.label }, 'Code (6 chiffres)'),
      React.createElement(TextInput, { key: 'i1', style: styles.input, value: otp, onChangeText: setOtp, keyboardType: 'number-pad', maxLength: 6, placeholder: '000000', placeholderTextColor: 'rgba(255,255,255,0.3)' }),
      React.createElement(Text, { key: 'l2', style: styles.label }, 'Nouveau PIN (4 chiffres)'),
      React.createElement(TextInput, { key: 'i2', style: styles.input, value: newPin, onChangeText: setNewPin, keyboardType: 'number-pad', maxLength: 4, secureTextEntry: true, placeholder: '\u2022\u2022\u2022\u2022', placeholderTextColor: 'rgba(255,255,255,0.3)' }),
      React.createElement(Text, { key: 'l3', style: styles.label }, 'Confirmer PIN'),
      React.createElement(TextInput, { key: 'i3', style: styles.input, value: confirmPin, onChangeText: setConfirmPin, keyboardType: 'number-pad', maxLength: 4, secureTextEntry: true, placeholder: '\u2022\u2022\u2022\u2022', placeholderTextColor: 'rgba(255,255,255,0.3)' }),
      React.createElement(TouchableOpacity, { key: 'b1', style: styles.submitBtn, onPress: handleResetPin },
        React.createElement(Text, { style: styles.submitBtnText }, loading ? 'Envoi...' : 'R\u00e9initialiser')
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
          React.createElement(Text, { key: 'l1', style: styles.label }, 'T\u00e9l\u00e9phone'),
          React.createElement(TextInput, { key: 'i1', style: styles.input, placeholder: '77 123 45 67', placeholderTextColor: 'rgba(255,255,255,0.3)', value: phone, onChangeText: setPhone, keyboardType: 'phone-pad', maxLength: 12 }),
          React.createElement(Text, { key: 'l2', style: styles.label }, 'PIN (4 chiffres)'),
          React.createElement(TextInput, { key: 'i2', style: styles.input, placeholder: '\u2022\u2022\u2022\u2022', placeholderTextColor: 'rgba(255,255,255,0.3)', value: pin, onChangeText: setPin, keyboardType: 'number-pad', maxLength: 4, secureTextEntry: true }),
          React.createElement(TouchableOpacity, { key: 'b1', style: styles.submitBtn, onPress: handleLogin },
            React.createElement(Text, { style: styles.submitBtnText }, loading ? 'Connexion...' : 'Se connecter')
          ),
          React.createElement(TouchableOpacity, { key: 'b2', style: { marginTop: 16, alignItems: 'center' }, onPress: handleForgotPin },
            React.createElement(Text, { style: { color: GREEN, fontSize: 14 } }, 'PIN oubli\u00e9?')
          )
        ]),
        React.createElement(TouchableOpacity, { key: 'reg', style: styles.registerLink, onPress: function() { navigation.navigate('Register'); } }, [
          React.createElement(Text, { key: 'r1', style: styles.registerText }, 'Nouveau? '),
          React.createElement(Text, { key: 'r2', style: styles.registerBold }, 'S\'inscrire')
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
