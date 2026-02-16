import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../constants/colors';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const RECENT_SEARCHES_KEY = '@recent_searches';

const SearchDestinationScreen = ({ route, navigation }) => {
  const { currentLocation } = route.params;
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [loadingPickup, setLoadingPickup] = useState(true);
  const [editingPickup, setEditingPickup] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => { if (currentLocation) getCurrentLocationAddress(); loadRecentSearches(); }, []);
  useEffect(() => { if (pickup && dropoff && !editingPickup) { saveRecentSearch(dropoff); navigation.navigate('RideSelection', { pickup, dropoff }); } }, [pickup, dropoff, editingPickup]);

  const loadRecentSearches = async () => { try { const saved = await AsyncStorage.getItem(RECENT_SEARCHES_KEY); if (saved) setRecentSearches(JSON.parse(saved)); } catch (e) {} };
  const saveRecentSearch = async (location) => { try { const ns = { address: location.address, coordinates: location.coordinates, timestamp: Date.now() }; let searches = [...recentSearches].filter(s => s.address !== ns.address); searches.unshift(ns); searches = searches.slice(0, 10); await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches)); setRecentSearches(searches); } catch (e) {} };

  const getCurrentLocationAddress = async () => {
    try { const result = await Location.reverseGeocodeAsync({ latitude: currentLocation.latitude, longitude: currentLocation.longitude }); if (result && result[0]) { const addr = result[0]; const address = `${addr.street || ''} ${addr.city || ''}, ${addr.region || ''}`.trim(); setPickup({ address: address || 'Position actuelle', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } }); } } catch (e) { setPickup({ address: 'Position actuelle', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } }); } finally { setLoadingPickup(false); }
  };

  const handlePickupSelect = (data, details) => { setPickup({ address: data.description, coordinates: { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng } }); setEditingPickup(false); };
  const handleDropoffSelect = (data, details) => { setDropoff({ address: data.description, coordinates: { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng } }); };
  const handleRecentPress = (recent) => { setDropoff({ address: recent.address, coordinates: recent.coordinates }); };

  if (loadingPickup) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.green} /></View>);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backIcon}>{"\u2190"}</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Planifiez votre course</Text>
      </View>
      <View style={styles.inputsCard}>
        <View style={styles.inputRow}>
          <View style={styles.iconContainer}><View style={styles.circleIcon} /></View>
          <View style={styles.autocompleteWrapper}>
            {!editingPickup ? (
              <TouchableOpacity onPress={() => setEditingPickup(true)} style={styles.addressTouchable}><Text style={styles.addressText} numberOfLines={1}>{pickup?.address}</Text></TouchableOpacity>
            ) : (
              <GooglePlacesAutocomplete placeholder="Point de d\u00e9part" fetchDetails={true} onPress={handlePickupSelect} query={{ key: GOOGLE_MAPS_KEY, language: 'fr', components: 'country:us' }} styles={{ textInput: styles.autocompleteInput, listView: styles.autocompleteList, container: styles.autocompleteContainer }} enablePoweredByContainer={false} nearbyPlacesAPI="GooglePlacesSearch" debounce={300} minLength={2} autoFocus={true} textInputProps={{ defaultValue: pickup?.address }} />
            )}
          </View>
        </View>
        <View style={styles.dashedLine} />
        <View style={styles.inputRow}>
          <View style={styles.iconContainer}><View style={styles.squareIcon} /></View>
          <View style={styles.autocompleteWrapper}>
            <GooglePlacesAutocomplete placeholder="O\u00f9 allez-vous?" fetchDetails={true} onPress={handleDropoffSelect} query={{ key: GOOGLE_MAPS_KEY, language: 'fr', components: 'country:us' }} styles={{ textInput: styles.autocompleteInput, listView: styles.autocompleteList, container: styles.autocompleteContainer }} enablePoweredByContainer={false} nearbyPlacesAPI="GooglePlacesSearch" debounce={300} minLength={2} autoFocus={!editingPickup} />
          </View>
        </View>
        {editingPickup && (
          <TouchableOpacity style={styles.currentLocationButton} onPress={() => { getCurrentLocationAddress(); setEditingPickup(false); }}>
            <View style={styles.currentLocationIconContainer}><Text style={styles.currentLocationIcon}>{"\uD83D\uDCCD"}</Text></View>
            <Text style={styles.currentLocationText}>Utiliser ma position actuelle</Text>
          </TouchableOpacity>
        )}
      </View>
      {recentSearches.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>{"R\u00e9cemment"}</Text>
          {recentSearches.slice(0, 5).map((recent, index) => (
            <TouchableOpacity key={index} style={styles.recentItem} onPress={() => handleRecentPress(recent)}>
              <View style={styles.recentIconContainer}><Text style={styles.recentIcon}>{"\uD83D\uDD50"}</Text></View>
              <View style={styles.recentTextContainer}><Text style={styles.recentAddress} numberOfLines={1}>{recent.address}</Text><Text style={styles.recentSubtext}>{new Date(recent.timestamp).toLocaleDateString('fr-FR')}</Text></View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: COLORS.darkCard, borderBottomWidth: 1, borderBottomColor: COLORS.darkCardBorder },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backIcon: { fontSize: 24, color: COLORS.green, fontWeight: 'bold' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textLight },
  inputsCard: { margin: 20, backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 20, elevation: 12, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  iconContainer: { width: 40, alignItems: 'center', marginRight: 12 },
  circleIcon: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.green },
  squareIcon: { width: 14, height: 14, backgroundColor: COLORS.red },
  dashedLine: { height: 30, marginLeft: 20, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.15)', borderStyle: 'dashed', marginVertical: 4 },
  autocompleteWrapper: { flex: 1 },
  addressTouchable: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  addressText: { fontSize: 16, color: COLORS.textLight, fontWeight: '500' },
  autocompleteContainer: { flex: 0 },
  autocompleteInput: { fontSize: 16, color: COLORS.textLight, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  autocompleteList: { marginTop: 8, backgroundColor: COLORS.darkCard, borderRadius: 12, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  currentLocationButton: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  currentLocationIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  currentLocationIcon: { fontSize: 18 },
  currentLocationText: { fontSize: 16, color: COLORS.textLight, fontWeight: '600' },
  recentSection: { marginHorizontal: 20 },
  recentTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textDark, marginBottom: 12 },
  recentItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 12, elevation: 4, borderWidth: 1, borderColor: COLORS.grayLight },
  recentIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,133,63,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  recentIcon: { fontSize: 20 },
  recentTextContainer: { flex: 1 },
  recentAddress: { fontSize: 16, fontWeight: '600', color: COLORS.textDark, marginBottom: 4 },
  recentSubtext: { fontSize: 14, color: COLORS.textDarkMuted },
});

export default SearchDestinationScreen;
