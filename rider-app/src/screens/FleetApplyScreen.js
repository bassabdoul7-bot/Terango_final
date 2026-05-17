import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { fleetService } from '../services/api.service';
import COLORS from '../constants/colors';

function fmtRate(n) { return (n || 0).toLocaleString('fr-FR') + ' FCFA/j'; }
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDateInput(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

// Slot for ID / license / selfie. Tap → ImagePicker → upload → URL stored.
function DocSlot(props) {
  var [uploading, setUploading] = useState(false);
  function pick() {
    ImagePicker.requestMediaLibraryPermissionsAsync().then(function(perm) {
      if (perm.status !== 'granted') {
        Alert.alert('Permission requise', "Autorisez l'accès aux photos pour continuer.");
        return;
      }
      ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85, allowsEditing: false }).then(function(res) {
        if (res.canceled || !res.assets || !res.assets[0]) return;
        var uri = res.assets[0].uri;
        setUploading(true);
        fleetService.uploadPhoto(uri)
          .then(function(r) {
            if (r && r.success && r.url) props.onUploaded(r.url);
            else Alert.alert('Erreur', 'Téléversement échoué');
          })
          .catch(function() { Alert.alert('Erreur', "Impossible de téléverser l'image"); })
          .finally(function() { setUploading(false); });
      });
    });
  }
  return (
    <TouchableOpacity style={styles.docSlot} onPress={pick} activeOpacity={0.8} disabled={uploading}>
      {uploading ? (
        <ActivityIndicator size="small" color={COLORS.green} />
      ) : props.url ? (
        <Image source={{ uri: props.url }} style={styles.docImg} />
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.docIcon}>{props.icon || '📷'}</Text>
          <Text style={styles.docLabel}>{props.label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function FleetApplyScreen(props) {
  var navigation = props.navigation; var route = props.route;
  var listing = route.params.listing;
  var listingId = route.params.listingId;

  // Default start = tomorrow.
  var tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  var [startDate, setStartDate] = useState(fmtDateInput(tomorrow));
  var [days, setDays] = useState(String(listing.minRentalDays || 1));
  var [message, setMessage] = useState('');
  var [idPhoto, setIdPhoto] = useState('');
  var [licensePhoto, setLicensePhoto] = useState('');
  var [selfiePhoto, setSelfiePhoto] = useState('');
  var [submitting, setSubmitting] = useState(false);

  // We don't know in advance if the user is a verified TeranGO driver — the
  // backend auto-detects on apply. We optimistically render the doc upload
  // section; for verified drivers the server ignores them anyway, but private
  // renters need them required. To keep the UX clean we show a note that says
  // "Si vous êtes chauffeur TeranGO, ignorez la section identité." Future
  // improvement: a /api/auth/me-flags endpoint that returns isVerifiedDriver
  // so we can hide the section entirely for drivers.

  function submit() {
    var n = parseInt(days, 10);
    if (isNaN(n) || n < listing.minRentalDays || n > listing.maxRentalDays) {
      Alert.alert('Durée invalide', 'Durée: ' + listing.minRentalDays + '-' + listing.maxRentalDays + ' jours');
      return;
    }
    if (!startDate || isNaN(new Date(startDate).getTime())) {
      Alert.alert('Date invalide', 'Saisissez une date de début valide (YYYY-MM-DD)');
      return;
    }
    setSubmitting(true);
    fleetService.applyToListing(listingId, {
      proposedStartDate: startDate,
      proposedDays: n,
      message: message,
      idPhoto: idPhoto || undefined,
      licensePhoto: licensePhoto || undefined,
      selfiePhoto: selfiePhoto || undefined
    }).then(function(res) {
      if (res && res.success) {
        Alert.alert('Demande envoyée', 'Le propriétaire examinera votre demande. Vous serez notifié dès qu\'elle est acceptée.', [
          { text: 'OK', onPress: function() { navigation.replace('FleetMyApplications'); } }
        ]);
      } else {
        Alert.alert('Erreur', (res && res.message) || 'Demande échouée');
      }
    }).catch(function(err) {
      var msg = (err && err.response && err.response.data && err.response.data.message) || 'Demande échouée';
      Alert.alert('Erreur', msg);
    }).finally(function() { setSubmitting(false); });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={function() { navigation.goBack(); }} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Postuler</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{listing.title}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.summary}>
          <Text style={styles.summaryRate}>{fmtRate(listing.dailyRate)}</Text>
          <Text style={styles.summaryMeta}>{(listing.make || '') + ' ' + (listing.model || '') + ' • ' + (listing.location && listing.location.neighborhood ? listing.location.neighborhood : '—')}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Votre demande</Text>
          <Text style={styles.fieldLabel}>Date de début</Text>
          <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#999" />
          <Text style={styles.fieldLabel}>Durée (en jours)</Text>
          <TextInput style={styles.input} value={days} onChangeText={setDays} keyboardType="numeric" placeholder={String(listing.minRentalDays) + '-' + String(listing.maxRentalDays)} placeholderTextColor="#999" />
          <Text style={styles.fieldHint}>Total estimé: {fmtRate((parseInt(days, 10) || 0) * (listing.dailyRate || 0))}</Text>
          <Text style={styles.fieldLabel}>Message au propriétaire (optionnel)</Text>
          <TextInput style={[styles.input, styles.inputMultiline]} value={message} onChangeText={setMessage} multiline placeholder="Présentez-vous brièvement, expliquez l'usage prévu..." placeholderTextColor="#999" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identité (location privée)</Text>
          <Text style={styles.sectionSub}>
            {"Si vous êtes chauffeur TeranGO vérifié, vous pouvez ignorer cette section — votre identité est déjà confirmée."}
          </Text>
          <View style={styles.docRow}>
            <DocSlot icon="🪪" label="Pièce d'identité" url={idPhoto} onUploaded={setIdPhoto} />
            <DocSlot icon="🚗" label="Permis de conduire" url={licensePhoto} onUploaded={setLicensePhoto} />
            <DocSlot icon="🤳" label="Selfie" url={selfiePhoto} onUploaded={setSelfiePhoto} />
          </View>
        </View>

        <View style={styles.feeBox}>
          <Text style={styles.feeTitle}>{"Frais d'agence (après acceptation)"}</Text>
          <Text style={styles.feeAmount}>15 000 FCFA</Text>
          <Text style={styles.feeNote}>
            {"Vous payez cette somme une seule fois, via Wave, après acceptation par le propriétaire. Vous avez 48h pour payer. Le propriétaire paie également 15 000 FCFA de son côté."}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Envoyer la demande</Text>}
        </TouchableOpacity>
      </View>
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
  summary: { padding: 16, backgroundColor: '#F4F6F8' },
  summaryRate: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.green },
  summaryMeta: { fontSize: 12, color: '#5a5a5a', marginTop: 4, fontFamily: 'LexendDeca_400Regular' },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#5a5a5a', marginBottom: 12, fontFamily: 'LexendDeca_400Regular' },
  fieldLabel: { fontSize: 12, color: '#1A1A1A', marginTop: 14, marginBottom: 6, fontFamily: 'LexendDeca_600SemiBold' },
  fieldHint: { fontSize: 11, color: '#757575', marginTop: 6, fontFamily: 'LexendDeca_400Regular' },
  input: { borderWidth: 1, borderColor: '#EEF0F3', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: 'LexendDeca_400Regular' },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  docSlot: { width: '31%', aspectRatio: 1, borderRadius: 12, borderWidth: 1.5, borderColor: '#EEF0F3', borderStyle: 'dashed', backgroundColor: '#FAFBFC', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  docImg: { width: '100%', height: '100%' },
  docIcon: { fontSize: 28, marginBottom: 4 },
  docLabel: { fontSize: 10, color: '#5a5a5a', textAlign: 'center', paddingHorizontal: 4, fontFamily: 'LexendDeca_400Regular' },
  feeBox: { margin: 16, padding: 14, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  feeTitle: { fontSize: 12, color: '#5a5a5a', fontFamily: 'LexendDeca_600SemiBold' },
  feeAmount: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow, marginTop: 4 },
  feeNote: { fontSize: 11, color: '#5a5a5a', marginTop: 8, lineHeight: 16, fontFamily: 'LexendDeca_400Regular' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  submitBtn: { backgroundColor: COLORS.green, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'LexendDeca_700Bold' }
});
