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

var VEHICLE_TYPES = [
  { key: 'moto', icon: '🏍️', label: 'Moto' },
  { key: 'voiture', icon: '🚗', label: 'Voiture' },
  { key: 'velo', icon: '🚲', label: 'Velo' },
];

function RegisterScreen(props) {
  var navigation = props.navigation;
  var { login } = useAuth();
  
  var [step, setStep] = useState(1);
  var [phone, setPhone] = useState('');
  var [otp, setOtp] = useState('');
  var [name, setName] = useState('');
  var [vehicleType, setVehicleType] = useState('moto');
  var [plateNumber, setPlateNumber] = useState('');
  var [vehicleColor, setVehicleColor] = useState('');
  var [loading, setLoading] = useState(false);

  async function handleSendOTP() {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Numero de telephone invalide');
      return;
    }
    setLoading(true);
    try {
      var response = await authService.sendOTP(phone);
      if (response.success) {
        setStep(2);
        Alert.alert('Code envoye', 'Verifiez le terminal backend pour le code OTP');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyAndRegister() {
    if (!otp || otp.length !== 6) {
      Alert.alert('Erreur', 'Code OTP invalide');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre nom');
      return;
    }
    if (!plateNumber.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer le numero de plaque');
      return;
    }

    setLoading(true);
    try {
      var response = await authService.verifyOTP(phone, otp, name, 'driver');
      if (response.success && response.token) {
        await login(phone, otp, name, 'driver', {
          vehicleType: vehicleType,
          plateNumber: plateNumber,
          vehicleColor: vehicleColor
        });
      }
    } catch (error) {
      Alert.alert('Erreur', error.message || 'Inscription echouee');
    } finally {
      setLoading(false);
    }
  }

  function renderStep1() {
    return (
      <GlassCard style={styles.card}>
        <Text style={styles.title}>Devenir Chauffeur</Text>
        <Text style={styles.subtitle}>Entrez votre numero de telephone</Text>
        
        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <Text style={styles.countryFlag}>🇸🇳</Text>
            <Text style={styles.countryText}>+221</Text>
          </View>
          <TextInput
            style={styles.phoneInput}
            placeholder="77 123 45 67"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={12}
          />
        </View>

        <GlassButton
          title="Recevoir le code"
          onPress={handleSendOTP}
          loading={loading}
        />

        <TouchableOpacity onPress={function() { navigation.navigate('Login'); }} style={styles.linkRow}>
          <Text style={styles.linkText}>Deja inscrit? </Text>
          <Text style={styles.linkBold}>Se connecter</Text>
        </TouchableOpacity>
      </GlassCard>
    );
  }

  function renderStep2() {
    return (
      <GlassCard style={styles.card}>
        <Text style={styles.title}>Verification</Text>
        <Text style={styles.subtitle}>Entrez le code recu par SMS</Text>

        <TextInput
          style={styles.otpInput}
          placeholder="000000"
          placeholderTextColor="rgba(255,255,255,0.4)"
          keyboardType="number-pad"
          value={otp}
          onChangeText={setOtp}
          maxLength={6}
        />

        <GlassButton
          title="Verifier"
          onPress={function() { setStep(3); }}
          loading={loading}
        />

        <TouchableOpacity onPress={function() { setStep(1); }} style={styles.linkRow}>
          <Text style={styles.linkText}>Changer de numero</Text>
        </TouchableOpacity>
      </GlassCard>
    );
  }

  function renderStep3() {
    return (
      <GlassCard style={styles.card}>
        <Text style={styles.title}>Vos informations</Text>
        <Text style={styles.subtitle}>Completez votre profil chauffeur</Text>

        <Text style={styles.fieldLabel}>Nom complet</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Moussa Diop"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.fieldLabel}>Type de vehicule</Text>
        <View style={styles.vehicleRow}>
          {VEHICLE_TYPES.map(function(v) {
            var selected = vehicleType === v.key;
            return (
              <TouchableOpacity
                key={v.key}
                style={[styles.vehicleCard, selected && styles.vehicleCardSelected]}
                onPress={function() { setVehicleType(v.key); }}
              >
                <Text style={styles.vehicleIcon}>{v.icon}</Text>
                <Text style={[styles.vehicleLabel, selected && styles.vehicleLabelSelected]}>{v.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Numero de plaque</Text>
        <TextInput
          style={styles.textInput}
          placeholder="DK-1234-AB"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={plateNumber}
          onChangeText={setPlateNumber}
          autoCapitalize="characters"
        />

        <Text style={styles.fieldLabel}>Couleur du vehicule</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Noir, Blanc, Bleu..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={vehicleColor}
          onChangeText={setVehicleColor}
        />

        <View style={{ height: 16 }} />
        
        <GlassButton
          title="Terminer l'inscription"
          onPress={handleVerifyAndRegister}
          loading={loading}
        />
      </GlassCard>
    );
  }

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
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

var styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
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
    backgroundColor: 'rgba(179, 229, 206, 0.2)',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 70,
    height: 70,
  },
  card: {
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 24,
  },
  phoneRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(179, 229, 206, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  countryFlag: {
    fontSize: 20,
    marginRight: 6,
  },
  countryText: {
    color: COLORS.white,
    fontSize: 16,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: 'rgba(179, 229, 206, 0.15)',
    borderRadius: 12,
    padding: 16,
    color: COLORS.white,
    fontSize: 18,
  },
  otpInput: {
    backgroundColor: 'rgba(179, 229, 206, 0.15)',
    borderRadius: 12,
    padding: 16,
    color: COLORS.white,
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: 'rgba(179, 229, 206, 0.15)',
    borderRadius: 12,
    padding: 16,
    color: COLORS.white,
    fontSize: 16,
  },
  vehicleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  vehicleCard: {
    flex: 1,
    backgroundColor: 'rgba(179, 229, 206, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vehicleCardSelected: {
    borderColor: '#FCD116',
    backgroundColor: 'rgba(252, 209, 22, 0.1)',
  },
  vehicleIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  vehicleLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  vehicleLabelSelected: {
    color: '#FCD116',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  linkText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  linkBold: {
    color: '#FCD116',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default RegisterScreen;
