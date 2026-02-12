var fs = require('fs');

// 1. Rider LoginScreen - Senegalese theme with PIN
var loginCode = "import React, { useState } from 'react';\n\
import {\n\
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,\n\
  Platform, ScrollView, TouchableWithoutFeedback, Keyboard,\n\
  Alert, TouchableOpacity, Image,\n\
} from 'react-native';\n\
import GlassButton from '../components/GlassButton';\n\
import GlassCard from '../components/GlassCard';\n\
import COLORS from '../constants/colors';\n\
import { useAuth } from '../context/AuthContext';\n\
import { authService } from '../services/api.service';\n\
\n\
var LoginScreen = function(props) {\n\
  var navigation = props.navigation;\n\
  var auth = useAuth();\n\
  var loginWithPin = auth.loginWithPin;\n\
\n\
  var phoneState = useState('');\n\
  var phone = phoneState[0];\n\
  var setPhone = phoneState[1];\n\
\n\
  var pinState = useState('');\n\
  var pin = pinState[0];\n\
  var setPin = pinState[1];\n\
\n\
  var loadingState = useState(false);\n\
  var loading = loadingState[0];\n\
  var setLoading = loadingState[1];\n\
\n\
  var forgotModeState = useState(false);\n\
  var forgotMode = forgotModeState[0];\n\
  var setForgotMode = forgotModeState[1];\n\
\n\
  var forgotStepState = useState('phone');\n\
  var forgotStep = forgotStepState[0];\n\
  var setForgotStep = forgotStepState[1];\n\
\n\
  var otpState = useState('');\n\
  var otp = otpState[0];\n\
  var setOtp = otpState[1];\n\
\n\
  var newPinState = useState('');\n\
  var newPin = newPinState[0];\n\
  var setNewPin = newPinState[1];\n\
\n\
  var confirmPinState = useState('');\n\
  var confirmPin = confirmPinState[0];\n\
  var setConfirmPin = confirmPinState[1];\n\
\n\
  var fullPhone = phone.startsWith('+221') ? phone : '+221' + phone;\n\
\n\
  function handleLogin() {\n\
    if (!phone || phone.length < 9) {\n\
      Alert.alert('Erreur', 'Num\\u00e9ro de t\\u00e9l\\u00e9phone invalide');\n\
      return;\n\
    }\n\
    if (!pin || pin.length !== 4) {\n\
      Alert.alert('Erreur', 'Le PIN doit contenir 4 chiffres');\n\
      return;\n\
    }\n\
    setLoading(true);\n\
    loginWithPin(fullPhone, pin).then(function() {\n\
      setLoading(false);\n\
    }).catch(function(error) {\n\
      setLoading(false);\n\
      Alert.alert('Erreur', error.message || 'PIN incorrect');\n\
    });\n\
  }\n\
\n\
  function handleForgotPin() {\n\
    if (!phone || phone.length < 9) {\n\
      Alert.alert('Erreur', 'Entrez votre num\\u00e9ro d\\'abord');\n\
      return;\n\
    }\n\
    setLoading(true);\n\
    authService.forgotPin(fullPhone).then(function(response) {\n\
      setLoading(false);\n\
      if (response.success) {\n\
        setForgotMode(true);\n\
        setForgotStep('otp');\n\
        Alert.alert('Code envoy\\u00e9', 'V\\u00e9rifiez votre email');\n\
      }\n\
    }).catch(function(error) {\n\
      setLoading(false);\n\
      Alert.alert('Erreur', error.message || 'Aucun email associ\\u00e9');\n\
    });\n\
  }\n\
\n\
  function handleResetPin() {\n\
    if (!otp || otp.length !== 6) {\n\
      Alert.alert('Erreur', 'Code \\u00e0 6 chiffres requis');\n\
      return;\n\
    }\n\
    if (!newPin || newPin.length !== 4) {\n\
      Alert.alert('Erreur', 'Le PIN doit contenir 4 chiffres');\n\
      return;\n\
    }\n\
    if (newPin !== confirmPin) {\n\
      Alert.alert('Erreur', 'Les PINs ne correspondent pas');\n\
      return;\n\
    }\n\
    setLoading(true);\n\
    authService.resetPin(fullPhone, otp, newPin).then(function(response) {\n\
      setLoading(false);\n\
      if (response.success) {\n\
        Alert.alert('Succ\\u00e8s', 'PIN r\\u00e9initialis\\u00e9!');\n\
        setForgotMode(false);\n\
        setOtp(''); setNewPin(''); setConfirmPin(''); setPin('');\n\
      }\n\
    }).catch(function(error) {\n\
      setLoading(false);\n\
      Alert.alert('Erreur', error.message || 'Code invalide');\n\
    });\n\
  }\n\
\n\
  if (forgotMode) {\n\
    return (\n\
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>\n\
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>\n\
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>\n\
            <View style={styles.logoCircle}>\n\
              <View style={styles.logoImageWrapper}>\n\
                <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode='contain' />\n\
              </View>\n\
            </View>\n\
            <Text style={styles.appTitle}>TeranGO</Text>\n\
            <GlassCard style={styles.card}>\n\
              <Text style={styles.title}>R\\u00e9initialiser PIN</Text>\n\
              <Text style={styles.subtitle}>Entrez le code re\\u00e7u par email</Text>\n\
              <Text style={styles.label}>Code (6 chiffres)</Text>\n\
              <TextInput style={styles.input} placeholder='000000' placeholderTextColor={COLORS.grayLight}\n\
                value={otp} onChangeText={setOtp} keyboardType='number-pad' maxLength={6} />\n\
              <Text style={styles.label}>Nouveau PIN (4 chiffres)</Text>\n\
              <TextInput style={styles.input} placeholder='\\u2022\\u2022\\u2022\\u2022' placeholderTextColor={COLORS.grayLight}\n\
                value={newPin} onChangeText={setNewPin} keyboardType='number-pad' maxLength={4} secureTextEntry />\n\
              <Text style={styles.label}>Confirmer PIN</Text>\n\
              <TextInput style={styles.input} placeholder='\\u2022\\u2022\\u2022\\u2022' placeholderTextColor={COLORS.grayLight}\n\
                value={confirmPin} onChangeText={setConfirmPin} keyboardType='number-pad' maxLength={4} secureTextEntry />\n\
              <GlassButton title={loading ? 'Envoi...' : 'R\\u00e9initialiser'} onPress={handleResetPin} loading={loading} />\n\
              <GlassButton title='Retour' onPress={function() { setForgotMode(false); }} variant='outline' style={{ marginTop: 12 }} />\n\
            </GlassCard>\n\
          </ScrollView>\n\
        </TouchableWithoutFeedback>\n\
      </KeyboardAvoidingView>\n\
    );\n\
  }\n\
\n\
  return (\n\
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>\n\
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>\n\
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>\n\
          <View style={styles.logoCircle}>\n\
            <View style={styles.logoImageWrapper}>\n\
              <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode='contain' />\n\
            </View>\n\
          </View>\n\
          <Text style={styles.appTitle}>TeranGO</Text>\n\
          <GlassCard style={styles.card}>\n\
            <Text style={styles.title}>Connexion</Text>\n\
            <Text style={styles.subtitle}>Connectez-vous avec votre PIN</Text>\n\
            <Text style={styles.label}>Num\\u00e9ro de t\\u00e9l\\u00e9phone</Text>\n\
            <TextInput style={styles.input} placeholder='77 123 45 67' placeholderTextColor={COLORS.grayLight}\n\
              value={phone} onChangeText={setPhone} keyboardType='phone-pad' maxLength={12} />\n\
            <Text style={styles.label}>PIN (4 chiffres)</Text>\n\
            <TextInput style={styles.input} placeholder='\\u2022\\u2022\\u2022\\u2022' placeholderTextColor={COLORS.grayLight}\n\
              value={pin} onChangeText={setPin} keyboardType='number-pad' maxLength={4} secureTextEntry />\n\
            <GlassButton title={loading ? 'Connexion...' : 'Se connecter'} onPress={handleLogin} loading={loading} />\n\
            <TouchableOpacity onPress={handleForgotPin} style={{ marginTop: 16, alignItems: 'center' }}>\n\
              <Text style={{ color: COLORS.green, fontSize: 14 }}>PIN oubli\\u00e9?</Text>\n\
            </TouchableOpacity>\n\
          </GlassCard>\n\
          <View style={styles.bottomSpacer} />\n\
          <TouchableOpacity style={styles.registerLink} onPress={function() { navigation.navigate('Register'); }}>\n\
            <Text style={styles.registerText}>Nouveau? </Text>\n\
            <Text style={styles.registerBold}>S'inscrire</Text>\n\
          </TouchableOpacity>\n\
        </ScrollView>\n\
      </TouchableWithoutFeedback>\n\
    </KeyboardAvoidingView>\n\
  );\n\
};\n\
\n\
var styles = StyleSheet.create({\n\
  container: { flex: 1, backgroundColor: COLORS.background },\n\
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },\n\
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.95)', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#00853F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },\n\
  logoImageWrapper: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },\n\
  logo: { width: 110, height: 110 },\n\
  appTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.green, textAlign: 'center', marginBottom: 24 },\n\
  card: { backgroundColor: 'rgba(0, 133, 63, 0.15)', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: 'rgba(0, 133, 63, 0.3)', shadowColor: '#00853F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20 },\n\
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.black, marginBottom: 8 },\n\
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },\n\
  label: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 8 },\n\
  input: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.black, marginBottom: 20, borderWidth: 1, borderColor: COLORS.grayLight },\n\
  bottomSpacer: { height: 20 },\n\
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },\n\
  registerText: { color: COLORS.gray, fontSize: 15 },\n\
  registerBold: { color: COLORS.green, fontSize: 15, fontWeight: 'bold' },\n\
});\n\
\n\
export default LoginScreen;\n";

