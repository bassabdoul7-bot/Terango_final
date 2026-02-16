import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import COLORS from '../constants/colors';

const { width } = Dimensions.get('window');

const ConfirmModal = ({ visible, title, message, onCancel, onConfirm, confirmText = 'Confirmer', cancelText = 'Annuler' }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{"\u26A0"}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
              <Text style={styles.confirmButtonText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 24, width: width - 100, maxWidth: 300, alignItems: 'center', elevation: 10, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  iconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(252,209,22,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: COLORS.yellow },
  icon: { fontSize: 36, color: COLORS.yellow, fontWeight: 'bold' },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.textLight, textAlign: 'center', marginBottom: 8 },
  message: { fontSize: 14, color: COLORS.textLightSub, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  buttonContainer: { flexDirection: 'row', width: '100%', gap: 10 },
  cancelButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  cancelButtonText: { fontSize: 14, fontWeight: '600', color: COLORS.textLightSub },
  confirmButton: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: COLORS.yellow, alignItems: 'center', elevation: 4 },
  confirmButtonText: { fontSize: 14, fontWeight: 'bold', color: COLORS.darkBg },
});

export default ConfirmModal;
