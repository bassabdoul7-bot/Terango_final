import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NominatimAutocomplete from '../components/NominatimAutocomplete';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../constants/colors';
import { geocodeService } from '../services/api.service';

const RECENT_SEARCHES_KEY = '@recent_searches';
const locationCache = {};

const SearchDestinationScreen = ({ route, navigation }) => {
  const { currentLocation } = route.params;
  const [pickup, setPickup] = useState({ address: 'Position actuelle', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } });
  const [dropoff, setDropoff] = useState(null);
  const [editingPickup, setEditingPickup] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => { if (currentLocation) getCurrentLocationAddress(); loadRecentSearches(); }, []);
  useEffect(() => { if (pickup && dropoff && !editingPickup) { saveRecentSearch(dropoff); navigation.navigate('ConfirmDropoff', { pickup, dropoff }); } }, [pickup, dropoff, editingPickup]);

  const loadRecentSearches = async () => { try { const saved = await AsyncStorage.getItem(RECENT_SEARCHES_KEY); if (saved) setRecentSearches(JSON.parse(saved)); } catch (e) {} };
  const saveRecentSearch = async (location) => { try { const ns = { address: location.address, coordinates: location.coordinates, timestamp: Date.now() }; let searches = [...recentSearches].filter(s => s.address !== ns.address); searches.unshift(ns); searches = searches.slice(0, 10); await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches)); setRecentSearches(searches); } catch (e) {} };

  const getCurrentLocationAddress = async () => {
    try {
      const cacheKey = currentLocation.latitude.toFixed(4) + ',' + currentLocation.longitude.toFixed(4);
      if (locationCache[cacheKey]) { setPickup(locationCache[cacheKey]); return; }
      var resp = await geocodeService.reverse(currentLocation.latitude, currentLocation.longitude);
      var address = (resp && resp.result && resp.result.address) || 'Position actuelle';
      var pickupData = { address: address, coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } };
      locationCache[cacheKey] = pickupData;
      setPickup(pickupData);
    } catch (e) {
      setPickup({ address: 'Position actuelle', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } });
    }
  };

  const handlePickupSelect = (data, details) => { setPickup({ address: data.description, coordinates: { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng } }); setEditingPickup(false); };
  const handleDropoffSelect = (data, details) => { setDropoff({ address: data.description, coordinates: { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng }, freeText: !!(details && details.freeText) }); };
  const handleRecentPress = (recent) => { setDropoff({ address: recent.address, coordinates: recent.coordinates }); };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#000000', '#003322', '#00853F']} locations={[0, 0.55, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PLANIFIEZ VOTRE COURSE</Text>
      </LinearGradient>

      {/* Inputs Card */}
      <View style={styles.inputsCard}>
        {/* Pickup */}
        <View style={styles.inputRow}>
          <View style={styles.iconCol}>
            <View style={styles.circleIcon} />
            <View style={styles.dashedLine} />
          </View>
          <View style={styles.inputWrap}>
            {!editingPickup ? (
              <TouchableOpacity onPress={() => setEditingPickup(true)} style={styles.addressTouchable}>
                <Text style={styles.addressLabel}>D{'\u00e9'}part</Text>
                <Text style={styles.addressText} numberOfLines={1}>{pickup?.address}</Text>
              </TouchableOpacity>
            ) : (
              <NominatimAutocomplete
                placeholder={"Point de d\u00e9part"}
                onPress={handlePickupSelect}
                autoFocus={true}
                defaultValue={pickup?.address}
                userLocation={currentLocation}
              />
            )}
          </View>
        </View>

        {/* Dropoff */}
        <View style={styles.inputRow}>
          <View style={styles.iconCol}>
            <View style={styles.squareIcon} />
          </View>
          <View style={styles.inputWrap}>
            <NominatimAutocomplete
              placeholder={"O\u00f9 allez-vous?"}
              onPress={handleDropoffSelect}
              autoFocus={!editingPickup}
              userLocation={currentLocation}
            />
          </View>
        </View>

        {/* Use current location */}
        {editingPickup && (
          <TouchableOpacity style={styles.currentLocBtn} onPress={() => { getCurrentLocationAddress(); setEditingPickup(false); }}>
            <View style={styles.currentLocIcon}><Text style={{ fontSize: 16 }}>{'\uD83D\uDCCD'}</Text></View>
            <Text style={styles.currentLocText}>Utiliser ma position actuelle</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <ScrollView style={styles.recentSection} showsVerticalScrollIndicator={false}>
          <Text style={styles.recentTitle}>R{'\u00e9'}cemment</Text>
          {recentSearches.slice(0, 5).map((recent, index) => (
            <TouchableOpacity key={index} style={styles.recentItem} onPress={() => handleRecentPress(recent)}>
              <View style={styles.recentIconWrap}><Text style={{ fontSize: 18 }}>{'\uD83D\uDD50'}</Text></View>
              <View style={styles.recentTextWrap}>
                <Text style={styles.recentAddress} numberOfLines={1}>{recent.address}</Text>
                <Text style={styles.recentSub}>{new Date(recent.timestamp).toLocaleDateString('fr-FR')}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },

  // Header — gradient applied via LinearGradient component
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF0F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  backIcon: { fontSize: 22, color: '#FFFFFF', fontFamily: 'LexendDeca_700Bold' },
  headerTitle: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF', letterSpacing: 2 },

  // Inputs card — white now
  inputsCard: {
    marginHorizontal: 16,
    marginTop: -10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  iconCol: {
    width: 30,
    alignItems: 'center',
    paddingTop: 14,
    marginRight: 10,
  },
  circleIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.green,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  dashedLine: {
    width: 2,
    height: 32,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    marginTop: 6,
    marginLeft: 0,
    alignSelf: 'center',
  },
  squareIcon: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: COLORS.red,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  inputWrap: { flex: 1, zIndex: 10 },

  // Static pickup display
  addressTouchable: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F8F9FB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEF0F3',
  },
  addressLabel: {
    fontSize: 11,
    color: '#5a5a5a',
    fontFamily: 'LexendDeca_500Medium',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontFamily: 'LexendDeca_500Medium',
  },

  // Current location button
  currentLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F8F9FB',
    borderRadius: 12,
    marginTop: 12,
    marginLeft: 40,
    borderWidth: 1,
    borderColor: '#EEF0F3',
  },
  currentLocIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  currentLocText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontFamily: 'LexendDeca_500Medium',
  },

  // Recent searches - light cards
  recentSection: {
    flex: 1,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  recentTitle: {
    fontSize: 16,
    fontFamily: 'LexendDeca_700Bold',
    color: COLORS.darkBg,
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  recentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,133,63,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recentTextWrap: { flex: 1 },
  recentAddress: {
    fontSize: 15,
    fontFamily: 'LexendDeca_500Medium',
    color: COLORS.textDark,
  },
  recentSub: {
    fontSize: 13,
    color: COLORS.textDarkSub,
    fontFamily: 'LexendDeca_400Regular',
    marginTop: 2,
  },
});

export default SearchDestinationScreen;



