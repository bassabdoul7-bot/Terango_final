var fs = require('fs');

// 1. Rewrite Driver LoginScreen - Phone + PIN
var loginCode = `import React, { useState } from 'react';
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
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot PIN states
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState('phone');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleLogin = async () => {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Veuillez entrer un num\u00e9ro valide');
      return;
    }
    if (!pin || pin.length !== 4) {
      Alert.alert('Erreur', 'Le PIN doit contenir 4 chiffres');
      return;
    }
    setLoading(true);
    try {
      const fullPhone = '+221' + phone.replace(/\\s/g, '');
      const response = await authService.loginWithPin(fullPhone, pin);
      if (response.success) {
        await login(fullPhone, null, null, null, null, response.token, response.user);
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'PIN incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPin = async () => {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Entrez votre num\u00e9ro d\\'abord');
      return;
    }
    setLoading(true);
    try {
      const fullPhone = '+221' + phone.replace(/\\s/g, '');
      const response = await authService.forgotPin(fullPhone);
      if (response.success) {
        setForgotMode(true);
        setForgotStep('otp');
        Alert.alert('Code envoy\u00e9', 'V\u00e9rifiez votre email pour le code de r\u00e9initialisation');
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Aucun email associ\u00e9 \u00e0 ce num\u00e9ro');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Erreur', 'Code invalide');
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
      const fullPhone = '+221' + phone.replace(/\\s/g, '');
      const response = await authService.resetPin(fullPhone, otp, newPin);
      if (response.success) {
        Alert.alert('Succ\u00e8s', 'PIN r\u00e9initialis\u00e9! Connectez-vous avec votre nouveau PIN.');
        setForgotMode(false);
        setForgotStep('phone');
        setOtp('');
        setNewPin('');
        setConfirmPin('');
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
              <Text style={styles.title}>R\u00e9initialiser PIN</Text>
              <Text style={styles.subtitle}>Entrez le code re\u00e7u par email</Text>

              <Text style={styles.label}>Code de v\u00e9rification</Text>
              <TextInput style={styles.input} placeholder="123456" placeholderTextColor={COLORS.grayLight}
                value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />

              <Text style={styles.label}>Nouveau PIN (4 chiffres)</Text>
              <TextInput style={styles.input} placeholder="\u2022\u2022\u2022\u2022" placeholderTextColor={COLORS.grayLight}
                value={newPin} onChangeText={setNewPin} keyboardType="number-pad" maxLength={4} secureTextEntry />

              <Text style={styles.label}>Confirmer PIN</Text>
              <TextInput style={styles.input} placeholder="\u2022\u2022\u2022\u2022" placeholderTextColor={COLORS.grayLight}
                value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" maxLength={4} secureTextEntry />

              <GlassButton title={loading ? 'Envoi...' : 'R\u00e9initialiser'} onPress={handleResetPin} loading={loading} />
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

            <Text style={styles.label}>Num\u00e9ro de t\u00e9l\u00e9phone</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.codeText}>+221</Text>
              </View>
              <TextInput style={[styles.input, styles.phoneInput]} placeholder="77 123 45 67"
                placeholderTextColor={COLORS.grayLight} value={phone} onChangeText={setPhone}
                keyboardType="phone-pad" maxLength={12} />
            </View>

            <Text style={styles.label}>PIN (4 chiffres)</Text>
            <TextInput style={styles.input} placeholder="\u2022\u2022\u2022\u2022" placeholderTextColor={COLORS.grayLight}
              value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={4} secureTextEntry />

            <GlassButton title={loading ? 'Connexion...' : 'Se connecter'} onPress={handleLogin} loading={loading} />

            <TouchableOpacity onPress={handleForgotPin} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: COLORS.green, fontSize: 14 }}>PIN oubli\u00e9?</Text>
            </TouchableOpacity>
          </GlassCard>

          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerText}>Nouveau chauffeur? </Text>
            <Text style={styles.registerBold}>S'inscrire</Text>
          </TouchableOpacity>
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.95)', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#00853F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  logoImageWrapper: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  logo: { width: 110, height: 110 },
  appTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.green, textAlign: 'center', marginBottom: 24 },
  card: { backgroundColor: 'rgba(0,133,63,0.15)', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: 'rgba(0,133,63,0.3)', shadowColor: '#00853F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.black, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', marginBottom: 20 },
  countryCode: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 12, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: COLORS.grayLight },
  codeText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  phoneInput: { flex: 1, marginBottom: 0 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.black, marginBottom: 20, borderWidth: 1, borderColor: COLORS.grayLight },
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, marginBottom: 30 },
  registerText: { color: 'rgba(255,255,255,0.6)', fontSize: 15 },
  registerBold: { color: '#00A86B', fontSize: 15, fontWeight: 'bold' },
  bottomSpacer: { height: 20 },
});

export default LoginScreen;
`;

