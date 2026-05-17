import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Alert, Modal, TextInput } from 'react-native';
import { fleetService } from '../services/api.service';
import COLORS from '../constants/colors';

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtDay(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

var STATUS_META = {
  pending: { label: 'En attente', color: '#a87d00', bg: 'rgba(212,175,55,0.12)' },
  accepted: { label: 'Acceptée — en attente de paiement', color: '#0e6b3f', bg: 'rgba(0,133,63,0.10)' },
  paid: { label: 'Payée — contact débloqué', color: '#0e6b3f', bg: 'rgba(0,133,63,0.18)' },
  rejected: { label: 'Refusée', color: '#9a2222', bg: 'rgba(220,38,38,0.10)' },
  expired: { label: 'Expirée', color: '#9a2222', bg: 'rgba(220,38,38,0.06)' },
  cancelled: { label: 'Annulée', color: '#5a5a5a', bg: '#F4F6F8' }
};

function ApplicantCard(props) {
  var a = props.application;
  var user = a.applicantId || {};
  var meta = STATUS_META[a.status] || STATUS_META.pending;
  var initial = (user.name || '?').charAt(0).toUpperCase();
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {user.profilePhoto ? (
          <Image source={{ uri: user.profilePhoto }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{initial}</Text></View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.applicantName}>{user.name || 'Candidat'}</Text>
          <Text style={styles.applicantMeta}>
            {a.applicantType === 'driver' ? '✓ Chauffeur TeranGO vérifié' : 'Location privée'}
            {user.rating ? '  ·  ★ ' + Number(user.rating).toFixed(1) : ''}
          </Text>
          <Text style={styles.applicantSub}>Demande du {fmtDate(a.createdAt)}</Text>
        </View>
      </View>

      <View style={styles.detailsBox}>
        <Text style={styles.detailLine}>Début: <Text style={styles.detailValue}>{fmtDay(a.proposedStartDate)}</Text></Text>
        <Text style={styles.detailLine}>Durée: <Text style={styles.detailValue}>{a.proposedDays} jours</Text></Text>
        {a.message ? <Text style={styles.detailMessage}>"{a.message}"</Text> : null}
      </View>

      {a.applicantType === 'private' && (a.idPhoto || a.licensePhoto || a.selfiePhoto) ? (
        <View style={styles.docsRow}>
          {a.idPhoto ? <TouchableOpacity onPress={function() { props.onPreview(a.idPhoto, 'Pièce d\'identité'); }}><Image source={{ uri: a.idPhoto }} style={styles.docThumb} /></TouchableOpacity> : null}
          {a.licensePhoto ? <TouchableOpacity onPress={function() { props.onPreview(a.licensePhoto, 'Permis de conduire'); }}><Image source={{ uri: a.licensePhoto }} style={styles.docThumb} /></TouchableOpacity> : null}
          {a.selfiePhoto ? <TouchableOpacity onPress={function() { props.onPreview(a.selfiePhoto, 'Selfie'); }}><Image source={{ uri: a.selfiePhoto }} style={styles.docThumb} /></TouchableOpacity> : null}
        </View>
      ) : null}

      <View style={[styles.statusBar, { backgroundColor: meta.bg, borderColor: meta.color }]}>
        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
      </View>

      {a.status === 'pending' ? (
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={function() { props.onAccept(a); }}>
            <Text style={styles.actionBtnText}>Accepter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={function() { props.onReject(a); }}>
            <Text style={[styles.actionBtnText, { color: '#9a2222' }]}>Refuser</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

export default function FleetListingApplicationsScreen(props) {
  var navigation = props.navigation; var route = props.route;
  var listingId = route.params.listingId;
  var listing = route.params.listing;
  var [apps, setApps] = useState([]);
  var [loading, setLoading] = useState(true);
  var [refreshing, setRefreshing] = useState(false);
  var [previewUrl, setPreviewUrl] = useState('');
  var [previewLabel, setPreviewLabel] = useState('');
  var [rejectingId, setRejectingId] = useState('');
  var [rejectReason, setRejectReason] = useState('');

  function load(silent) {
    if (!silent) setLoading(true);
    fleetService.getListingApplications(listingId)
      .then(function(res) { if (res && res.success) setApps(res.applications || []); })
      .catch(function() {})
      .finally(function() { setLoading(false); setRefreshing(false); });
  }
  useEffect(function() { load(false); }, [listingId]);

  function onAccept(a) {
    Alert.alert('Accepter cette demande?', 'Le locataire aura 48h pour payer 15 000 FCFA via Wave. Vous recevrez 15 000 FCFA de votre côté.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Accepter', onPress: function() {
          fleetService.acceptApplication(a._id)
            .then(function() { load(true); })
            .catch(function() { Alert.alert('Erreur', "Impossible d'accepter"); });
        } }
    ]);
  }
  function onReject(a) { setRejectingId(a._id); setRejectReason(''); }
  function confirmReject() {
    if (!rejectingId) return;
    fleetService.rejectApplication(rejectingId, rejectReason || 'Non spécifié')
      .then(function() { setRejectingId(''); setRejectReason(''); load(true); })
      .catch(function() { Alert.alert('Erreur', 'Refus échoué'); });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={function() { navigation.goBack(); }} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Demandes reçues</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{listing && listing.title ? listing.title : ''}</Text>
        </View>
      </View>

      {loading && apps.length === 0 ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={COLORS.green} /></View>
      ) : (
        <FlatList
          data={apps}
          keyExtractor={function(item) { return item._id; }}
          renderItem={function(item) {
            return (
              <ApplicantCard
                application={item.item}
                onAccept={onAccept}
                onReject={onReject}
                onPreview={function(url, label) { setPreviewUrl(url); setPreviewLabel(label); }}
              />
            );
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={function() { setRefreshing(true); load(true); }} tintColor={COLORS.green} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>Aucune demande</Text>
              <Text style={styles.emptySub}>Les candidats s'afficheront ici.</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={function() { setPreviewUrl(''); }}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={function() { setPreviewUrl(''); }}>
          <Text style={styles.previewLabel}>{previewLabel}</Text>
          {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.previewImg} resizeMode="contain" /> : null}
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!rejectingId} transparent animationType="slide" onRequestClose={function() { setRejectingId(''); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Refuser cette demande</Text>
            <Text style={styles.modalSub}>Le motif sera visible par le candidat.</Text>
            <TextInput style={styles.modalInput} value={rejectReason} onChangeText={setRejectReason} placeholder="Motif du refus" placeholderTextColor="#999" multiline />
            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={function() { setRejectingId(''); }}>
                <Text style={styles.modalBtnTextGhost}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnDanger]} onPress={confirmReject}>
                <Text style={styles.modalBtnText}>Refuser</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 12, backgroundColor: '#F4F6F8' },
  avatarFallback: { width: 50, height: 50, borderRadius: 25, marginRight: 12, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#FFF', fontSize: 20, fontFamily: 'LexendDeca_700Bold' },
  applicantName: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  applicantMeta: { fontSize: 12, color: COLORS.green, marginTop: 2, fontFamily: 'LexendDeca_600SemiBold' },
  applicantSub: { fontSize: 11, color: '#757575', marginTop: 2, fontFamily: 'LexendDeca_400Regular' },
  detailsBox: { marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: '#F4F6F8' },
  detailLine: { fontSize: 12, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular', marginBottom: 2 },
  detailValue: { color: '#1A1A1A', fontFamily: 'LexendDeca_600SemiBold' },
  detailMessage: { fontSize: 12, color: '#5a5a5a', fontStyle: 'italic', marginTop: 6, fontFamily: 'LexendDeca_400Regular' },
  docsRow: { flexDirection: 'row', marginTop: 10 },
  docThumb: { width: 60, height: 60, borderRadius: 8, marginRight: 8, backgroundColor: '#F4F6F8' },
  statusBar: { marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold' },
  actionRow: { flexDirection: 'row', marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginHorizontal: 4 },
  acceptBtn: { backgroundColor: COLORS.green },
  rejectBtn: { backgroundColor: 'rgba(220,38,38,0.08)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)' },
  actionBtnText: { fontSize: 14, color: '#FFF', fontFamily: 'LexendDeca_700Bold' },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#757575', textAlign: 'center', paddingHorizontal: 40, fontFamily: 'LexendDeca_400Regular' },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewLabel: { color: '#FFF', fontSize: 14, marginBottom: 12, fontFamily: 'LexendDeca_600SemiBold' },
  previewImg: { width: '100%', height: '80%' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  modalSub: { fontSize: 12, color: '#5a5a5a', marginTop: 4, marginBottom: 14, fontFamily: 'LexendDeca_400Regular' },
  modalInput: { borderWidth: 1, borderColor: '#EEF0F3', borderRadius: 10, padding: 12, minHeight: 70, textAlignVertical: 'top', fontFamily: 'LexendDeca_400Regular' },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginHorizontal: 4 },
  modalBtnGhost: { backgroundColor: '#F4F6F8' },
  modalBtnDanger: { backgroundColor: '#dc2626' },
  modalBtnText: { color: '#FFF', fontFamily: 'LexendDeca_700Bold' },
  modalBtnTextGhost: { color: '#5a5a5a', fontFamily: 'LexendDeca_700Bold' }
});
