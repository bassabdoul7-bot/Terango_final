import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../constants/colors';

const FeedbackButton = ({ screen }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!message.trim()) { Alert.alert('', 'Ecrivez votre message'); return; }
    setSending(true);
    try {
      var userData = await AsyncStorage.getItem('user');
      var user = userData ? JSON.parse(userData) : {};
      await fetch('https://api.terango.sn/api/errors/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          screen: screen || 'unknown',
          userId: user.id || null,
          userName: user.name || 'unknown',
          userPhone: user.phone || '',
          app: 'rider'
        })
      });
      Alert.alert('Merci!', 'Votre retour a ete envoye.');
      setMessage('');
      setVisible(false);
    } catch(e) {
      Alert.alert('Erreur', 'Impossible d\'envoyer. Reessayez.');
    } finally { setSending(false); }
  };

  return (
    <>
      <TouchableOpacity style={styles.fab} onPress={() => setVisible(true)}>
        <Text style={styles.fabIcon}>{'\u2753'}</Text>
        <Text style={styles.fabLabel}>Signaler un probleme</Text>
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
          <View style={styles.card}>
            <Text style={styles.title}>Un probleme?</Text>
            <Text style={styles.subtitle}>Dites-nous ce qui ne va pas</Text>
            <TextInput
              style={styles.input}
              placeholder="Decrivez le probleme..."
              placeholderTextColor={COLORS.textDarkMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.buttons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setVisible(false); setMessage(''); }}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending}>
                <Text style={styles.sendText}>{sending ? 'Envoi...' : 'Envoyer'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, backgroundColor: COLORS.darkCard, borderWidth: 1, borderColor: COLORS.darkCardBorder, marginBottom: 16 },
  fabIcon: { fontSize: 20, marginRight: 10 },
  fabLabel: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.yellow },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  title: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textDark, marginBottom: 4 },
  subtitle: { fontSize: 14, fontFamily: 'LexendDeca_400Regular', color: COLORS.textDarkSub, marginBottom: 16 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 14, padding: 16, fontSize: 15, fontFamily: 'LexendDeca_400Regular', color: COLORS.textDark, minHeight: 120, borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 16 },
  buttons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0', alignItems: 'center' },
  cancelText: { fontSize: 15, fontFamily: 'LexendDeca_500Medium', color: COLORS.textDarkSub },
  sendBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.green, alignItems: 'center' },
  sendText: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF' },
});

export default FeedbackButton;



