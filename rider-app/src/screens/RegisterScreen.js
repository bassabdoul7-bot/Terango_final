import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard, Alert, TouchableOpacity, Image, StatusBar } from 'react-native';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';
import { useAuth } from '../context/AuthContext';

var RegisterScreen = function(props) {
  var navigation = props.navigation;
  var auth = useAuth();
  var registerUser = auth.registerUser;
  var nameState = useState(''); var name = nameState[0]; var setName = nameState[1];
  var phoneState = useState(''); var phone = phoneState[0]; var setPhone = phoneState[1];
  var emailState = useState(''); var email = emailState[0]; var setEmail = emailState[1];
  var pinState = useState(''); var pin = pinState[0]; var setPin = pinState[1];
  var confirmPinState = useState(''); var confirmPin = confirmPinState[0]; var setConfirmPin = confirmPinState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var fullPhone = phone.startsWith('+221') ? phone : '+221' + phone;

  function handleRegister() {
    if (!name.trim()) { Alert.alert('Erreur', 'Nom requis'); return; }
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Num\u00e9ro invalide'); return; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Erreur', 'Email valide requis (pour r\u00e9cup\u00e9ration du PIN)'); return; }
    if (!pin || pin.length !== 4) { Alert.alert('Erreur', 'PIN de 4 chiffres requis'); return; }
    if (pin !== confirmPin) { Alert.alert('Erreur', 'Les PINs ne correspondent pas'); return; }
    setLoading(true);
    registerUser(fullPhone, name, email, pin).then(function() { setLoading(false); }).catch(function(error) { setLoading(false); Alert.alert('Erreur', error.message || 'Erreur lors de l\'inscription'); });
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.darkHeader}>
        <View style={styles.logoCircle}><Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode='contain' /></View>
        <Text style={styles.appTitle}>TeranGO</Text>
        <Text style={styles.appSubtitle}>{"Cr\u00e9ez votre compte"}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.formArea}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Inscription</Text>
              <Text style={styles.cardSubtitle}>{"Rejoignez la communaut\u00e9 TeranGO"}</Text>

              <Text style={styles.label}>Nom complet</Text>
              <TextInput style={styles.input} placeholder='Votre nom' placeholderTextColor={COLORS.gray} value={name} onChangeText={setName} />

              <Text style={styles.label}>{"Num\u00e9ro de t\u00e9l\u00e9phone"}</Text>
              <View style={styles.phoneRow}>
                <View style={styles.prefixBox}><Text style={styles.prefixText}>+221</Text></View>
                <TextInput style={styles.phoneInput} placeholder='77 123 45 67' placeholderTextColor={COLORS.gray} value={phone} onChangeText={setPhone} keyboardType='phone-pad' maxLength={12} />
              </View>

              <Text style={styles.label}>{"Email (r\u00e9cup\u00e9ration PIN)"}</Text>
              <TextInput style={styles.input} placeholder='votre@email.com' placeholderTextColor={COLORS.gray} value={email} onChangeText={setEmail} keyboardType='email-address' autoCapitalize='none' />

              <Text style={styles.label}>{"Cr\u00e9er un PIN (4 chiffres)"}</Text>
              <TextInput style={styles.input} placeholder={'\u2022\u2022\u2022\u2022'} placeholderTextColor={COLORS.gray} value={pin} onChangeText={setPin} keyboardType='number-pad' maxLength={4} secureTextEntry />

              <Text style={styles.label}>Confirmer le PIN</Text>
              <TextInput style={styles.input} placeholder={'\u2022\u2022\u2022\u2022'} placeholderTextColor={COLORS.gray} value={confirmPin} onChangeText={setConfirmPin} keyboardType='number-pad' maxLength={4} secureTextEntry />

              <GlassButton title={loading ? 'Inscription...' : 'S\'inscrire'} onPress={handleRegister} loading={loading} />
            </View>
            <TouchableOpacity style={styles.registerLink} onPress={function() { navigation.navigate('Login'); }}>
              <Text style={styles.registerText}>{"D\u00e9j\u00e0 un compte? "}</Text>
              <Text style={styles.registerBold}>Se connecter</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  darkHeader: { backgroundColor: COLORS.darkBg, paddingTop: 70, paddingBottom: 40, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, overflow: 'hidden' },
  logo: { width: 85, height: 85 },
  appTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  appSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  formArea: { flex: 1, marginTop: -20 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, borderWidth: 1, borderColor: COLORS.grayLight },
  cardTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textDark, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: COLORS.textDarkSub, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.background, borderRadius: 14, padding: 16, fontSize: 16, color: COLORS.textDark, marginBottom: 20, borderWidth: 1, borderColor: COLORS.grayLight },
  phoneRow: { flexDirection: 'row', marginBottom: 20, gap: 10 },
  prefixBox: { backgroundColor: COLORS.darkBg, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  prefixText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  phoneInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: 14, padding: 16, fontSize: 16, color: COLORS.textDark, borderWidth: 1, borderColor: COLORS.grayLight },
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 30 },
  registerText: { color: COLORS.textDarkSub, fontSize: 15 },
  registerBold: { color: COLORS.green, fontSize: 15, fontWeight: 'bold' },
});

export default RegisterScreen;
