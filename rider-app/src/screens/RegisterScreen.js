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

var RegisterScreen = function(props) {
  var navigation = props.navigation;
  var auth = useAuth();
  var login = auth.login;

  var phoneState = useState('');
  var phone = phoneState[0];
  var setPhone = phoneState[1];

  var otpState = useState('');
  var otp = otpState[0];
  var setOtp = otpState[1];

  var nameState = useState('');
  var name = nameState[0];
  var setName = nameState[1];

  var loadingState = useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var stepState = useState(1);
  var step = stepState[0];
  var setStep = stepState[1];

  function handleSendOTP() {
    if (!phone || phone.length < 9) {
      Alert.alert('Erreur', 'Veuillez entrer un numéro de téléphone valide');
      return;
    }
    setLoading(true);
    var fullPhone = '+221' + phone.replace(/\s/g, '');
    authService.sendOTP(fullPhone).then(function(response) {
      if (response.success) {
        setStep(2);
        Alert.alert('Code envoyé', 'Vérifiez le terminal pour le code OTP');
      }
    }).catch(function(error) {
      Alert.alert('Erreur', error.response?.data?.message || 'Erreur envoi code');
    }).finally(function() {
      setLoading(false);
    });
  }

  function handleVerifyOTP() {
    if (!otp || otp.length !== 6) {
      Alert.alert('Erreur', 'Veuillez entrer un code OTP valide (6 chiffres)');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre nom');
      return;
    }
    setLoading(true);
    setLoading(true);
    var fullPhone = '+221' + phone.replace(/\s/g, '');
    login(fullPhone, otp, name, 'rider').then(function() {
      console.log('Registration successful');
    }).catch(function(error) {
      Alert.alert('Erreur', error.response?.data?.message || error.message || 'Code OTP invalide');
    }).finally(function() {
      setLoading(false);
    });
  }


  function renderStep1() {
    return (
      <>
        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>Inscrivez-vous pour commencer</Text>

        <Text style={styles.label}>Votre nom</Text>
        <TextInput
          style={styles.input}
          placeholder="Prénom et nom"
          placeholderTextColor={COLORS.grayLight}
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Numéro de téléphone</Text>
        <View style={styles.phoneRow}>
          <View style={styles.countryCode}>
            <Text style={styles.flag}>{"\uD83C\uDDF8\uD83C\uDDF3"}</Text>
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
  }

  function renderStep2() {
    return (
      <>
        <Text style={styles.title}>Vérification</Text>
        <Text style={styles.subtitle}>{'Entrez le code envoyé au +221' + phone}</Text>

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
          onPress={function() { setStep(1); }}
          variant="outline"
          style={{ marginTop: 12 }}
        />
      </>
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
            <View style={styles.logoImageWrapper}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>

          <Text style={styles.appTitle}>TeranGO</Text>

          <GlassCard style={styles.card}>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
          </GlassCard>

          <TouchableOpacity onPress={function() { navigation.navigate('Login'); }} style={styles.loginLink}>
            <Text style={styles.loginText}>{"Déjà inscrit? "}</Text>
            <Text style={styles.loginBold}>Se connecter</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

var styles = StyleSheet.create({
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
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: COLORS.gray,
    fontSize: 15,
  },
  loginBold: {
    color: '#00A86B',
    fontSize: 15,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: 20,
  },
});

export default RegisterScreen;
