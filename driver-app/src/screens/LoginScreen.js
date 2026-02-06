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
import GlassButton from '../components/GlassButton';
import GlassCard from '../components/GlassCard';
import COLORS from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api.service';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('phone');

  const handleSendOTP = async () => {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.sendOTP(phone);
      if (response.success) {
        setStep('otp');
        Alert.alert('Code envoyé', 'Vérifiez le terminal backend pour le code OTP');
      }
    } catch (error) {
      console.error('Send OTP Error:', error);
      Alert.alert('Erreur', 'Erreur envoi code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert('Erreur', 'Veuillez entrer un code OTP valide');
      return;
    }

    setLoading(true);
    try {
      await login(phone, otp);
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Code OTP invalide');
    } finally {
      setLoading(false);
    }
  };

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
            {step === 'phone' ? (
              <>
                <Text style={styles.title}>Bienvenue Chauffeur</Text>
                <Text style={styles.subtitle}>
                  Entrez votre numéro de téléphone
                </Text>

                <Text style={styles.label}>Numéro de téléphone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="77 123 45 67"
                  placeholderTextColor={COLORS.grayLight}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  maxLength={12}
                />

                <GlassButton
                  title={loading ? 'Envoi...' : 'Obtenir le code OTP'}
                  onPress={handleSendOTP}
                  loading={loading}
                />
              </>
            ) : (
              <>
                <Text style={styles.title}>Vérification</Text>
                <Text style={styles.subtitle}>
                  Entrez le code envoyé au {phone}
                </Text>

                <Text style={styles.label}>Code OTP</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123456"
                  placeholderTextColor={COLORS.grayLight}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  maxLength={6}
                />

                <GlassButton
                  title={loading ? 'Vérification...' : 'Vérifier'}
                  onPress={handleVerifyOTP}
                  loading={loading}
                  style={styles.verifyButton}
                />

                <GlassButton
                  title="Renvoyer le code"
                  onPress={handleSendOTP}
                  variant="outline"
                  style={styles.resendButton}
                />

                <View style={styles.newUserContainer}>
                  <Text style={styles.newUserText}>Mauvais numéro?</Text>
                  <GlassButton
                    title="Changer de numéro"
                    onPress={() => setStep('phone')}
                    variant="text"
                    style={styles.toggleButton}
                  />
                </View>
              </>
            )}
          </GlassCard>

          <View style={styles.bottomSpacer} />
          
          <TouchableOpacity 
            style={styles.registerLink} 
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerText}>Nouveau chauffeur? </Text>
            <Text style={styles.registerBold}>S'inscrire</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  logoImageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  logo: {
    width: 110,
    height: 110,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
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
  verifyButton: {
    marginBottom: 12,
  },
  resendButton: {
    marginBottom: 12,
  },
  newUserContainer: {
    alignItems: 'center',
  },
  newUserText: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 12,
  },
  toggleButton: {
    paddingHorizontal: 20,
  },
  bottomSpacer: {
    height: 20,
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  registerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
  },
  registerBold: {
    color: '#FCD116',
    fontSize: 15,
    fontWeight: 'bold',
  },
});

export default LoginScreen;

