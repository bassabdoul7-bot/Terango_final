import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import GlassButton from '../components/GlassButton';
import GlassCard from '../components/GlassCard';
import COLORS from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { authService, driverService } from '../services/api.service';

const RegisterScreen = ({ navigation }) => {
  const { checkAuth } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [vehicleType, setVehicleType] = useState('moto');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide');
      return;
    }
    setLoading(true);
    try {
      const fullPhone = '+221' + phone.replace(/\s/g, '');
      const response = await authService.sendOTP(fullPhone);
      if (response.success) {
        setStep(2);
        Alert.alert('Code envoyé', 'Vérifiez le terminal backend pour le code OTP');
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Erreur envoi code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Erreur', 'Veuillez entrer un code OTP valide (6 chiffres)');
      return;
    }
    setLoading(true);
    try {
      const fullPhone = '+221' + phone.replace(/\s/g, '');
      const response = await authService.verifyOTP(fullPhone, otp, name || 'Driver', 'driver');
      if (response.success && response.token) {
        await AsyncStorage.setItem('token', response.token);
        await AsyncStorage.setItem('user', JSON.stringify(response.user));
        setStep(3);
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Code OTP invalide');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRegistration = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre nom');
      return;
    }
    if (!plateNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le numéro de plaque');
      return;
    }
    setLoading(true);
    try {
      await driverService.completeProfile({
        name: name,
        vehicle: {
          type: vehicleType,
          plateNumber: plateNumber,
          color: vehicleColor || 'Non spécifié'
        }
      });
      await checkAuth();
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Inscription échouée');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <>
      <Text style={styles.title}>Devenir Chauffeur</Text>
      <Text style={styles.subtitle}>Entrez votre numéro de téléphone</Text>

      <Text style={styles.label}>Numéro de téléphone</Text>
      <View style={styles.phoneRow}>
        <View style={styles.countryCode}>
          <Text style={styles.flag}>🇸🇳</Text>
          <Text style={styles.codeText}>+221</Text>
        </View>
        <TextInput
          style={[styles.input, styles.phoneInput]}
          placeholder="77 123 45 67"
          placeholderTextColor={COLORS.grayLight}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={12}
        />
      </View>

      <GlassButton
        title={loading ? 'Envoi...' : 'Recevoir le code'}
        onPress={handleSendOTP}
        loading={loading}
      />
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.title}>Vérification</Text>
      <Text style={styles.subtitle}>Entrez le code envoyé au +221{phone}</Text>

      <Text style={styles.label}>Code OTP</Text>
      <TextInput
        style={styles.input}
        placeholder="123456"
        placeholderTextColor={COLORS.grayLight}
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
      />

      <GlassButton
        title={loading ? 'Vérification...' : 'Vérifier'}
        onPress={handleVerifyOTP}
        loading={loading}
      />

      <GlassButton
        title="Changer de numéro"
        onPress={() => setStep(1)}
        variant="outline"
        style={{ marginTop: 12 }}
      />
    </>
  );

  const renderStep3 = () => (
    <>
      <Text style={styles.title}>Vos informations</Text>
      <Text style={styles.subtitle}>Complétez votre profil chauffeur</Text>

      <Text style={styles.label}>Nom complet</Text>
      <TextInput
        style={styles.input}
        placeholder="Votre nom"
        placeholderTextColor={COLORS.grayLight}
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Type de véhicule</Text>
      <View style={styles.vehicleTypes}>
        {['moto', 'voiture', 'velo'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.vehicleOption, vehicleType === type && styles.vehicleOptionSelected]}
            onPress={() => setVehicleType(type)}
          >
            <Text style={[styles.vehicleText, vehicleType === type && styles.vehicleTextSelected]}>
              {type === 'moto' ? '🏍️ Moto' : type === 'voiture' ? '🚗 Voiture' : '🚲 Vélo'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Numéro de plaque</Text>
      <TextInput
        style={styles.input}
        placeholder="AA-1234-BB"
        placeholderTextColor={COLORS.grayLight}
        value={plateNumber}
        onChangeText={setPlateNumber}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Couleur du véhicule</Text>
      <TextInput
        style={styles.input}
        placeholder="Noir, Blanc, Rouge..."
        placeholderTextColor={COLORS.grayLight}
        value={vehicleColor}
        onChangeText={setVehicleColor}
      />

      <GlassButton
        title={loading ? 'Inscription...' : "Terminer l'inscription"}
        onPress={handleCompleteRegistration}
        loading={loading}
      />
    </>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoCircle}>
            <View style={styles.logoImageWrapper}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>

          <Text style={styles.appTitle}>TeranGO Chauffeur</Text>

          <GlassCard style={styles.card}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </GlassCard>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.registerLink}>
            <Text style={styles.registerText}>Déjà inscrit? </Text>
            <Text style={styles.registerBold}>Se connecter</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#00853F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoImageWrapper: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 70,
    height: 70,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.green,
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: 'rgba(0, 133, 63, 0.15)',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(0, 133, 63, 0.3)',
    shadowColor: '#00853F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  flag: {
    fontSize: 20,
    marginRight: 6,
  },
  codeText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  phoneInput: {
    flex: 1,
    marginBottom: 0,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  vehicleTypes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  vehicleOption: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.grayLight,
  },
  vehicleOptionSelected: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  vehicleText: {
    fontSize: 12,
    color: COLORS.black,
  },
  vehicleTextSelected: {
    color: COLORS.white,
    fontWeight: '600',
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerText: {
    color: COLORS.gray,
    fontSize: 15,
  },
  registerBold: {
    color: '#00A86B',
    fontSize: 15,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 20,
  },
});

export default RegisterScreen;