import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Dimensions } from 'react-native';
import { fleetService } from '../services/api.service';
import COLORS from '../constants/colors';

var screenWidth = Dimensions.get('window').width;

function fmtRate(n) { return (n || 0).toLocaleString('fr-FR') + ' FCFA'; }

export default function FleetListingDetailScreen(props) {
  var navigation = props.navigation; var route = props.route;
  var listingId = route.params.listingId;
  var [listing, setListing] = useState(null);
  var [loading, setLoading] = useState(true);
  var [activePhoto, setActivePhoto] = useState(0);

  useEffect(function() {
    fleetService.getListing(listingId)
      .then(function(res) { if (res && res.success) setListing(res.listing); })
      .catch(function(e) { console.warn('Get listing error:', e && e.message); })
      .finally(function() { setLoading(false); });
  }, [listingId]);

  if (loading) {
    return (<View style={styles.loadingWrap}><ActivityIndicator size="large" color={COLORS.green} /></View>);
  }
  if (!listing) {
    return (
      <View style={styles.loadingWrap}>
        <Text style={styles.notFound}>Annonce non disponible</Text>
        <TouchableOpacity onPress={function() { navigation.goBack(); }} style={styles.backBtnLarge}>
          <Text style={styles.backBtnLargeText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  var photos = listing.photos || [];
  var rentalLabel = listing.rentalType === 'driver' ? 'Réservé aux chauffeurs TeranGO vérifiés' : listing.rentalType === 'private' ? 'Location privée' : 'Chauffeurs TeranGO + privé';

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} bounces={false}>
        {photos.length > 0 ? (
          <View>
            <Image source={{ uri: photos[activePhoto] }} style={styles.heroImage} resizeMode="cover" />
            {photos.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip} contentContainerStyle={{ paddingHorizontal: 12 }}>
                {photos.map(function(p, i) {
                  return (
                    <TouchableOpacity key={i} onPress={function() { setActivePhoto(i); }}>
                      <Image source={{ uri: p }} style={[styles.thumb, i === activePhoto && styles.thumbActive]} />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
          </View>
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Text style={{ fontSize: 64 }}>🚗</Text>
          </View>
        )}

        <TouchableOpacity style={styles.floatingBack} onPress={function() { navigation.goBack(); }}>
          <Text style={styles.floatingBackIcon}>{'‹'}</Text>
        </TouchableOpacity>

        <View style={styles.body}>
          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.rateRow}>
            <Text style={styles.rate}>{fmtRate(listing.dailyRate)}</Text>
            <Text style={styles.rateUnit}> / jour</Text>
          </View>

          <View style={styles.rentalBanner}>
            <Text style={styles.rentalBannerText}>{rentalLabel}</Text>
          </View>

          <View style={styles.specsGrid}>
            {listing.make ? <View style={styles.specBox}><Text style={styles.specLabel}>Marque</Text><Text style={styles.specValue}>{listing.make}</Text></View> : null}
            {listing.model ? <View style={styles.specBox}><Text style={styles.specLabel}>Modèle</Text><Text style={styles.specValue}>{listing.model}</Text></View> : null}
            {listing.year ? <View style={styles.specBox}><Text style={styles.specLabel}>Année</Text><Text style={styles.specValue}>{listing.year}</Text></View> : null}
            {listing.color ? <View style={styles.specBox}><Text style={styles.specLabel}>Couleur</Text><Text style={styles.specValue}>{listing.color}</Text></View> : null}
            <View style={styles.specBox}><Text style={styles.specLabel}>Type</Text><Text style={styles.specValue}>{listing.vehicleType === 'moto' ? 'Moto' : 'Voiture'}</Text></View>
            <View style={styles.specBox}><Text style={styles.specLabel}>Durée</Text><Text style={styles.specValue}>{listing.minRentalDays + '-' + listing.maxRentalDays + ' j'}</Text></View>
            {listing.location && listing.location.neighborhood ? <View style={styles.specBox}><Text style={styles.specLabel}>Quartier</Text><Text style={styles.specValue}>{listing.location.neighborhood}</Text></View> : null}
            {listing.depositRequired ? <View style={styles.specBox}><Text style={styles.specLabel}>Caution</Text><Text style={styles.specValue}>{fmtRate(listing.depositRequired)}</Text></View> : null}
          </View>

          {listing.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.sectionText}>{listing.description}</Text>
            </View>
          ) : null}

          {listing.conditions ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Conditions</Text>
              <Text style={styles.sectionText}>{listing.conditions}</Text>
            </View>
          ) : null}

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {"Après acceptation de votre demande, des frais d'agence de 15 000 FCFA vous seront demandés pour révéler le contact du propriétaire. Le propriétaire paie également sa part (15 000 FCFA). La location elle-même se conclut directement avec lui."}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.applyBtn} onPress={function() { navigation.navigate('FleetApply', { listingId: listing._id, listing: listing }); }}>
          <Text style={styles.applyBtnText}>Postuler</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FFFFFF' },
  notFound: { fontSize: 16, color: '#1A1A1A', fontFamily: 'LexendDeca_700Bold', marginBottom: 16 },
  backBtnLarge: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: COLORS.green },
  backBtnLargeText: { color: '#FFF', fontFamily: 'LexendDeca_700Bold' },
  heroImage: { width: screenWidth, height: screenWidth * 0.75, backgroundColor: '#F4F6F8' },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbStrip: { position: 'absolute', bottom: 12, left: 0, right: 0 },
  thumb: { width: 56, height: 40, borderRadius: 8, marginRight: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  thumbActive: { borderColor: COLORS.green },
  floatingBack: { position: 'absolute', top: 50, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  floatingBackIcon: { fontSize: 28, marginTop: -4, color: '#1A1A1A', fontFamily: 'LexendDeca_700Bold' },
  body: { padding: 20 },
  title: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  rateRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  rate: { fontSize: 24, fontFamily: 'LexendDeca_700Bold', color: COLORS.green },
  rateUnit: { fontSize: 14, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular' },
  rentalBanner: { marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: 'rgba(0,133,63,0.08)', borderWidth: 1, borderColor: 'rgba(0,133,63,0.18)' },
  rentalBannerText: { fontSize: 13, color: COLORS.green, fontFamily: 'LexendDeca_600SemiBold' },
  specsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
  specBox: { width: '47%', backgroundColor: '#F4F6F8', borderRadius: 10, padding: 10, marginRight: '3%', marginBottom: 10 },
  specLabel: { fontSize: 10, color: '#757575', fontFamily: 'LexendDeca_400Regular', letterSpacing: 0.5, textTransform: 'uppercase' },
  specValue: { fontSize: 14, color: '#1A1A1A', fontFamily: 'LexendDeca_600SemiBold', marginTop: 2 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 6 },
  sectionText: { fontSize: 13, color: '#5a5a5a', lineHeight: 19, fontFamily: 'LexendDeca_400Regular' },
  notice: { marginTop: 20, padding: 12, borderRadius: 10, backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  noticeText: { fontSize: 12, color: '#5a5a5a', lineHeight: 18, fontFamily: 'LexendDeca_400Regular' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  applyBtn: { backgroundColor: COLORS.green, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  applyBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'LexendDeca_700Bold' }
});
