import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard, Alert, Image, ImageBackground, TouchableOpacity, StatusBar, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';

const { width, height } = Dimensions.get('window');
import { useAuth } from '../context/AuthContext';

const RegisterScreen = ({ navigation }) => {
  const { registerUser } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const fullPhone = phone.startsWith('+221') ? phone : '+221' + phone;

  const handleRegister = async () => {
    if (!name.trim()) { Alert.alert('Erreur', 'Nom requis'); return; }
    if (!phone || phone.length < 9) { Alert.alert('Erreur', 'Num\u00e9ro invalide'); return; }
    if (!email.trim() || !email.includes('@')) { Alert.alert('Erreur', 'Email valide requis (pour r\u00e9cup\u00e9ration du PIN)'); return; }
    if (!pin || pin.length !== 6) { Alert.alert('Erreur', 'Le PIN doit contenir 6 chiffres'); return; }
    setLoading(true);
    try { await registerUser(fullPhone, name, email, pin); } catch (error) { Alert.alert('Erreur', error.message || 'Erreur lors de l\'inscription'); } finally { setLoading(false); }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ImageBackground source={require('../../assets/login-header.jpg')} style={styles.headerImage} resizeMode="cover">
        <LinearGradient colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0.6)', 'rgba(0,26,18,1)']} locations={[0, 0.6, 1]} style={styles.headerGradient}>
          <View style={styles.logoCircle}><Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" /></View>
          <Text style={styles.appTitle}>Teran<Text style={{color: COLORS.yellow}}>GO</Text> Pro</Text>
          <Text style={styles.appSubtitle}>Rejoignez notre {"\u00e9quipe"}</Text>
        </LinearGradient>
      </ImageBackground>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.formArea}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Inscription</Text>
              <Text style={styles.cardSubtitle}>{"Cr\u00e9ez votre compte professionnel"}</Text>

              <Text style={styles.label}>Nom complet</Text>
              <TextInput style={styles.input} placeholder="Votre nom" placeholderTextColor="#999" value={name} onChangeText={setName} />

              <Text style={styles.label}>{"Num\u00e9ro de t\u00e9l\u00e9phone"}</Text>
              <View style={styles.phoneRow}>
                <View style={styles.prefixBox}><Text style={styles.prefixText}>+221</Text></View>
                <TextInput style={styles.phoneInput} placeholder="77 123 45 67" placeholderTextColor="#999" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={12} />
              </View>

              <Text style={styles.label}>{"Email (r\u00e9cup\u00e9ration PIN)"}</Text>
              <TextInput style={styles.input} placeholder="votre@email.com" placeholderTextColor="#999" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

              <Text style={styles.label}>{"Cr\u00e9er un PIN (6 chiffres)"}</Text>
              <View style={{flexDirection:'row',alignItems:'center'}}>
                <TextInput style={[styles.input,{flex:1,marginBottom:0}]} placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022"} placeholderTextColor="#999" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} secureTextEntry={!showPin} />
                <TouchableOpacity style={{padding:12,marginLeft:-48}} onPress={function(){setShowPin(!showPin);}}>
                  <Text style={{fontSize:18}}>{showPin ? '\uD83D\uDE48' : '\uD83D\uDC41\uFE0F'}</Text>
                </TouchableOpacity>
              </View>
              <View style={{height:20}} />

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
  headerImage: { width: width, height: height * 0.32 },
  headerGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 50 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8, overflow: 'hidden' },
  logo: { width: 85, height: 85 },
  appTitle: { fontSize: 28, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF', marginBottom: 4 },
  appSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)' , fontFamily: 'LexendDeca_400Regular' },
  formArea: { flex: 1, marginTop: -20 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  card: { backgroundColor: '#e8f8e0', borderRadius: 24, padding: 28, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 16, borderWidth: 1, borderColor: COLORS.grayLight },
  cardTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: COLORS.textDark, marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: COLORS.textDarkSub, marginBottom: 24 , fontFamily: 'LexendDeca_400Regular' },
  label: { fontSize: 13, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: COLORS.background, borderRadius: 14, padding: 16, fontSize: 16, color: COLORS.textDark, marginBottom: 20, borderWidth: 1, borderColor: COLORS.grayLight , fontFamily: 'LexendDeca_400Regular' },
  phoneRow: { flexDirection: 'row', marginBottom: 20, gap: 10 },
  prefixBox: { backgroundColor: COLORS.darkCard, borderRadius: 14, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  prefixText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF' },
  phoneInput: { flex: 1, backgroundColor: COLORS.background, borderRadius: 14, padding: 16, fontSize: 16, color: COLORS.textDark, borderWidth: 1, borderColor: COLORS.grayLight , fontFamily: 'LexendDeca_400Regular' },
  registerLink: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 30 },
  registerText: { color: COLORS.textDarkSub, fontSize: 15 , fontFamily: 'LexendDeca_400Regular' },
  registerBold: { color: COLORS.green, fontSize: 15, fontFamily: 'LexendDeca_700Bold' },
});

export default RegisterScreen;

