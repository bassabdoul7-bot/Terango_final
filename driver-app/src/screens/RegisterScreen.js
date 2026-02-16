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

const RegisterScreen = ({ navigation }) => {
  const { registerUser } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const fullPhone = phone.startsWith('+221') ? phone : '+221' + phone;

  const handleRegister = async () => {
    if (!name.trim()) { Alert.alert('Erreur', 'Nom requis'); return; }
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Numéro invalide'); return; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Erreur', 'Email valide requis (pour récupération du PIN)'); return; }
    if (!pin || pin.length !== 4) { Alert.alert('Erreur', 'PIN de 4 chiffres requis'); return; }
    if (pin !== confirmPin) { Alert.alert('Erreur', 'Les PINs ne correspondent pas'); return; }

    setLoading(true);
    try {
      await registerUser(fullPhone, name, email, pin);
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.title}>Inscription Chauffeur</Text>
            <Text style={styles.subtitle}>Créez votre compte chauffeur</Text>

            <Text style={styles.label}>Nom complet</Text>
            <TextInput style={styles.input} placeholder="Votre nom" placeholderTextColor={COLORS.grayLight}
              value={name} onChangeText={setName} />

            <Text style={styles.label}>Numéro de téléphone</Text>
            <TextInput style={styles.input} placeholder="77 123 45 67" placeholderTextColor={COLORS.grayLight}
              value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={12} />

            <Text style={styles.label}>Email (pour récupération PIN)</Text>
            <TextInput style={styles.input} placeholder="votre@email.com" placeholderTextColor={COLORS.grayLight}
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

            <Text style={styles.label}>Créer un PIN (4 chiffres)</Text>
            <TextInput style={styles.input} placeholder="••••" placeholderTextColor={COLORS.grayLight}
              value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={4} secureTextEntry />

            <Text style={styles.label}>Confirmer le PIN</Text>
            <TextInput style={styles.input} placeholder="••••" placeholderTextColor={COLORS.grayLight}
              value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" maxLength={4} secureTextEntry />

            <GlassButton title={loading ? 'Inscription...' : 'S\'inscrire'} onPress={handleRegister} loading={loading} />
          </GlassCard>
          <View style={styles.bottomSpacer} />
          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.registerText}>Déjà un compte? </Text>
            <Text style={styles.registerBold}>Se connecter</Text>
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.95)', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
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

export default RegisterScreen;