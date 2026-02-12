import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
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
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>⏳</Text>
        </View>
        <Text style={styles.title}>Verification en cours</Text>
        <Text style={styles.subtitle}>
          Vos documents sont en cours de verification par notre equipe.
          Vous serez notifie une fois votre compte approuve.
        </Text>
        <Text style={styles.hint}>
          Cela prend generalement moins de 24 heures.
        </Text>

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
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center' },
  content: { paddingHorizontal: 32, alignItems: 'center' },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(252, 209, 22, 0.15)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  icon: { fontSize: 48 },
  title: { fontSize: 24, fontWeight: 'bold', color: COLORS.black, marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 15, color: COLORS.gray, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  hint: { fontSize: 13, color: COLORS.green, textAlign: 'center', fontWeight: '600', marginBottom: 32 },
  buttons: { width: '100%' },
});

export default PendingVerificationScreen;