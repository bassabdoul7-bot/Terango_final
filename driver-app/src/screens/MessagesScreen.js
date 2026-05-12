import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../constants/colors';

var MessagesScreen = function() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <LinearGradient
        colors={['#000000', '#003322', '#00853F']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.heroGradient}
      >
        <Text style={styles.heroEyebrow}>MESSAGES</Text>
        <Text style={styles.heroSubtitle}>Vos conversations avec les passagers</Text>
      </LinearGradient>

      <View style={styles.contentArea}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>{'💬'}</Text>
          <Text style={styles.emptyTitle}>Aucun message</Text>
          <Text style={styles.emptySub}>Vos conversations avec les passagers apparaîtront ici dès qu'une course commence.</Text>
        </View>
      </View>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },
  heroGradient: { paddingTop: 70, paddingBottom: 36, paddingHorizontal: 24, alignItems: 'center' },
  heroEyebrow: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF', letterSpacing: 2, marginBottom: 6 },
  heroSubtitle: { fontSize: 13, fontFamily: 'LexendDeca_400Regular', color: 'rgba(255,255,255,0.75)' },
  contentArea: { flex: 1, paddingHorizontal: 16, paddingTop: 18, marginTop: -18, backgroundColor: '#F2F4F7', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 48, paddingHorizontal: 28, alignItems: 'center', elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, marginTop: 8 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#757575', textAlign: 'center', fontFamily: 'LexendDeca_400Regular', lineHeight: 20 },
});

export default MessagesScreen;
