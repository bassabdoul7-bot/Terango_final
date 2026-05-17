import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { fleetService } from '../services/api.service';
import COLORS from '../constants/colors';

function fmtRate(n) { return (n || 0).toLocaleString('fr-FR') + ' FCFA'; }
function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

var STATUS_META = {
  pending: { label: 'En attente de vérification', color: '#a87d00', bg: 'rgba(212,175,55,0.12)' },
  approved: { label: 'Approuvée — publiée', color: '#0e6b3f', bg: 'rgba(0,133,63,0.12)' },
  rejected: { label: 'Refusée', color: '#9a2222', bg: 'rgba(220,38,38,0.12)' }
};

function ListingCard(props) {
  var l = props.listing;
  var meta = STATUS_META[l.verificationStatus] || STATUS_META.pending;
  var photo = l.photos && l.photos.length > 0 ? l.photos[0] : null;
  var inactive = l.isActive === false;
  return (
    <View style={[styles.card, inactive && { opacity: 0.55 }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={function() { props.onViewApps(l); }}>
        <View style={styles.cardHeader}>
          {photo ? <Image source={{ uri: photo }} style={styles.cardPhoto} /> : <View style={[styles.cardPhoto, styles.cardPhotoPlaceholder]}><Text style={{ fontSize: 22 }}>🚗</Text></View>}
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle} numberOfLines={1}>{l.title}</Text>
            <Text style={styles.cardRate}>{fmtRate(l.dailyRate)} / jour</Text>
            <Text style={styles.cardSub}>{l.applicationCount || 0} demande(s) · Créée {fmtDate(l.createdAt)}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={[styles.statusBar, { backgroundColor: meta.bg, borderColor: meta.color }]}>
        <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
      </View>
      {l.verificationStatus === 'rejected' && l.rejectionReason ? (
        <Text style={styles.rejectionReason}>Motif: {l.rejectionReason}</Text>
      ) : null}

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={function() { props.onViewApps(l); }}>
          <Text style={styles.actionBtnText}>{(l.applicationCount || 0) > 0 ? 'Demandes (' + l.applicationCount + ')' : 'Voir demandes'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnGhost]} onPress={function() { props.onToggleActive(l); }}>
          <Text style={[styles.actionBtnText, { color: COLORS.green }]}>{inactive ? 'Réactiver' : 'Désactiver'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FleetMyListingsScreen(props) {
  var navigation = props.navigation;
  var [listings, setListings] = useState([]);
  var [loading, setLoading] = useState(true);
  var [refreshing, setRefreshing] = useState(false);

  function load(silent) {
    if (!silent) setLoading(true);
    fleetService.getMyListings()
      .then(function(res) { if (res && res.success) setListings(res.listings || []); })
      .catch(function() {})
      .finally(function() { setLoading(false); setRefreshing(false); });
  }
  useEffect(function() { load(false); }, []);
  // Re-fetch when screen regains focus (after creating a new listing or coming back from applications)
  useEffect(function() {
    var sub = navigation.addListener('focus', function() { load(true); });
    return sub;
  }, [navigation]);

  function onToggleActive(l) {
    var next = !(l.isActive === false ? false : true);
    fleetService.updateListing(l._id, { isActive: next })
      .then(function() { load(true); })
      .catch(function() { Alert.alert('Erreur', "Impossible de mettre à jour l'annonce"); });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={function() { navigation.goBack(); }} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mes annonces</Text>
          <Text style={styles.headerSub}>Vos véhicules en location</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={function() { navigation.navigate('FleetCreateListing'); }}>
          <Text style={styles.addBtnText}>+ Nouvelle</Text>
        </TouchableOpacity>
      </View>

      {loading && listings.length === 0 ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={COLORS.green} /></View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={function(item) { return item._id; }}
          renderItem={function(item) {
            return (
              <ListingCard
                listing={item.item}
                onViewApps={function(l) { navigation.navigate('FleetListingApplications', { listingId: l._id, listing: l }); }}
                onToggleActive={onToggleActive}
              />
            );
          }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={function() { setRefreshing(true); load(true); }} tintColor={COLORS.green} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🔑</Text>
              <Text style={styles.emptyTitle}>Aucune annonce</Text>
              <Text style={styles.emptySub}>Mettez votre véhicule en location et générez des revenus.</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={function() { navigation.navigate('FleetCreateListing'); }}>
                <Text style={styles.emptyCtaText}>Créer une annonce</Text>
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
  addBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.green },
  addBtnText: { fontSize: 12, color: '#FFF', fontFamily: 'LexendDeca_700Bold' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 14, padding: 14, borderWidth: 1, borderColor: '#EEF0F3' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardPhoto: { width: 64, height: 64, borderRadius: 10, marginRight: 12, backgroundColor: '#F4F6F8' },
  cardPhotoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  cardRate: { fontSize: 13, color: COLORS.green, marginTop: 2, fontFamily: 'LexendDeca_600SemiBold' },
  cardSub: { fontSize: 11, color: '#757575', marginTop: 4, fontFamily: 'LexendDeca_400Regular' },
  statusBar: { marginTop: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  statusText: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold' },
  rejectionReason: { fontSize: 12, color: '#9a2222', marginTop: 6, fontStyle: 'italic', fontFamily: 'LexendDeca_400Regular' },
  actionRow: { flexDirection: 'row', marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: COLORS.green, marginHorizontal: 4 },
  actionBtnGhost: { backgroundColor: 'rgba(0,133,63,0.08)', borderWidth: 1, borderColor: 'rgba(0,133,63,0.25)' },
  actionBtnText: { fontSize: 13, color: '#FFF', fontFamily: 'LexendDeca_700Bold' },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#757575', textAlign: 'center', paddingHorizontal: 40, marginBottom: 20, fontFamily: 'LexendDeca_400Regular' },
  emptyCta: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.green },
  emptyCtaText: { color: '#FFF', fontSize: 14, fontFamily: 'LexendDeca_700Bold' }
});
