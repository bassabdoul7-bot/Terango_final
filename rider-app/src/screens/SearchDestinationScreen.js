import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
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

  useEffect(() => {
    if (currentLocation) {
      getCurrentLocationAddress();
    }
    loadRecentSearches();
  }, []);

  useEffect(() => {
    if (pickup && dropoff && !editingPickup) {
      saveRecentSearch(dropoff);
      navigation.navigate('RideSelection', {
        pickup,
        dropoff,
      });
    }
  }, [pickup, dropoff, editingPickup]);

  const loadRecentSearches = async () => {
    try {
      const saved = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        setRecentSearches(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Load recent searches error:', error);
    }
  };

  const saveRecentSearch = async (location) => {
    try {
      const newSearch = {
        address: location.address,
        coordinates: location.coordinates,
        timestamp: Date.now(),
      };

      let searches = [...recentSearches];
      
      // Remove duplicate if exists
      searches = searches.filter(s => s.address !== newSearch.address);
      
      // Add to beginning
      searches.unshift(newSearch);
      
      // Keep only last 10
      searches = searches.slice(0, 10);
      
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
      setRecentSearches(searches);
    } catch (error) {
      console.error('Save recent search error:', error);
    }
  };

  const getCurrentLocationAddress = async () => {
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });

      if (result && result[0]) {
        const addr = result[0];
        const address = `${addr.street || ''} ${addr.city || ''}, ${addr.region || ''}`.trim();
        
        setPickup({
          address: address || 'Position actuelle',
          coordinates: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
        });
      }
    } catch (error) {
      console.error('Reverse geocode error:', error);
      setPickup({
        address: 'Position actuelle',
        coordinates: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        },
      });
    } finally {
      setLoadingPickup(false);
    }
  };

  const handlePickupSelect = (data, details) => {
    setPickup({
      address: data.description,
      coordinates: {
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
      },
    });
    setEditingPickup(false);
  };

  const handleDropoffSelect = (data, details) => {
    setDropoff({
      address: data.description,
      coordinates: {
        latitude: details.geometry.location.lat,
        longitude: details.geometry.location.lng,
      },
    });
  };

  const handleRecentPress = (recent) => {
    setDropoff({
      address: recent.address,
      coordinates: recent.coordinates,
    });
  };

  if (loadingPickup) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Planifiez votre course</Text>
      </View>

      <View style={styles.inputsCard}>
        <View style={styles.inputRow}>
          <View style={styles.iconContainer}>
            <View style={styles.circleIcon} />
          </View>
          <View style={styles.autocompleteWrapper}>
            {!editingPickup ? (
              <TouchableOpacity 
                onPress={() => setEditingPickup(true)}
                style={styles.addressTouchable}
              >
                <Text style={styles.addressText} numberOfLines={1}>
                  {pickup?.address}
                </Text>
              </TouchableOpacity>
            ) : (
              <GooglePlacesAutocomplete
                placeholder="Point de départ"
                fetchDetails={true}
                onPress={handlePickupSelect}
                query={{
                  key: GOOGLE_MAPS_KEY,
                  language: 'fr',
                  components: 'country:us',
                }}
                styles={{
                  textInput: styles.autocompleteInput,
                  listView: styles.autocompleteList,
                  container: styles.autocompleteContainer,
                }}
                enablePoweredByContainer={false}
                nearbyPlacesAPI="GooglePlacesSearch"
                debounce={300}
                minLength={2}
                autoFocus={true}
                textInputProps={{
                  defaultValue: pickup?.address,
                }}
              />
            )}
          </View>
        </View>

        <View style={styles.dashedLine} />

        <View style={styles.inputRow}>
          <View style={styles.iconContainer}>
            <View style={styles.squareIcon} />
          </View>
          <View style={styles.autocompleteWrapper}>
            <GooglePlacesAutocomplete
              placeholder="Où allez-vous?"
              fetchDetails={true}
              onPress={handleDropoffSelect}
              query={{
                key: GOOGLE_MAPS_KEY,
                language: 'fr',
                components: 'country:us',
              }}
              styles={{
                textInput: styles.autocompleteInput,
                listView: styles.autocompleteList,
                container: styles.autocompleteContainer,
              }}
              enablePoweredByContainer={false}
              nearbyPlacesAPI="GooglePlacesSearch"
              debounce={300}
              minLength={2}
              autoFocus={!editingPickup}
            />
          </View>
        </View>

        {editingPickup && (
          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={() => {
              getCurrentLocationAddress();
              setEditingPickup(false);
            }}
          >
            <View style={styles.currentLocationIconContainer}>
              <Text style={styles.currentLocationIcon}>📍</Text>
            </View>
            <Text style={styles.currentLocationText}>
              Utiliser ma position actuelle
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {recentSearches.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.recentTitle}>Récemment</Text>
          
          {recentSearches.slice(0, 5).map((recent, index) => (
            <TouchableOpacity 
              key={index}
              style={styles.recentItem}
              onPress={() => handleRecentPress(recent)}
            >
              <View style={styles.recentIconContainer}>
                <Text style={styles.recentIcon}>🕐</Text>
              </View>
              <View style={styles.recentTextContainer}>
                <Text style={styles.recentAddress} numberOfLines={1}>
                  {recent.address}
                </Text>
                <Text style={styles.recentSubtext}>
                  {new Date(recent.timestamp).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(179, 229, 206, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  backIcon: {
    fontSize: 24,
    color: '#000',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  inputsCard: {
    margin: 20,
    backgroundColor: 'rgba(179, 229, 206, 0.95)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  circleIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.green,
  },
  squareIcon: {
    width: 14,
    height: 14,
    backgroundColor: COLORS.red,
  },
  dashedLine: {
    height: 30,
    marginLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(0, 0, 0, 0.3)',
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  autocompleteWrapper: {
    flex: 1,
  },
  addressTouchable: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  addressText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  autocompleteContainer: {
    flex: 0,
  },
  autocompleteInput: {
    fontSize: 16,
    color: '#000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  autocompleteList: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  currentLocationIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FCD116',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  currentLocationIcon: {
    fontSize: 18,
  },
  currentLocationText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
  recentSection: {
    marginHorizontal: 20,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  recentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(179, 229, 206, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  recentIcon: {
    fontSize: 20,
  },
  recentTextContainer: {
    flex: 1,
  },
  recentAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  recentSubtext: {
    fontSize: 14,
    color: '#666',
  },
});

export default SearchDestinationScreen;