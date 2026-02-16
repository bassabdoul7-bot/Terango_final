import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard, Alert, TouchableOpacity, Image } from 'react-native';
import GlassButton from '../components/GlassButton';
import GlassCard from '../components/GlassCard';
import COLORS from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api.service';

var LoginScreen = function(props) {
  var navigation = props.navigation;
  var auth = useAuth();
  var loginWithPin = auth.loginWithPin;
  var phoneState = useState(''); var phone = phoneState[0]; var setPhone = phoneState[1];
  var pinState = useState(''); var pin = pinState[0]; var setPin = pinState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var forgotModeState = useState(false); var forgotMode = forgotModeState[0]; var setForgotMode = forgotModeState[1];
  var forgotStepState = useState('phone'); var forgotStep = forgotStepState[0]; var setForgotStep = forgotStepState[1];
  var otpState = useState(''); var otp = otpState[0]; var setOtp = otpState[1];
  var newPinState = useState(''); var newPin = newPinState[0]; var setNewPin = newPinState[1];
  var confirmPinState = useState(''); var confirmPin = confirmPinState[0]; var setConfirmPin = confirmPinState[1];
  var fullPhone = phone.startsWith('+221') ? phone : '+221' + phone;

  function handleLogin() {
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Num\u00e9ro de t\u00e9l\u00e9phone invalide'); return; }
    if (!pin || pin.length !== 4) { Alert.alert('Erreur', 'Le PIN doit contenir 4 chiffres'); return; }
    setLoading(true);
    loginWithPin(fullPhone, pin).then(function() { setLoading(false); }).catch(function(error) { setLoading(false); Alert.alert('Erreur', error.message || 'PIN incorrect'); });
  }

  function handleForgotPin() {
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Entrez votre num\u00e9ro d\'abord'); return; }
    setLoading(true);
    authService.forgotPin(fullPhone).then(function(response) { setLoading(false); if (response.success) { setForgotMode(true); setForgotStep('otp'); Alert.alert('Code envoy\u00e9', 'V\u00e9rifiez votre email'); } }).catch(function(error) { setLoading(false); Alert.alert('Erreur', error.message || 'Aucun email associ\u00e9'); });
  }

  function handleResetPin() {
    if (!otp || otp.length !== 6) { Alert.alert('Erreur', 'Code \u00e0 6 chiffres requis'); return; }
    if (!newPin || newPin.length !== 4) { Alert.alert('Erreur', 'Le PIN doit contenir 4 chiffres'); return; }
    if (newPin !== confirmPin) { Alert.alert('Erreur', 'Les PINs ne correspondent pas'); return; }
    setLoading(true);
    authService.resetPin(fullPhone, otp, newPin).then(function(response) { setLoading(false); if (response.success) { Alert.alert('Succ\u00e8s', 'PIN r\u00e9initialis\u00e9!'); setForgotMode(false); setOtp(''); setNewPin(''); setConfirmPin(''); setPin(''); } }).catch(function(error) { setLoading(false); Alert.alert('Erreur', error.message || 'Code invalide'); });
  }

  if (forgotMode) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
            <View style={styles.logoCircle}><View style={styles.logoImageWrapper}><Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode='contain' /></View></View>
            <Text style={styles.appTitle}>TeranGO</Text>
            <GlassCard style={styles.card}>
              <Text style={styles.title}>{"R\u00e9initialiser PIN"}</Text>
              <Text style={styles.subtitle}>{"Entrez le code re\u00e7u par email"}</Text>
              <Text style={styles.label}>Code (6 chiffres)</Text>
              <TextInput style={styles.input} placeholder='000000' placeholderTextColor='#999' value={otp} onChangeText={setOtp} keyboardType='number-pad' maxLength={6} />
              <Text style={styles.label}>Nouveau PIN (4 chiffres)</Text>
              <TextInput style={styles.input} placeholder={'\u2022\u2022\u2022\u2022'} placeholderTextColor='#999' value={newPin} onChangeText={setNewPin} keyboardType='number-pad' maxLength={4} secureTextEntry />
              <Text style={styles.label}>Confirmer PIN</Text>
              <TextInput style={styles.input} placeholder={'\u2022\u2022\u2022\u2022'} placeholderTextColor='#999' value={confirmPin} onChangeText={setConfirmPin} keyboardType='number-pad' maxLength={4} secureTextEntry />
              <GlassButton title={loading ? 'Envoi...' : 'R\u00e9initialiser'} onPress={handleResetPin} loading={loading} />
              <GlassButton title='Retour' onPress={function() { setForgotMode(false); }} variant='outline' style={{ marginTop: 12 }} />
            </GlassCard>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
          <View style={styles.logoCircle}><View style={styles.logoImageWrapper}><Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode='contain' /></View></View>
          <Text style={styles.appTitle}>TeranGO</Text>
          <GlassCard style={styles.card}>
            <Text style={styles.title}>Connexion</Text>
            <Text style={styles.subtitle}>Connectez-vous avec votre PIN</Text>
            <Text style={styles.label}>{"Num\u00e9ro de t\u00e9l\u00e9phone"}</Text>
            <TextInput style={styles.input} placeholder='77 123 45 67' placeholderTextColor='#999' value={phone} onChangeText={setPhone} keyboardType='phone-pad' maxLength={12} />
            <Text style={styles.label}>PIN (4 chiffres)</Text>
            <TextInput style={styles.input} placeholder={'\u2022\u2022\u2022\u2022'} placeholderTextColor='#999' value={pin} onChangeText={setPin} keyboardType='number-pad' maxLength={4} secureTextEntry />
            <GlassButton title={loading ? 'Connexion...' : 'Se connecter'} onPress={handleLogin} loading={loading} />
            <TouchableOpacity onPress={handleForgotPin} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: COLORS.green, fontSize: 14 }}>{"PIN oubli\u00e9?"}</Text>
            </TouchableOpacity>
          </GlassCard>
          <View style={styles.bottomSpacer} />
          <TouchableOpacity style={styles.registerLink} onPress={function() { navigation.navigate('Register'); }}>
            <Text style={styles.registerText}>Nouveau? </Text>
            <Text style={styles.registerBold}>S'inscrire</Text>
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFFFFF', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  logoImageWrapper: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  logo: { width: 110, height: 110 },
  appTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.green, textAlign: 'center', marginBottom: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: '#E5E5E5', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 8 },
  input: { backgroundColor: COLORS.background, borderRadius: 12, padding: 16, fontSize: 16, color: '#1A1A1A', marginBottom: 20, borderWidth: 1, borderColor: '#E5E5E5' },
  bottomSpacer: { height: 20 },
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  registerText: { color: '#666', fontSize: 15 },
  registerBold: { color: COLORS.green, fontSize: 15, fontWeight: 'bold' },
});

export default LoginScreen;
