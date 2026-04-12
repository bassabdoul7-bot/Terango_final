import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard, Alert, Image, TouchableOpacity, StatusBar, ImageBackground, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api.service';

var { width, height } = Dimensions.get('window');
var HEADER_HEIGHT = height * 0.35;

const LoginScreen = ({ navigation }) => {
  const { loginWithPin } = useAuth();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const fullPhone = phone.startsWith('+221') ? phone : '+221' + phone;

  const handleLogin = async () => {
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Num\u00e9ro de t\u00e9l\u00e9phone invalide'); return; }
    if (!pin || pin.length !== 6) { Alert.alert('Erreur', 'Le PIN doit contenir 6 chiffres'); return; }
    setLoading(true);
    try { await loginWithPin(fullPhone, pin); } catch (error) { Alert.alert('Erreur', error.message || 'PIN incorrect'); } finally { setLoading(false); }
  };

  const handleForgotPin = async () => {
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Entrez votre num\u00e9ro d\'abord'); return; }
    setLoading(true);
    try { const response = await authService.forgotPin(fullPhone); if (response.success) { setForgotMode(true); Alert.alert('Code envoy\u00e9', 'V\u00e9rifiez votre email'); } } catch (error) { Alert.alert('Erreur', error.message || 'Aucun email associ\u00e9'); } finally { setLoading(false); }
  };

  const handleResetPin = async () => {
    if (!otp || otp.length !== 6) { Alert.alert('Erreur', 'Code \u00e0 6 chiffres requis'); return; }
    if (!newPin || newPin.length !== 6) { Alert.alert('Erreur', 'Le PIN doit contenir 6 chiffres'); return; }
    if (newPin !== confirmPin) { Alert.alert('Erreur', 'Les PINs ne correspondent pas'); return; }
    setLoading(true);
    try { const response = await authService.resetPin(fullPhone, otp, newPin); if (response.success) { Alert.alert('Succ\u00e8s', 'PIN r\u00e9initialis\u00e9!'); setForgotMode(false); setOtp(''); setNewPin(''); setConfirmPin(''); setPin(''); } } catch (error) { Alert.alert('Erreur', error.message || 'Code invalide'); } finally { setLoading(false); }
  };

  function renderHeader(subtitleText) {
    return (
      <ImageBackground source={require('../../assets/login-header.jpg')} style={styles.headerImage} resizeMode="cover">
        <LinearGradient
          colors={['transparent', 'rgba(0,26,18,0.7)', 'rgba(0,26,18,0.95)']}
          locations={[0, 0.6, 1]}
          style={styles.headerGradient}
        />
        <View style={styles.headerContent}>
          <View style={styles.logoCircle}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={styles.appTitle}>Teran<Text style={{color: COLORS.yellow}}>GO</Text> Pro</Text>
          <Text style={styles.appSubtitle}>{subtitleText}</Text>
        </View>
      </ImageBackground>
    );
  }

  if (forgotMode) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        {renderHeader("\u00c9space chauffeur")}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.formArea}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{"R\u00e9initialisation"}</Text>
                <Text style={styles.cardSubtitle}>{"Entrez le code re\u00e7u par email"}</Text>
                <Text style={styles.label}>Code (6 chiffres)</Text>
                <TextInput style={styles.input} placeholder="000000" placeholderTextColor="#999" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
                <Text style={styles.label}>Nouveau PIN (6 chiffres)</Text>
                <TextInput style={styles.input} placeholder={"\u2022\u2022\u2022\u2022"} placeholderTextColor="#999" value={newPin} onChangeText={setNewPin} keyboardType="number-pad" maxLength={6} secureTextEntry />
                <Text style={styles.label}>Confirmer PIN</Text>
                <TextInput style={styles.input} placeholder={"\u2022\u2022\u2022\u2022"} placeholderTextColor="#999" value={confirmPin} onChangeText={setConfirmPin} keyboardType="number-pad" maxLength={6} secureTextEntry />
                <GlassButton title={loading ? 'Envoi...' : 'R\u00e9initialiser'} onPress={handleResetPin} loading={loading} />
                <TouchableOpacity onPress={() => setForgotMode(false)} style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Retour</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {renderHeader("\u00c9space chauffeur")}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.formArea}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Bienvenue</Text>
              <Text style={styles.cardSubtitle}>Connectez-vous avec votre PIN</Text>
              <Text style={styles.label}>{"Num\u00e9ro de t\u00e9l\u00e9phone"}</Text>
              <View style={styles.phoneRow}>
                <View style={styles.prefixBox}><Text style={styles.prefixText}>+221</Text></View>
                <TextInput style={styles.phoneInput} placeholder="77 123 45 67" placeholderTextColor="#999" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={12} />
              </View>
              <Text style={styles.label}>PIN (6 chiffres)</Text>
              <TextInput style={styles.input} placeholder={"\u2022\u2022\u2022\u2022"} placeholderTextColor="#999" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} secureTextEntry />
              <GlassButton title={loading ? 'Connexion...' : 'Se connecter'} onPress={handleLogin} loading={loading} />
              <TouchableOpacity onPress={handleForgotPin} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={styles.forgotText}>{"PIN oubli\u00e9?"}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerText}>Nouveau sur TeranGO? </Text>
              <Text style={styles.registerBold}>S'inscrire</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerImage: { width: width, height: HEADER_HEIGHT },
  headerGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: HEADER_HEIGHT },
  headerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 30 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, overflow: 'hidden' },
  logo: { width: 85, height: 85 },
  appTitle: { fontSize: 28, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF', marginBottom: 4 },
  appSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'LexendDeca_400Regular' },
  formArea: { flex: 1, marginTop: -20 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  card: { backgroundColor: '#e8f8e0', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, padding: 28, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, borderWidth: 1, borderColor: COLORS.grayLight },
  cardTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: COLORS.textDark, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: COLORS.textDarkSub, marginBottom: 24, fontFamily: 'LexendDeca_400Regular' },
  label: { fontSize: 13, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.background, borderRadius: 14, padding: 16, fontSize: 16, color: COLORS.textDark, marginBottom: 20, borderWidth: 1, borderColor: COLORS.grayLight, fontFamily: 'LexendDeca_400Regular' },
  phoneRow: { flexDirection: 'row', marginBottom: 20, gap: 10 },
  prefixBox: { backgroundColor: COLORS.darkCard, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  prefixText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF' },
  phoneInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: 14, padding: 16, fontSize: 16, color: COLORS.textDark, borderWidth: 1, borderColor: COLORS.grayLight, fontFamily: 'LexendDeca_400Regular' },
  forgotText: { color: COLORS.green, fontSize: 14, fontFamily: 'LexendDeca_500Medium' },
  secondaryBtn: { marginTop: 12, paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.background, alignItems: 'center', borderWidth: 1, borderColor: '#E5E5E5' },
  secondaryBtnText: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.gray },
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 30 },
  registerText: { color: COLORS.textDarkSub, fontSize: 15, fontFamily: 'LexendDeca_400Regular' },
  registerBold: { color: COLORS.green, fontSize: 15, fontFamily: 'LexendDeca_700Bold' },
});

export default LoginScreen;