fs.writeFileSync('C:/Users/bassa/Projects/terango-final/driver-app/src/screens/LoginScreen.js', loginCode, 'utf8');
console.log('1. Driver LoginScreen rewritten with PIN');

// 2. Rewrite Driver RegisterScreen - no OTP, just phone + name + email + PIN + vehicle
var registerCode = `import React, { useState } from 'react';
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

const RegisterScreen = ({ navigation }) => {
  const { checkAuth } = useAuth();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [vehicleType, setVehicleType] = useState('voiture');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStep1 = () => {
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Num\u00e9ro invalide'); return; }
    if (!name.trim()) { Alert.alert('Erreur', 'Nom requis'); return; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Erreur', 'Email valide requis (pour r\u00e9cup\u00e9ration du PIN)'); return; }
    if (!pin || pin.length !== 4) { Alert.alert('Erreur', 'PIN de 4 chiffres requis'); return; }
    if (pin !== confirmPin) { Alert.alert('Erreur', 'Les PINs ne correspondent pas'); return; }
    setStep(2);
  };

  const handleRegister = async () => {
    if (!plateNumber.trim()) { Alert.alert('Erreur', 'Num\u00e9ro de plaque requis'); return; }
    setLoading(true);
    try {
      const fullPhone = '+221' + phone.replace(/\\s/g, '');
      const response = await authService.register(fullPhone, name, email, pin, 'driver');
      if (response.success && response.token) {
        // Now complete profile with vehicle info
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));

        const { driverService } = require('../services/api.service');
        await driverService.completeProfile({
          name: name,
          vehicle: { type: vehicleType, plateNumber: plateNumber, color: vehicleColor || 'Non sp\u00e9cifi\u00e9' }
        });

        await checkAuth();
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Inscription \u00e9chou\u00e9e');
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
            {step === 1 ? (
              <>
                <Text style={styles.title}>Devenir Chauffeur</Text>
                <Text style={styles.subtitle}>Cr\u00e9ez votre compte</Text>

                <Text style={styles.label}>Nom complet</Text>
                <TextInput style={styles.input} placeholder="Votre nom" placeholderTextColor={COLORS.grayLight}
                  value={name} onChangeText={setName} />

                <Text style={styles.label}>Num\u00e9ro de t\u00e9l\u00e9phone</Text>
                <View style={styles.phoneRow}>
                  <View style={styles.countryCode}><Text style={styles.codeText}>+221</Text></View>
                  <TextInput style={[styles.input, styles.phoneInput]} placeholder="77 123 45 67"
                    placeholderTextColor={COLORS.grayLight} value={phone} onChangeText={setPhone}
                    keyboardType="phone-pad" maxLength={12} />
                </View>

                <Text style={styles.label}>Email (pour r\u00e9cup\u00e9ration PIN)</Text>
                <TextInput style={styles.input} placeholder="votre@email.com" placeholderTextColor={COLORS.grayLight}
                  value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

                <Text style={styles.label}>Cr\u00e9er un PIN (4 chiffres)</Text>
                <TextInput style={styles.input} placeholder="\u2022\u2022\u2022\u2022" placeholderTextColor={COLORS.grayLight}
                  value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={4} secureTextEntry />

                <Text style={styles.label}>Confirmer le PIN</Text>
                <TextInput style={styles.input} placeholder="\u2022\u2022\u2022\u2022" placeholderTextColor={COLORS.grayLight}
                  value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" maxLength={4} secureTextEntry />

                <GlassButton title="Suivant" onPress={handleStep1} />
              </>
            ) : (
              <>
                <Text style={styles.title}>Votre v\u00e9hicule</Text>
                <Text style={styles.subtitle}>Informations sur votre v\u00e9hicule</Text>

                <Text style={styles.label}>Type de v\u00e9hicule</Text>
                <View style={styles.vehicleTypes}>
                  {['moto', 'voiture', 'velo'].map((type) => (
                    <TouchableOpacity key={type}
                      style={[styles.vehicleOption, vehicleType === type && styles.vehicleOptionSelected]}
                      onPress={() => setVehicleType(type)}>
                      <Text style={[styles.vehicleText, vehicleType === type && styles.vehicleTextSelected]}>
                        {type === 'moto' ? 'Moto' : type === 'voiture' ? 'Voiture' : 'V\u00e9lo'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Num\u00e9ro de plaque</Text>
                <TextInput style={styles.input} placeholder="AA-1234-BB" placeholderTextColor={COLORS.grayLight}
                  value={plateNumber} onChangeText={setPlateNumber} autoCapitalize="characters" />

                <Text style={styles.label}>Couleur du v\u00e9hicule</Text>
                <TextInput style={styles.input} placeholder="Noir, Blanc, Rouge..." placeholderTextColor={COLORS.grayLight}
                  value={vehicleColor} onChangeText={setVehicleColor} />

                <GlassButton title={loading ? 'Inscription...' : "Terminer"} onPress={handleRegister} loading={loading} />
                <GlassButton title="Retour" onPress={() => setStep(1)} variant="outline" style={{ marginTop: 12 }} />
              </>
            )}
          </GlassCard>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.registerLink}>
            <Text style={styles.registerText}>D\u00e9j\u00e0 inscrit? </Text>
            <Text style={styles.registerBold}>Se connecter</Text>
          </TouchableOpacity>
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.95)', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#00853F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  logoImageWrapper: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 70, height: 70 },
  appTitle: { fontSize: 20, fontWeight: '600', color: COLORS.green, textAlign: 'center', marginBottom: 24 },
  card: { backgroundColor: 'rgba(0,133,63,0.15)', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: 'rgba(0,133,63,0.3)', shadowColor: '#00853F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.black, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 8 },
  phoneRow: { flexDirection: 'row', marginBottom: 20 },
  countryCode: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 12, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: COLORS.grayLight },
  codeText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  phoneInput: { flex: 1, marginBottom: 0 },
  input: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.black, marginBottom: 20, borderWidth: 1, borderColor: COLORS.grayLight },
  vehicleTypes: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  vehicleOption: { flex: 1, backgroundColor: COLORS.white, paddingVertical: 12, borderRadius: 12, marginHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: COLORS.grayLight },
  vehicleOptionSelected: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  vehicleText: { fontSize: 13, color: COLORS.black },
  vehicleTextSelected: { color: COLORS.white, fontWeight: '600' },
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  registerText: { color: COLORS.gray, fontSize: 15 },
  registerBold: { color: '#00A86B', fontSize: 15, fontWeight: 'bold' },
  bottomSpacer: { height: 20 },
});

export default RegisterScreen;
`;

fs.writeFileSync('C:/Users/bassa/Projects/terango-final/driver-app/src/screens/RegisterScreen.js', registerCode, 'utf8');
console.log('2. Driver RegisterScreen rewritten with PIN');

console.log('\\nDone! Now need to update api.service and AuthContext.');
