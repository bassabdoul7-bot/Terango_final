import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { fleetService } from '../services/api.service';
import COLORS from '../constants/colors';

var TYPE_FILTERS = [
  { value: 'all', label: 'Tout' },
  { value: 'driver', label: 'Chauffeur TeranGO' },
  { value: 'private', label: 'Privé' }
];

function fmtRate(n) { return (n || 0).toLocaleString('fr-FR') + ' FCFA/j'; }

function TypeBadge(props) {
  var rt = props.rentalType;
  var label = rt === 'driver' ? 'Chauffeur TeranGO' : rt === 'private' ? 'Location privée' : 'Les deux';
  var bg = rt === 'driver' ? 'rgba(0,133,63,0.12)' : rt === 'private' ? 'rgba(212,175,55,0.12)' : 'rgba(66,133,244,0.12)';
  var color = rt === 'driver' ? COLORS.green : rt === 'private' ? COLORS.yellow : '#4285F4';
  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[styles.badgeText, { color: color }]}>{label}</Text>
    </View>
  );
}

function ListingCard(props) {
  var l = props.listing;
  var firstPhoto = l.photos && l.photos.length > 0 ? l.photos[0] : null;
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={function() { props.onPress(l); }}>
      {firstPhoto ? (
        <Image source={{ uri: firstPhoto }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Text style={{ fontSize: 36 }}>🚗</Text>
        </View>
      )}
      <View style={styles.cardBody}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={styles.cardTitle} numberOfLines={1}>{l.title || ((l.make || '') + ' ' + (l.model || ''))}</Text>
          <Text style={styles.cardRate}>{fmtRate(l.dailyRate)}</Text>
        </View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardMetaItem}>{l.vehicleType === 'moto' ? '🏍 Moto' : '🚗 Voiture'}</Text>
          {l.location && l.location.neighborhood
            ? <Text style={styles.cardMetaItem}>📍 {l.location.neighborhood}</Text>
            : null}
          <Text style={styles.cardMetaItem}>{l.minRentalDays + '-' + l.maxRentalDays + ' jours'}</Text>
        </View>
        <TypeBadge rentalType={l.rentalType} />
      </View>
    </TouchableOpacity>
  );
}

export default function FleetBrowseScreen(props) {
  var navigation = props.navigation;
  var [type, setType] = useState('all');
  var [listings, setListings] = useState([]);
  var [loading, setLoading] = useState(true);
  var [refreshing, setRefreshing] = useState(false);

  function load(silent) {
    if (!silent) setLoading(true);
    var params = type === 'all' ? {} : { type: type };
    fleetService.browseListings(params)
      .then(function(res) {
        if (res && res.success) setListings(res.listings || []);
      })
      .catch(function(e) { console.warn('Fleet browse error:', e && e.message); })
      .finally(function() { setLoading(false); setRefreshing(false); });
  }

  useEffect(function() { load(false); }, [type]);

  function onRefresh() { setRefreshing(true); load(true); }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={function() { navigation.goBack(); }} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Location de véhicule</Text>
          <Text style={styles.headerSub}>Voitures et motos à louer</Text>
        </View>
        <TouchableOpacity style={styles.myAppsBtn} onPress={function() { navigation.navigate('FleetMyApplications'); }}>
          <Text style={styles.myAppsBtnText}>Mes demandes</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.ownerCta} activeOpacity={0.85} onPress={function() { navigation.navigate('FleetMyListings'); }}>
        <Text style={styles.ownerCtaIcon}>{'🔑'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.ownerCtaTitle}>Vous avez un véhicule à louer?</Text>
          <Text style={styles.ownerCtaSub}>Créez une annonce et gérez vos demandes</Text>
        </View>
        <Text style={styles.ownerCtaArrow}>{'›'}</Text>
      </TouchableOpacity>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {TYPE_FILTERS.map(function(f) {
          var active = type === f.value;
          return (
            <TouchableOpacity key={f.value} onPress={function() { setType(f.value); }} style={[styles.filterPill, active && styles.filterPillActive]}>
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading && listings.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.green} />
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={function(item) { return item._id; }}
          renderItem={function(item) { return <ListingCard listing={item.item} onPress={function(l) { navigation.navigate('FleetListingDetail', { listingId: l._id }); }} />; }}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.green} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🔑</Text>
              <Text style={styles.emptyTitle}>Aucune annonce</Text>
              <Text style={styles.emptySub}>Aucun véhicule n'est disponible pour ce filtre. Revenez plus tard.</Text>
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
  myAppsBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(0,133,63,0.08)', borderWidth: 1, borderColor: 'rgba(0,133,63,0.25)' },
  myAppsBtnText: { fontSize: 12, color: COLORS.green, fontFamily: 'LexendDeca_600SemiBold' },
  ownerCta: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: 'rgba(212,175,55,0.10)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.30)' },
  ownerCtaIcon: { fontSize: 24, marginRight: 12 },
  ownerCtaTitle: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  ownerCtaSub: { fontSize: 12, color: '#5a5a5a', marginTop: 2, fontFamily: 'LexendDeca_400Regular' },
  ownerCtaArrow: { fontSize: 24, color: '#5a5a5a', fontFamily: 'LexendDeca_700Bold' },
  filterRow: { paddingVertical: 12, flexGrow: 0 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: '#F4F6F8', marginRight: 8, borderWidth: 1, borderColor: '#EEF0F3' },
  filterPillActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  filterPillText: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold', color: '#757575' },
  filterPillTextActive: { color: '#FFFFFF' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#EEF0F3', elevation: 1 },
  cardImage: { width: '100%', height: 160, backgroundColor: '#F4F6F8' },
  cardImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 14 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginRight: 8 },
  cardRate: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: COLORS.green },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginBottom: 8 },
  cardMetaItem: { fontSize: 12, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular', marginRight: 12, marginTop: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  badgeText: { fontSize: 11, fontFamily: 'LexendDeca_600SemiBold' },
  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 6 },
  emptySub: { fontSize: 13, color: '#757575', textAlign: 'center', paddingHorizontal: 40, fontFamily: 'LexendDeca_400Regular' }
});
