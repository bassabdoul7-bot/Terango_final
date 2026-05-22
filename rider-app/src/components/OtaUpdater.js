import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Updates from 'expo-updates';

// Silent updater: checks for OTA on every app foreground, downloads in
// background, then shows a polite reload banner. Skips the check + reload
// when expo-updates is disabled (e.g. running in Expo Go in dev). Never
// auto-reloads — always asks first, because mid-ride reloads would be a
// terrible UX.
export default function OtaUpdater() {
  const [available, setAvailable] = useState(false);
  const [reloading, setReloading] = useState(false);
  const appState = useRef(AppState.currentState);
  const lastCheckAt = useRef(0);
  const CHECK_THROTTLE_MS = 60000; // don't hammer u.expo.dev more than once a minute

  async function checkAndFetch() {
    if (!Updates.isEnabled) return;
    const now = Date.now();
    if (now - lastCheckAt.current < CHECK_THROTTLE_MS) return;
    lastCheckAt.current = now;
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result && result.isAvailable) {
        await Updates.fetchUpdateAsync();
        setAvailable(true);
      }
    } catch (e) {
      // Swallow — never block the app over an update check.
      console.log('OTA check failed:', e && e.message);
    }
  }

  useEffect(() => {
    // Initial check on mount.
    checkAndFetch();
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        checkAndFetch();
      }
      appState.current = next;
    });
    return () => { sub.remove(); };
  }, []);

  async function applyNow() {
    setReloading(true);
    try { await Updates.reloadAsync(); } catch (e) { setReloading(false); }
  }

  if (!available) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.banner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Nouvelle version disponible</Text>
          <Text style={styles.sub}>Redemarrez pour profiter des dernieres ameliorations.</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={applyNow} disabled={reloading} activeOpacity={0.8}>
          {reloading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.btnText}>Redemarrer</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 50, left: 12, right: 12, zIndex: 9999, elevation: 50 },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00853F', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },
  title: { color: '#FFF', fontSize: 14, fontFamily: 'LexendDeca_700Bold' },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2, fontFamily: 'LexendDeca_400Regular' },
  btn: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, marginLeft: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  btnText: { color: '#FFF', fontSize: 12, fontFamily: 'LexendDeca_700Bold' }
});
