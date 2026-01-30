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
import COLORS from '../constants/colors';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const SearchDestinationScreen = ({ route, navigation }) => {
  const { currentLocation } = route.params;
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [loadingPickup, setLoadingPickup] = useState(true);
  const [editingPickup, setEditingPickup] = useState(false);

  useEffect(() => {
    if (currentLocation) {
      getCurrentLocationAddress();
    }
  }, []);

  useEffect(() => {
    // Navigate when both pickup and dropoff are selected
    if (pickup && dropoff && !editingPickup) {
      navigation.navigate('RideSelection', {
        pickup,
        dropoff,
      });
    }
  }, [pickup, dropoff, editingPickup]);

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

      <View style={styles.inputsContainer}>
        {/* Pickup (editable) */}
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

        <View style={styles.separator} />

        {/* Dropoff (autocomplete) */}
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

        {/* Use Current Location Button */}
        {editingPickup && (
          <TouchableOpacity
            style={styles.currentLocationButton}
            onPress={() => {
              getCurrentLocationAddress();
              setEditingPickup(false);
            }}
          >
            <Text style={styles.currentLocationIcon}>📍</Text>
            <Text style={styles.currentLocationText}>
              Utiliser ma position actuelle
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  backButton: {
    marginRight: 16,
  },
  backIcon: {
    fontSize: 24,
    color: COLORS.black,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  inputsContainer: {
    padding: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  iconContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  circleIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.green,
  },
  squareIcon: {
    width: 12,
    height: 12,
    backgroundColor: COLORS.red,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.grayLight,
    marginLeft: 52,
  },
  autocompleteWrapper: {
    flex: 1,
  },
  addressTouchable: {
    paddingVertical: 12,
  },
  addressText: {
    fontSize: 16,
    color: COLORS.black,
  },
  autocompleteContainer: {
    flex: 0,
  },
  autocompleteInput: {
    fontSize: 16,
    color: COLORS.black,
    paddingVertical: 12,
  },
  autocompleteList: {
    marginTop: 8,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginTop: 16,
  },
  currentLocationIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  currentLocationText: {
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '500',
  },
});

export default SearchDestinationScreen;
