import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { fleetService } from '../services/api.service';
import COLORS from '../constants/colors';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtRate(n) { return (n || 0).toLocaleString('fr-FR') + ' FCFA'; }

var STATUS_META = {
  pending: { label: 'En attente', color: '#5a5a5a', bg: '#F4F6F8' },
  accepted: { label: 'Acceptée — payer maintenant', color: '#0e6b3f', bg: 'rgba(0,133,63,0.12)' },
  paid: { label: 'Payée — contact débloqué', color: '#0e6b3f', bg: 'rgba(0,133,63,0.18)' },
  rejected: { label: 'Refusée', color: '#9a2222', bg: 'rgba(220,38,38,0.12)' },
  expired: { label: 'Expirée (délai dépassé)', color: '#9a2222', bg: 'rgba(220,38,38,0.08)' },
  cancelled: { label: 'Annulée', color: '#5a5a5a', bg: '#F4F6F8' }
};

function CountdownBadge(props) {
  var [now, setNow] = useState(Date.now());
  useEffect(function() { var t = setInterval(function() { setNow(Date.now()); }, 60000); return function() { clearInterval(t); }; }, []);
  if (!props.expiresAt) return null;
  var ms = new Date(props.expiresAt).getTime() - now;
  if (ms <= 0) return <Text style={styles.expired}>Délai dépassé</Text>;
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  return <Text style={styles.countdown}>{h + 'h ' + m + 'm restant pour payer'}</Text>;
}

function AppCard(props) {
  var a = props.application;
  var l = a.listingId || {};
  var meta = STATUS_META[a.status] || STATUS_META.pending;
  var photo = l.photos && l.photos.length > 0 ? l.photos[0] : null;

  function onPay() {
    Alert.alert(
      'Payer 15 000 FCFA via Wave',
      "Envoyez 15 000 FCFA à TeranGO via Wave, puis confirmez ici. Le numéro Wave officiel s'affichera après confirmation.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'J\'ai envoyé', onPress: function() { props.onConfirmPay(a); } },
        { text: 'Ouvrir Wave', onPress: function() { Linking.openURL('https://wave.com'); } }
      ]
    );
  }

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={function() { props.onPress(a); }}>
      <View style={styles.cardHeader}>
        {photo ? <Image source={{ uri: photo }} style={styles.cardPhoto} /> : <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}><Text style={{ fontSize: 22 }}>🚗</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{l.title || ((l.make || '') + ' ' + (l.model || ''))}</Text>
          <Text style={styles.cardRate}>{fmtRate(l.dailyRate)} · {a.proposedDays} jours</Text>
          <Text style={styles.cardSub}>Demande envoyée: {fmtDate(a.createdAt)}</Text>
        </View>
      </View>
      <View style={[styles.statusBar, { backgroundColor: meta.bg, borderColor: meta.color }]}>
        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
      </View>
      {a.status === 'accepted' ? (
        <View>
          <CountdownBadge expiresAt={a.expiresAt} />
          <TouchableOpacity style={styles.payBtn} onPress={onPay}>
            <Text style={styles.payBtnText}>Payer maintenant</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {a.status === 'rejected' && a.rejectionReason ? (
        <Text style={styles.rejectionReason}>Raison: {a.rejectionReason}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function FleetMyApplicationsScreen(props) {
  var navigation = props.navigation;
  var [apps, setApps] = useState([]);
  var [loading, setLoading] = useState(true);
  var [refreshing, setRefreshing] = useState(false);

  function load(silent) {
    if (!silent) setLoading(true);
    fleetService.getMyApplications()
      .then(function(res) { if (res && res.success) setApps(res.applications || []); })
      .catch(function() {})
      .finally(function() { setLoading(false); setRefreshing(false); });
  }
  useEffect(function() { load(false); }, []);

  function onConfirmPay(a) {
    // For v1 the renter sends the Wave transfer manually outside the app.
    // They tap "J'ai envoyé" and we mark the closing fee as paid with their
    // self-reported reference (admin can audit later via the Wave dashboard).
    Alert.prompt
      ? Alert.prompt('Référence Wave', 'Entrez la référence/numéro de transaction Wave', function(ref) {
          finalizePay(a, ref || '');
        })
      : finalizePay(a, '');
  }

  function finalizePay(a, ref) {
    fleetService.payClosingFee(a._id, ref)
      .then(function(res) {
        if (res && res.success) {
          Alert.alert('Paiement enregistré', "Le contact du propriétaire est maintenant débloqué.", [
            { text: 'Voir le contact', onPress: function() { navigation.navigate('FleetAgreement', { agreementId: res.agreement._id }); } }
          ]);
          load(true);
        } else {
          Alert.alert('Erreur', (res && res.message) || 'Paiement échoué');
        }
      })
      .catch(function(err) {
        var msg = (err && err.response && err.response.data && err.response.data.message) || 'Paiement échoué';
        Alert.alert('Erreur', msg);
      });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={function() { navigation.goBack(); }} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mes demandes</Text>
          <Text style={styles.headerSub}>Suivi de vos candidatures</Text>
        </View>
      </View>

      {loading && apps.length === 0 ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={COLORS.green} /></View>
      ) : (
        <FlatList
          data={apps}
          keyExtractor={function(item) { return item._id; }}
          renderItem={function(item) { return <AppCard application={item.item} onPress={function() {}} onConfirmPay={onConfirmPay} />; }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={function() { setRefreshing(true); load(true); }} tintColor={COLORS.green} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Aucune demande</Text>
              <Text style={styles.emptySub}>Postulez à une annonce pour la voir apparaître ici.</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={function() { navigation.navigate('FleetBrowse'); }}>
                <Text style={styles.emptyCtaText}>Parcourir les annonces</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8', marginRight: 12 },
  backIcon: { fontSize: 28, color: '#1A1A1A', marginTop: -4, fontFamily: 'LexendDeca_700Bold' },
  headerTitle: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: '#757575', marginTop: 2, fontFamily: 'LexendDeca_400Regular' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 14, padding: 14, borderWidth: 1, borderColor: '#EEF0F3' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardPhoto: { width: 60, height: 60, borderRadius: 10, marginRight: 12, backgroundColor: '#F4F6F8' },
  cardPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  cardRate: { fontSize: 13, color: COLORS.green, marginTop: 2, fontFamily: 'LexendDeca_600SemiBold' },
  cardSub: { fontSize: 11, color: '#757575', marginTop: 4, fontFamily: 'LexendDeca_400Regular' },
  statusBar: { marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold' },
  countdown: { fontSize: 11, color: '#a87d00', marginTop: 8, fontFamily: 'LexendDeca_500Medium' },
  expired: { fontSize: 11, color: '#9a2222', marginTop: 8, fontFamily: 'LexendDeca_500Medium' },
  payBtn: { marginTop: 10, backgroundColor: COLORS.green, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  payBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'LexendDeca_700Bold' },
  rejectionReason: { fontSize: 12, color: '#9a2222', marginTop: 8, fontStyle: 'italic', fontFamily: 'LexendDeca_400Regular' },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#757575', textAlign: 'center', paddingHorizontal: 40, marginBottom: 20, fontFamily: 'LexendDeca_400Regular' },
  emptyCta: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.green },
  emptyCtaText: { color: '#FFF', fontSize: 14, fontFamily: 'LexendDeca_700Bold' }
});