fs.writeFileSync('C:/Users/bassa/Projects/terango-final/rider-app/src/screens/LoginScreen.js', loginCode, 'utf8');
console.log('1. Rider LoginScreen - Senegalese theme restored with PIN');

// 2. Rider RegisterScreen - Senegalese theme with PIN
var regCode = "import React, { useState } from 'react';\n\
import {\n\
  View, Text, TextInput, StyleSheet, KeyboardAvoidingView,\n\
  Platform, ScrollView, TouchableWithoutFeedback, Keyboard,\n\
  Alert, TouchableOpacity, Image,\n\
} from 'react-native';\n\
import GlassButton from '../components/GlassButton';\n\
import GlassCard from '../components/GlassCard';\n\
import COLORS from '../constants/colors';\n\
import { useAuth } from '../context/AuthContext';\n\
\n\
var RegisterScreen = function(props) {\n\
  var navigation = props.navigation;\n\
  var auth = useAuth();\n\
  var registerUser = auth.registerUser;\n\
\n\
  var nameState = useState('');\n\
  var name = nameState[0];\n\
  var setName = nameState[1];\n\
\n\
  var phoneState = useState('');\n\
  var phone = phoneState[0];\n\
  var setPhone = phoneState[1];\n\
\n\
  var emailState = useState('');\n\
  var email = emailState[0];\n\
  var setEmail = emailState[1];\n\
\n\
  var pinState = useState('');\n\
  var pin = pinState[0];\n\
  var setPin = pinState[1];\n\
\n\
  var confirmPinState = useState('');\n\
  var confirmPin = confirmPinState[0];\n\
  var setConfirmPin = confirmPinState[1];\n\
\n\
  var loadingState = useState(false);\n\
  var loading = loadingState[0];\n\
  var setLoading = loadingState[1];\n\
\n\
  var fullPhone = phone.startsWith('+221') ? phone : '+221' + phone;\n\
\n\
  function handleRegister() {\n\
    if (!name.trim()) { Alert.alert('Erreur', 'Nom requis'); return; }\n\
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Num\\u00e9ro invalide'); return; }\n\
    if (!email.trim() || !email.includes('@')) { Alert.alert('Erreur', 'Email valide requis (pour r\\u00e9cup\\u00e9ration du PIN)'); return; }\n\
    if (!pin || pin.length !== 4) { Alert.alert('Erreur', 'PIN de 4 chiffres requis'); return; }\n\
    if (pin !== confirmPin) { Alert.alert('Erreur', 'Les PINs ne correspondent pas'); return; }\n\
\n\
    setLoading(true);\n\
    registerUser(fullPhone, name, email, pin).then(function() {\n\
      setLoading(false);\n\
    }).catch(function(error) {\n\
      setLoading(false);\n\
      Alert.alert('Erreur', error.message || 'Erreur lors de l\\'inscription');\n\
    });\n\
  }\n\
\n\
  return (\n\
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>\n\
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>\n\
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps='handled'>\n\
          <View style={styles.logoCircle}>\n\
            <View style={styles.logoImageWrapper}>\n\
              <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode='contain' />\n\
            </View>\n\
          </View>\n\
          <Text style={styles.appTitle}>TeranGO</Text>\n\
          <GlassCard style={styles.card}>\n\
            <Text style={styles.title}>Inscription</Text>\n\
            <Text style={styles.subtitle}>Cr\\u00e9ez votre compte passager</Text>\n\
\n\
            <Text style={styles.label}>Nom complet</Text>\n\
            <TextInput style={styles.input} placeholder='Votre nom' placeholderTextColor={COLORS.grayLight}\n\
              value={name} onChangeText={setName} />\n\
\n\
            <Text style={styles.label}>Num\\u00e9ro de t\\u00e9l\\u00e9phone</Text>\n\
            <TextInput style={styles.input} placeholder='77 123 45 67' placeholderTextColor={COLORS.grayLight}\n\
              value={phone} onChangeText={setPhone} keyboardType='phone-pad' maxLength={12} />\n\
\n\
            <Text style={styles.label}>Email (pour r\\u00e9cup\\u00e9ration PIN)</Text>\n\
            <TextInput style={styles.input} placeholder='votre@email.com' placeholderTextColor={COLORS.grayLight}\n\
              value={email} onChangeText={setEmail} keyboardType='email-address' autoCapitalize='none' />\n\
\n\
            <Text style={styles.label}>Cr\\u00e9er un PIN (4 chiffres)</Text>\n\
            <TextInput style={styles.input} placeholder='\\u2022\\u2022\\u2022\\u2022' placeholderTextColor={COLORS.grayLight}\n\
              value={pin} onChangeText={setPin} keyboardType='number-pad' maxLength={4} secureTextEntry />\n\
\n\
            <Text style={styles.label}>Confirmer le PIN</Text>\n\
            <TextInput style={styles.input} placeholder='\\u2022\\u2022\\u2022\\u2022' placeholderTextColor={COLORS.grayLight}\n\
              value={confirmPin} onChangeText={setConfirmPin} keyboardType='number-pad' maxLength={4} secureTextEntry />\n\
\n\
            <GlassButton title={loading ? 'Inscription...' : 'S\\'inscrire'} onPress={handleRegister} loading={loading} />\n\
          </GlassCard>\n\
          <View style={styles.bottomSpacer} />\n\
          <TouchableOpacity style={styles.registerLink} onPress={function() { navigation.navigate('Login'); }}>\n\
            <Text style={styles.registerText}>D\\u00e9j\\u00e0 un compte? </Text>\n\
            <Text style={styles.registerBold}>Se connecter</Text>\n\
          </TouchableOpacity>\n\
        </ScrollView>\n\
      </TouchableWithoutFeedback>\n\
    </KeyboardAvoidingView>\n\
  );\n\
};\n\
\n\
var styles = StyleSheet.create({\n\
  container: { flex: 1, backgroundColor: COLORS.background },\n\
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },\n\
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.95)', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#00853F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },\n\
  logoImageWrapper: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },\n\
  logo: { width: 110, height: 110 },\n\
  appTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.green, textAlign: 'center', marginBottom: 24 },\n\
  card: { backgroundColor: 'rgba(0, 133, 63, 0.15)', borderRadius: 24, padding: 32, borderWidth: 1, borderColor: 'rgba(0, 133, 63, 0.3)', shadowColor: '#00853F', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20 },\n\
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.black, marginBottom: 8 },\n\
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },\n\
  label: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 8 },\n\
  input: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.black, marginBottom: 20, borderWidth: 1, borderColor: COLORS.grayLight },\n\
  bottomSpacer: { height: 20 },\n\
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginBottom: 30 },\n\
  registerText: { color: COLORS.gray, fontSize: 15 },\n\
  registerBold: { color: COLORS.green, fontSize: 15, fontWeight: 'bold' },\n\
});\n\
\n\
export default RegisterScreen;\n";

fs.writeFileSync('C:/Users/bassa/Projects/terango-final/rider-app/src/screens/RegisterScreen.js', regCode, 'utf8');
console.log('2. Rider RegisterScreen - Senegalese theme restored with PIN');

console.log('Done!');
