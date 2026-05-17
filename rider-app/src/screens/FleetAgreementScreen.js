import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Linking } from 'react-native';
import { fleetService } from '../services/api.service';
import COLORS from '../constants/colors';

function fmtRate(n) { return (n || 0).toLocaleString('fr-FR') + ' FCFA'; }
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}
function digitsOnly(p) { return String(p || '').replace(/[^0-9+]/g, ''); }

export default function FleetAgreementScreen(props) {
  var navigation = props.navigation; var route = props.route;
  var agreementId = route.params.agreementId;
  var [agreement, setAgreement] = useState(null);
  var [loading, setLoading] = useState(true);

  useEffect(function() {
    fleetService.getAgreement(agreementId)
      .then(function(res) { if (res && res.success) setAgreement(res.agreement); })
      .catch(function() {})
      .finally(function() { setLoading(false); });
  }, [agreementId]);

  if (loading) {
    return (<View style={styles.loadingWrap}><ActivityIndicator size="large" color={COLORS.green} /></View>);
  }
  if (!agreement) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.notFound}>Accord non trouvé</Text>
        <TouchableOpacity onPress={function() { navigation.goBack(); }} style={styles.btn}>
          <Text style={styles.btnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Determine which side is "the other" — when the renter views, they want
  // the owner contact; when the owner views (rare in v1 since owner UX isn't
  // shipped yet but the model already supports it), they want the renter.
  var listing = agreement.listingId || {};
  var owner = agreement.ownerId || {};
  var applicant = agreement.applicantId || {};
  var photo = listing.photos && listing.photos.length > 0 ? listing.photos[0] : null;
  var ownerPhone = agreement.ownerPhone || owner.phone;

  function callOwner() {
    var p = digitsOnly(ownerPhone);
    if (!p) return;
    Linking.openURL('tel:' + p);
  }
  function whatsAppOwner() {
    var p = digitsOnly(ownerPhone);
    if (!p) return;
    var clean = p.replace(/^\+/, '');
    Linking.openURL('https://wa.me/' + clean);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={function() { navigation.goBack(); }} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Contact débloqué</Text>
          <Text style={styles.headerSub}>{"Frais d'agence payés"}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={styles.summary}>
          {photo ? <Image source={{ uri: photo }} style={styles.summaryPhoto} /> : <View style={[styles.summaryPhoto, styles.summaryPhotoPlaceholder]}><Text style={{ fontSize: 30 }}>🚗</Text></View>}
          <Text style={styles.summaryTitle}>{listing.title || ((listing.make || '') + ' ' + (listing.model || ''))}</Text>
          <Text style={styles.summaryRate}>{fmtRate(listing.dailyRate)} / jour · {agreement.agreedDays} jours</Text>
          <Text style={styles.summaryDate}>{"Début prévu: " + fmtDate(agreement.agreedStartDate)}</Text>
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactLabel}>PROPRIÉTAIRE</Text>
          <Text style={styles.contactName}>{owner.name || 'Propriétaire'}</Text>
          <Text style={styles.contactPhone}>{ownerPhone || '—'}</Text>

          <View style={styles.contactRow}>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: COLORS.green }]} onPress={callOwner}>
              <Text style={styles.contactBtnText}>{"📞  Appeler"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#25D366' }]} onPress={whatsAppOwner}>
              <Text style={styles.contactBtnText}>{"💬  WhatsApp"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Prochaines étapes</Text>
          <Text style={styles.noticeText}>
            {"1. Contactez le propriétaire pour fixer le lieu et l'heure de remise des clés.\n2. Préparez la caution éventuelle (en espèces ou Wave, selon ses conditions).\n3. Apportez votre pièce d'identité et votre permis de conduire.\n4. Signez un accord de location simple avec lui — TeranGO n'intervient pas dans le contrat de location lui-même."}
          </Text>
        </View>

        <View style={styles.support}>
          <Text style={styles.supportText}>{"Un problème? Contactez le support TeranGO."}</Text>
          <TouchableOpacity onPress={function() { Linking.openURL('https://wa.me/221784256407'); }}>
            <Text style={styles.supportLink}>{"+221 78 425 6407 (WhatsApp)"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  notFound: { fontSize: 16, color: '#1A1A1A', fontFamily: 'LexendDeca_700Bold', marginBottom: 16 },
  btn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.green },
  btnText: { color: '#FFF', fontFamily: 'LexendDeca_700Bold' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8', marginRight: 12 },
  backIcon: { fontSize: 28, color: '#1A1A1A', marginTop: -4, fontFamily: 'LexendDeca_700Bold' },
  headerTitle: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: COLORS.green, marginTop: 2, fontFamily: 'LexendDeca_400Regular' },
  summary: { alignItems: 'center', padding: 16, borderRadius: 14, backgroundColor: '#F4F6F8', marginBottom: 16 },
  summaryPhoto: { width: 90, height: 90, borderRadius: 14, marginBottom: 12, backgroundColor: '#EEF0F3' },
  summaryPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', textAlign: 'center' },
  summaryRate: { fontSize: 13, color: COLORS.green, marginTop: 4, fontFamily: 'LexendDeca_600SemiBold' },
  summaryDate: { fontSize: 12, color: '#5a5a5a', marginTop: 4, fontFamily: 'LexendDeca_400Regular' },
  contactCard: { padding: 16, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: COLORS.green, marginBottom: 16 },
  contactLabel: { fontSize: 11, color: COLORS.green, letterSpacing: 1.5, fontFamily: 'LexendDeca_700Bold' },
  contactName: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginTop: 6 },
  contactPhone: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginTop: 8, letterSpacing: 1 },
  contactRow: { flexDirection: 'row', marginTop: 14 },
  contactBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 4 },
  contactBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'LexendDeca_700Bold' },
  notice: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  noticeTitle: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 8 },
  noticeText: { fontSize: 12, color: '#5a5a5a', lineHeight: 19, fontFamily: 'LexendDeca_400Regular' },
  support: { marginTop: 20, alignItems: 'center' },
  supportText: { fontSize: 12, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular' },
  supportLink: { fontSize: 13, color: COLORS.green, marginTop: 4, fontFamily: 'LexendDeca_600SemiBold' }
});
