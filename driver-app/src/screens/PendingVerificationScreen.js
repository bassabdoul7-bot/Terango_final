import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';

const PendingVerificationScreen = ({ onApproved, onUploadNeeded }) => {
  const { logout } = useAuth();
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await driverService.getVerificationStatus();
      if (res.verificationStatus === 'approved') {
        onApproved();
      } else if (!res.hasDocuments) {
        onUploadNeeded();
      }
    } catch (error) {
      console.error('Check status error:', error);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#003322', '#00853F']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.heroGradient}
      >
        <Text style={styles.heroEyebrow}>VERIFICATION EN COURS</Text>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>{"⏳"}</Text>
        </View>
      </LinearGradient>
      <View style={styles.contentArea}>
        <View style={styles.card}>
          <Text style={styles.title}>Vos documents sont en cours d'examen</Text>
          <Text style={styles.subtitle}>
            Notre équipe vérifie vos informations. Vous serez notifié dès l'approbation.
          </Text>
          <Text style={styles.hint}>
            Cela prend généralement moins de 24 heures.
          </Text>
        </View>

        <View style={styles.buttons}>
          {checking ? (
            <ActivityIndicator size="small" color={COLORS.green} />
          ) : (
            <GlassButton title="Verifier le statut" onPress={checkStatus} />
          )}
          <View style={{ height: 12 }} />
          <GlassButton title="Se deconnecter" onPress={logout} variant="secondary" />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  heroGradient: { paddingTop: 90, paddingBottom: 48, paddingHorizontal: 24, alignItems: 'center' },
  heroEyebrow: { fontSize: 12, fontFamily: 'LexendDeca_700Bold', color: 'rgba(255,255,255,0.85)', letterSpacing: 2, marginBottom: 24 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  icon: { fontSize: 48, fontFamily: 'LexendDeca_400Regular' },
  contentArea: { flex: 1, paddingHorizontal: 16, paddingTop: 18, marginTop: -18, backgroundColor: '#F2F4F7', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  title: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#5a5a5a', textAlign: 'center', lineHeight: 22, marginBottom: 12, fontFamily: 'LexendDeca_400Regular' },
  hint: { fontSize: 13, color: COLORS.green, textAlign: 'center', fontFamily: 'LexendDeca_700Bold' },
  buttons: { width: '100%', marginTop: 20 },
});

export default PendingVerificationScreen;
