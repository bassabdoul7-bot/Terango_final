import React, { useState } from 'react';
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
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Num\u00e9ro invalide'); return; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Erreur', 'Email valide requis (pour r\u00e9cup\u00e9ration du PIN)'); return; }
    if (!pin || pin.length !== 4) { Alert.alert('Erreur', 'PIN de 4 chiffres requis'); return; }
    if (pin !== confirmPin) { Alert.alert('Erreur', 'Les PINs ne correspondent pas'); return; }

    setLoading(true);
    registerUser(fullPhone, name, email, pin).then(function() {
      setLoading(false);
    }).catch(function(error) {
      setLoading(false);
      Alert.alert('Erreur', error.message || 'Erreur lors de l\'inscription');
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
          React.createElement(Text, { key: 's', style: styles.subtitle }, 'Cr\u00e9ez votre compte passager'),

          React.createElement(Text, { key: 'l1', style: styles.label }, 'Nom complet'),
          React.createElement(TextInput, { key: 'i1', style: styles.input, placeholder: 'Votre nom', placeholderTextColor: 'rgba(255,255,255,0.3)', value: name, onChangeText: setName }),

          React.createElement(Text, { key: 'l2', style: styles.label }, 'T\u00e9l\u00e9phone'),
          React.createElement(TextInput, { key: 'i2', style: styles.input, placeholder: '77 123 45 67', placeholderTextColor: 'rgba(255,255,255,0.3)', value: phone, onChangeText: setPhone, keyboardType: 'phone-pad', maxLength: 12 }),

          React.createElement(Text, { key: 'l3', style: styles.label }, 'Email (pour r\u00e9cup\u00e9ration PIN)'),
          React.createElement(TextInput, { key: 'i3', style: styles.input, placeholder: 'votre@email.com', placeholderTextColor: 'rgba(255,255,255,0.3)', value: email, onChangeText: setEmail, keyboardType: 'email-address', autoCapitalize: 'none' }),

          React.createElement(Text, { key: 'l4', style: styles.label }, 'Cr\u00e9er un PIN (4 chiffres)'),
          React.createElement(TextInput, { key: 'i4', style: styles.input, placeholder: '\u2022\u2022\u2022\u2022', placeholderTextColor: 'rgba(255,255,255,0.3)', value: pin, onChangeText: setPin, keyboardType: 'number-pad', maxLength: 4, secureTextEntry: true }),

          React.createElement(Text, { key: 'l5', style: styles.label }, 'Confirmer le PIN'),
          React.createElement(TextInput, { key: 'i5', style: styles.input, placeholder: '\u2022\u2022\u2022\u2022', placeholderTextColor: 'rgba(255,255,255,0.3)', value: confirmPin, onChangeText: setConfirmPin, keyboardType: 'number-pad', maxLength: 4, secureTextEntry: true }),

          React.createElement(TouchableOpacity, { key: 'b1', style: styles.submitBtn, onPress: handleRegister },
            React.createElement(Text, { style: styles.submitBtnText }, loading ? 'Inscription...' : 'S\'inscrire')
          )
        ]),
        React.createElement(TouchableOpacity, { key: 'back', style: styles.registerLink, onPress: function() { navigation.navigate('Login'); } }, [
          React.createElement(Text, { key: 'r1', style: styles.registerText }, 'D\u00e9j\u00e0 un compte? '),
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
