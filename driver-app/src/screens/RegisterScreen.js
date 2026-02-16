import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard, Alert, Image, TouchableOpacity, StatusBar } from 'react-native';
import GlassButton from '../components/GlassButton';
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
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Num\u00e9ro invalide'); return; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Erreur', 'Email valide requis (pour r\u00e9cup\u00e9ration du PIN)'); return; }
    if (!pin || pin.length !== 4) { Alert.alert('Erreur', 'PIN de 4 chiffres requis'); return; }
    if (pin !== confirmPin) { Alert.alert('Erreur', 'Les PINs ne correspondent pas'); return; }
    setLoading(true);
    try { await registerUser(fullPhone, name, email, pin); } catch (error) { Alert.alert('Erreur', error.message || 'Erreur lors de l\'inscription'); } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.darkHeader}>
        <View style={styles.logoCircle}><Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" /></View>
        <Text style={styles.appTitle}>TeranGO Chauffeur</Text>
        <Text style={styles.appSubtitle}>Rejoignez notre {"\u00e9quipe"}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.formArea}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Inscription Chauffeur</Text>
              <Text style={styles.cardSubtitle}>{"Cr\u00e9ez votre compte chauffeur"}</Text>

              <Text style={styles.label}>Nom complet</Text>
              <TextInput style={styles.input} placeholder="Votre nom" placeholderTextColor="#999" value={name} onChangeText={setName} />

              <Text style={styles.label}>{"Num\u00e9ro de t\u00e9l\u00e9phone"}</Text>
              <View style={styles.phoneRow}>
                <View style={styles.prefixBox}><Text style={styles.prefixText}>+221</Text></View>
                <TextInput style={styles.phoneInput} placeholder="77 123 45 67" placeholderTextColor="#999" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={12} />
              </View>

              <Text style={styles.label}>{"Email (r\u00e9cup\u00e9ration PIN)"}</Text>
              <TextInput style={styles.input} placeholder="votre@email.com" placeholderTextColor="#999" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.label}>{"Cr\u00e9er un PIN (4 chiffres)"}</Text>
              <TextInput style={styles.input} placeholder={"\u2022\u2022\u2022\u2022"} placeholderTextColor="#999" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={4} secureTextEntry />

              <Text style={styles.label}>Confirmer le PIN</Text>
              <TextInput style={styles.input} placeholder={"\u2022\u2022\u2022\u2022"} placeholderTextColor="#999" value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" maxLength={4} secureTextEntry />

              <GlassButton title={loading ? 'Inscription...' : 'S\'inscrire'} onPress={handleRegister} loading={loading} />
            </View>
            <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.registerText}>{"D\u00e9j\u00e0 un compte? "}</Text>
              <Text style={styles.registerBold}>Se connecter</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  darkHeader: { backgroundColor: '#001A12', paddingTop: 70, paddingBottom: 40, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, overflow: 'hidden' },
  logo: { width: 85, height: 85 },
  appTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  appSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  formArea: { flex: 1, marginTop: -20 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, borderWidth: 1, borderColor: '#F0F0F0' },
  cardTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.background, borderRadius: 14, padding: 16, fontSize: 16, color: '#1A1A1A', marginBottom: 20, borderWidth: 1, borderColor: '#E8E8E8' },
  phoneRow: { flexDirection: 'row', marginBottom: 20, gap: 10 },
  prefixBox: { backgroundColor: '#001A12', borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  prefixText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  phoneInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: 14, padding: 16, fontSize: 16, color: '#1A1A1A', borderWidth: 1, borderColor: '#E8E8E8' },
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 30 },
  registerText: { color: '#888', fontSize: 15 },
  registerBold: { color: COLORS.green, fontSize: 15, fontWeight: 'bold' },
});

export default RegisterScreen;
