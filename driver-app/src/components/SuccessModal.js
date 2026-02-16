import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import COLORS from '../constants/colors';

const { width } = Dimensions.get('window');

const SuccessModal = ({ visible, title, message, onClose, amount }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.iconContainer}>
            <Text style={styles.checkmark}>{"\u2714"}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          {amount && (
            <View style={styles.amountContainer}>
              <Text style={styles.amountLabel}>Gains</Text>
              <Text style={styles.amount}>{amount} FCFA</Text>
            </View>
          )}
          {message && <Text style={styles.message}>{message}</Text>}
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Continuer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 28, width: width - 100, maxWidth: 320, alignItems: 'center', elevation: 10, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  iconContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(76,217,100,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 3, borderColor: COLORS.green },
  checkmark: { fontSize: 42, color: COLORS.green, fontWeight: 'bold' },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.textLight, textAlign: 'center', marginBottom: 12 },
  amountContainer: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  amountLabel: { fontSize: 12, color: COLORS.textLightMuted, textAlign: 'center', marginBottom: 4 },
  amount: { fontSize: 28, fontWeight: 'bold', color: COLORS.yellow, textAlign: 'center' },
  message: { fontSize: 15, color: COLORS.textLightSub, textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  button: { width: '100%', paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.yellow, alignItems: 'center', elevation: 4 },
  buttonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.darkBg },
});

export default SuccessModal;
