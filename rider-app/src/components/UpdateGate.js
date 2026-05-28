import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Linking } from 'react-native';
import Constants from 'expo-constants';
import api from '../services/api.service';

// Force-update gate. Calls /api/app-version/rider on launch; if the local
// versionCode is below the server's min, renders a non-dismissible full-
// screen modal. Single CTA opens the Play Store — no "Later" by design.
export default function UpdateGate() {
  const [required, setRequired] = useState(false);
  const [config, setConfig] = useState(null);

  const localVersionCode =
    (Constants.expoConfig && Constants.expoConfig.android && Constants.expoConfig.android.versionCode) ||
    (Constants.manifest && Constants.manifest.android && Constants.manifest.android.versionCode) ||
    0;

  async function check() {
    try {
      const res = await api.get('/app-version/rider');
      const data = res && res.data;
      if (!data || !data.ok) return;
      if (typeof data.minVersionCode === 'number' && data.minVersionCode > 0 && localVersionCode < data.minVersionCode) {
        setConfig(data);
        setRequired(true);
      }
    } catch (e) {}
  }

  useEffect(() => { check(); }, []);

  async function openStore() {
    if (!config) return;
    try {
      const canMarket = await Linking.canOpenURL(config.marketUrl);
      await Linking.openURL(canMarket ? config.marketUrl : config.playStoreUrl);
    } catch (e) {
      try { await Linking.openURL(config.playStoreUrl); } catch (e2) {}
    }
  }

  if (!required) return null;

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.icon}>{'⬆️'}</Text>
          <Text style={styles.title}>Mise à jour requise</Text>
          <Text style={styles.body}>{(config && config.message) || 'Une nouvelle version de TeranGO est disponible. Mettez à jour pour continuer.'}</Text>
          <TouchableOpacity style={styles.btn} onPress={openStore} activeOpacity={0.85}>
            <Text style={styles.btnText}>Mettre à jour</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#001A12', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#0E2A1F', borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  icon: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF', marginBottom: 10, textAlign: 'center' },
  body: { fontSize: 14, fontFamily: 'LexendDeca_400Regular', color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  btn: { width: '100%', backgroundColor: '#00853F', borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  btnText: { color: '#FFFFFF', fontSize: 17, fontFamily: 'LexendDeca_700Bold' }
});
