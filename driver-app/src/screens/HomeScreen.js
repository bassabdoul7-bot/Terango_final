import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = 'http://192.168.1.184:5000';

const HomeScreen = ({ navigation }) => {
  const { driver } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [socket, setSocket] = useState(null);
  const pendingGoOnline = useRef(false);
    const pendingMode = useRef('rides');
    const [selectedMode, setSelectedMode] = useState('rides');

  useEffect(() => {
    initializeLocation();

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  // When location becomes available and user wanted to go online
  useEffect(() => {
    if (location && pendingGoOnline.current) {
      pendingGoOnline.current = false;
      goOnlineWithLocation();
    }
  }, [location]);

  const initializeLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission requise', 
          'Nous avons besoin de votre localisation pour vous mettre en ligne.',
          [{ text: 'Réessayer', onPress: initializeLocation }]
        );
        setGettingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
      });
      
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      console.log('Location obtained:', currentLocation.coords);
    } catch (error) {
      console.error('Location error:', error);
      // Retry with lower accuracy
      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } catch (retryError) {
        console.error('Location retry error:', retryError);
        Alert.alert(
          'GPS non disponible',
          'Impossible d\'obtenir votre position. Vérifiez que le GPS est activé.',
          [{ text: 'Réessayer', onPress: initializeLocation }]
        );
      }
    } finally {
      setGettingLocation(false);
    }
  };

  const goOnlineWithLocation = async () => {
    if (!driver || !driver._id) {
      Alert.alert('Erreur', 'Profil chauffeur introuvable');
      setLoading(false);
      return;
    }

    try {
      // Send location with online status for Redis tracking
      await driverService.toggleOnlineStatus(true, location.latitude, location.longitude);
      setIsOnline(true);

      // Emit driver-online with location to socket for real-time tracking
      if (socket) {
        socket.emit('driver-online', {
          driverId: driver._id,
          latitude: location.latitude,
          longitude: location.longitude,
          vehicle: driver.vehicle,
          rating: driver.userId?.rating || 5.0
        });
        console.log("Driver " + driver._id + " went online at " + location.latitude + ", " + location.longitude);
      }

      // Navigate based on selected mode
        if (pendingMode.current === 'delivery') {
          navigation.replace('DeliveryRequests', { driverId: driver._id });
        } else {
          navigation.replace('RideRequests', { driverId: driver._id });
        }
    } catch (error) {
      console.error('Toggle online error:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de passer en ligne');
    } finally {
      setLoading(false);
    }
  };

  const handleGoOnlineMode = async (mode) => {
      pendingMode.current = mode;
      setSelectedMode(mode);
      await handleGoOnline();
    };

    const handleGoOnline = async () => {
    if (!driver || !driver._id) {
      Alert.alert('Erreur', 'Profil chauffeur introuvable');
      return;
    }

    setLoading(true);

    if (!location) {
      // Location not ready, get it first then go online
      pendingGoOnline.current = true;
      await initializeLocation();
      
      // If still no location after trying, show error
      if (!location && !pendingGoOnline.current) {
        setLoading(false);
      }
      return;
    }

    await goOnlineWithLocation();
  };

  const getButtonText = () => {
    if (loading && !location) return 'Obtention GPS...';
    if (loading) return 'Connexion...';
    if (gettingLocation) return 'Localisation...';
    return 'Passer en ligne';
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {location ? (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={WAZE_DARK_STYLE}
          initialRegion={{
            ...location,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsTraffic={true}
        >
          <Marker coordinate={location}>
            <View style={styles.driverMarker}>
              <Text style={styles.markerText}>▲</Text>
            </View>
          </Marker>
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.loadingText}>Obtention de votre position...</Text>
        </View>
      )}

      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.navigate('Menu')}
        >
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {!isOnline && (
        <View style={styles.offlineContainer}>
          <View style={styles.offlineCard}>
            <View style={styles.iconContainer}>
              <View style={styles.logoImageWrapper}>
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            <Text style={styles.offlineTitle}>Vous êtes hors ligne</Text>
            <Text style={styles.offlineSubtitle}>
              {location ? 'Prêt à accepter des courses?' : 'En attente du GPS...'}
            </Text>

            {/* Location status indicator */}
            <View style={styles.locationStatus}>
              <View style={[styles.statusDot, location ? styles.statusDotGreen : styles.statusDotOrange]} />
              <Text style={styles.statusText}>
                {location ? 'GPS actif' : gettingLocation ? 'Recherche GPS...' : 'GPS non disponible'}
              </Text>
            </View>

              <View style={styles.modeSelector}>
                <TouchableOpacity
                  style={[styles.modeButton, selectedMode === 'rides' && styles.modeButtonActive]}
                  onPress={() => setSelectedMode('rides')}
                >
                  <Text style={styles.modeIcon}>🚗</Text>
                  <Text style={[styles.modeLabel, selectedMode === 'rides' && styles.modeLabelActive]}>Courses</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeButton, selectedMode === 'delivery' && styles.modeButtonActive]}
                  onPress={() => setSelectedMode('delivery')}
                >
                  <Text style={styles.modeIcon}>🏍️</Text>
                  <Text style={[styles.modeLabel, selectedMode === 'delivery' && styles.modeLabelActive]}>Livraisons</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[
                  styles.goOnlineButton,
                  (loading || gettingLocation) && styles.buttonDisabled
                ]}
                onPress={() => handleGoOnlineMode(selectedMode)}
                disabled={loading || gettingLocation}
              >
                {(loading || gettingLocation) && (
                  <ActivityIndicator size="small" color="#000" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.goOnlineText}>{getButtonText()}</Text>
              </TouchableOpacity>

            {!location && !gettingLocation && (
              <TouchableOpacity style={styles.retryButton} onPress={initializeLocation}>
                <Text style={styles.retryText}>🔄 Réessayer GPS</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  driverMarker: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.green,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  markerText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
  },
  topBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  menuButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: COLORS.green,
  },
  menuIcon: {
    fontSize: 28,
    color: '#000',
  },
  offlineContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 60,
  },
  offlineCard: {
    backgroundColor: 'rgba(179, 229, 206, 0.95)',
    borderRadius: 20,
    padding: 32,
    marginHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  iconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  logoImageWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  offlineTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  offlineSubtitle: {
    fontSize: 15,
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusDotGreen: {
    backgroundColor: COLORS.green,
  },
  statusDotOrange: {
    backgroundColor: '#FFA500',
  },
  statusText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  modeSelector: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
      width: '100%',
      paddingHorizontal: 20,
    },
    modeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      borderRadius: 16,
      backgroundColor: 'rgba(179, 229, 206, 0.12)',
      borderWidth: 1.5,
      borderColor: 'rgba(179, 229, 206, 0.25)',
      gap: 8,
    },
    modeButtonActive: {
      backgroundColor: 'rgba(252, 209, 22, 0.15)',
      borderColor: '#FCD116',
    },
    modeIcon: {
      fontSize: 22,
    },
    modeLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.5)',
    },
    modeLabelActive: {
      color: '#FCD116',
      fontWeight: '700',
    },
    goOnlineButton: {
    backgroundColor: '#FCD116',
    paddingHorizontal: 48,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  goOnlineText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  retryButton: {
    marginTop: 12,
    padding: 12,
  },
  retryText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});

export default HomeScreen;


