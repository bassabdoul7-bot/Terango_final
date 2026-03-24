import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import NominatimAutocomplete from '../components/NominatimAutocomplete';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../constants/colors';

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
      var url = 'https://geocode.terango.sn/reverse?lat=' + currentLocation.latitude + '&lon=' + currentLocation.longitude + '&format=json&addressdetails=1&accept-language=fr';
      var resp = await fetch(url);
      var data = await resp.json();
      if (data && data.address) {
        var addr = data.address;
        var name = addr.tourism || addr.amenity || addr.shop || addr.building || addr.road || '';
        var houseNumber = addr.house_number || '';
        var road = addr.road || '';
        var neighbourhood = addr.neighbourhood || addr.suburb || '';
        var city = addr.city || addr.town || '';
        var parts = [];
        if (houseNumber && road) { parts.push(houseNumber + ' ' + road); }
        else if (name) { parts.push(name); }
        else if (road) { parts.push(road); }
        if (neighbourhood && !parts.includes(neighbourhood)) parts.push(neighbourhood);
        if (city && !parts.includes(city)) parts.push(city);
        var address = parts.join(', ') || data.display_name.split(', ').slice(0, 3).join(', ');
        var pickupData = { address: address || 'Position actuelle', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } };
        locationCache[cacheKey] = pickupData;
        setPickup(pickupData);
      } else {
        setPickup({ address: 'Position actuelle', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } });
      }
    } catch (e) {
      setPickup({ address: 'Position actuelle', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } });
    }
  };

  const handlePickupSelect = (data, details) => { setPickup({ address: data.description, coordinates: { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng } }); setEditingPickup(false); };
  const handleDropoffSelect = (data, details) => { setDropoff({ address: data.description, coordinates: { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng } }); };
  const handleRecentPress = (recent) => { setDropoff({ address: recent.address, coordinates: recent.coordinates }); };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planifiez votre course</Text>
      </View>

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
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header - dark green
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: COLORS.darkBg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  backIcon: { fontSize: 22, color: COLORS.white },
  headerTitle: { fontSize: 19, fontFamily: 'LexendDeca_700Bold', color: COLORS.white },

  // Inputs card - dark card
  inputsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.darkBg2,
    borderRadius: 18,
    padding: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  addressLabel: {
    fontSize: 11,
    color: COLORS.textLightSub,
    fontFamily: 'LexendDeca_500Medium',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 15,
    color: COLORS.textLight,
    fontFamily: 'LexendDeca_500Medium',
  },

  // Current location button
  currentLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    marginTop: 12,
    marginLeft: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    color: COLORS.textLight,
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



