import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,
  Platform, ScrollView, TouchableWithoutFeedback, Keyboard,
  Alert, Image, TouchableOpacity,
} from 'react-native';
import GlassButton from '../components/GlassButton';
import GlassCard from '../components/GlassCard';
import COLORS from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api.service';

const LoginScreen = ({ navigation }) => {
  const { loginWithPin } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot PIN states
  const [forgotMode, setForgotMode] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const fullPhone = phone.startsWith('+221') ? phone : '+221' + phone;

  const handleLogin = async () => {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Numéro de téléphone invalide');
      return;
    }
    if (!pin || pin.length !== 4) {
      Alert.alert('Erreur', 'Le PIN doit contenir 4 chiffres');
      return;
    }
    setLoading(true);
    try {
      await loginWithPin(fullPhone, pin);
    } catch (error) {
      Alert.alert('Erreur', error.message || 'PIN incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPin = async () => {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Entrez votre numéro d\'abord');
      return;
    }
    setLoading(true);
    try {
      const response = await authService.forgotPin(fullPhone);
      if (response.success) {
        setForgotMode(true);
        Alert.alert('Code envoyé', 'Vérifiez votre email');
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Aucun email associé');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Erreur', 'Code à 6 chiffres requis');
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
    try {
      const response = await authService.resetPin(fullPhone, otp, newPin);
      if (response.success) {
        Alert.alert('Succès', 'PIN réinitialisé!');
        setForgotMode(false);
        setOtp(''); setNewPin(''); setConfirmPin(''); setPin('');
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  if (forgotMode) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.logoCircle}>
              <View style={styles.logoImageWrapper}>
                <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
              </View>
            </View>
            <Text style={styles.appTitle}>TeranGO Chauffeur</Text>
            <GlassCard style={styles.card}>
              <Text style={styles.title}>Réinitialiser PIN</Text>
              <Text style={styles.subtitle}>Entrez le code reçu par email</Text>
              <Text style={styles.label}>Code (6 chiffres)</Text>
              <TextInput style={styles.input} placeholder="000000" placeholderTextColor={COLORS.grayLight}
                value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
              <Text style={styles.label}>Nouveau PIN (4 chiffres)</Text>
              <TextInput style={styles.input} placeholder="••••" placeholderTextColor={COLORS.grayLight}
                value={newPin} onChangeText={setNewPin} keyboardType="number-pad" maxLength={4} secureTextEntry />
              <Text style={styles.label}>Confirmer PIN</Text>
              <TextInput style={styles.input} placeholder="••••" placeholderTextColor={COLORS.grayLight}
                value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" maxLength={4} secureTextEntry />
              <GlassButton title={loading ? 'Envoi...' : 'Réinitialiser'} onPress={handleResetPin} loading={loading} />
              <GlassButton title="Retour" onPress={() => { setForgotMode(false); }} variant="outline" style={{ marginTop: 12 }} />
            </GlassCard>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.logoCircle}>
            <View style={styles.logoImageWrapper}>
              <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
          </View>
          <Text style={styles.appTitle}>TeranGO Chauffeur</Text>
          <GlassCard style={styles.card}>
            <Text style={styles.title}>Bienvenue Chauffeur</Text>
            <Text style={styles.subtitle}>Connectez-vous avec votre PIN</Text>
            <Text style={styles.label}>Numéro de téléphone</Text>
            <TextInput style={styles.input} placeholder="77 123 45 67" placeholderTextColor={COLORS.grayLight}
              value={phone} onChangeText={setPhone} keyboardType="phone-pad" returnKeyType="done" maxLength={12} />
            <Text style={styles.label}>PIN (4 chiffres)</Text>
            <TextInput style={styles.input} placeholder="••••" placeholderTextColor={COLORS.grayLight}
              value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={4} secureTextEntry />
            <GlassButton title={loading ? 'Connexion...' : 'Se connecter'} onPress={handleLogin} loading={loading} />
            <TouchableOpacity onPress={handleForgotPin} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: COLORS.green, fontSize: 14 }}>PIN oublié?</Text>
            </TouchableOpacity>
          </GlassCard>
          <View style={styles.bottomSpacer} />
          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerText}>Nouveau chauffeur? </Text>
            <Text style={styles.registerBold}>S'inscrire</Text>
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFFFFF', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  logoImageWrapper: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  logo: { width: 110, height: 110 },
  appTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.green, textAlign: 'center', marginBottom: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: '#E5E5E5', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 8 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.black, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 8 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.black, marginBottom: 20, borderWidth: 1, borderColor: COLORS.grayLight },
  bottomSpacer: { height: 20 },
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },
  registerText: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },
  registerBold: { color: '#00A86B', fontSize: 15, fontWeight: 'bold' },
});

export default LoginScreen;