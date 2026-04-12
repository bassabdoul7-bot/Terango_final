import React from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import COLORS from '../constants/colors';

var MessagesScreen = function() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}><Text style={styles.headerTxt}>Messages</Text></View>
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>{'\uD83D\uDCAC'}</Text>
        <Text style={styles.emptyTitle}>Aucun message</Text>
        <Text style={styles.emptySub}>Vos conversations avec les passagers apparaitront ici</Text>
      </View>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: COLORS.darkBg },
  headerTxt: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textDark, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.textDarkSub, textAlign: 'center', fontFamily: 'LexendDeca_400Regular' },
});

export default MessagesScreen;
