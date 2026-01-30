import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as PolylineUtil from '@mapbox/polyline';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const ActiveRideScreen = ({ route, navigation }) => {
  const { rideId, ride: passedRide } = route.params;
  
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const hasInitialized = useRef(false);
  
  const [ride, setRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distance, setDistance] = useState('--');
  const [duration, setDuration] = useState('--');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [navigationStarted, setNavigationStarted] = useState(false);

  // Initialize ride data once
  useEffect(() => {
    if (passedRide && !hasInitialized.current) {
      console.log('✅ Initializing ride once');
      setRide({
        _id: rideId,
        status: 'accepted',
        pickup: passedRide.pickup,
        dropoff: passedRide.dropoff,
        fare: passedRide.fare,
        distance: passedRide.distance
      });
      hasInitialized.current = true;
    }
  }, []);

  // Start location tracking once
  useEffect(() => {
    let mounted = true;

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'Localisation requise');
          return;
        }

        // Get initial location
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        if (mounted) {
          const newLoc = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          };
          console.log('📍 Initial location:', newLoc);
          setDriverLocation(newLoc);
          setInitializing(false);
        }

        // Watch location
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            if (mounted) {
              const newLoc = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              };
              console.log('📍 Location update:', newLoc);
              setDriverLocation(newLoc);
              
              // Update backend
              driverService.updateLocation(
                location.coords.latitude,
                location.coords.longitude
              ).catch(err => console.log('Backend update failed:', err));
            }
          }
        );
      } catch (error) {
        console.error('Location error:', error);
        setInitializing(false);
      }
    };

    startTracking();

    return () => {
      mounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  // Get directions when location or status changes
  useEffect(() => {
    if (!ride || !driverLocation) return;

    const destination = ride.status === 'accepted' || ride.status === 'arrived'
      ? ride.pickup.coordinates 
      : ride.dropoff.coordinates;

    if (!destination) return;

    const fetchDirections = async () => {
      console.log('🗺️ FETCHING DIRECTIONS');
      console.log('From:', driverLocation);
      console.log('To:', destination);
      try {
        const originStr = `${driverLocation.latitude},${driverLocation.longitude}`;
        const destStr = `${destination.latitude},${destination.longitude}`;
        
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${GOOGLE_MAPS_KEY}&mode=driving&language=fr`;
        
        console.log('🗺️ Fetching directions...');
        const response = await fetch(url);
        const data = await response.json();
        console.log('API Response status:', data.status);
        if (data.status !== 'OK') {
          console.error('API Error:', data.error_message || data.status);
        }
        
        if (data.status === 'OK' && data.routes.length > 0) {
          const routeData = data.routes[0];
          const leg = routeData.legs[0];
          
          console.log('✅ Route loaded:', leg.distance.text, leg.duration.text);
          
          setDistance(leg.distance.text);
          setDuration(leg.duration.text);
          
          const points = PolylineUtil.decode(routeData.overview_polyline.points);
          const coords = points.map(point => ({
            latitude: point[0],
            longitude: point[1],
          }));
          console.log('✅ ROUTE SET! Points:', coords.length);
          setRouteCoordinates(coords);
          
          // Fit map to route
          if (mapRef.current) {
            setTimeout(() => {
              mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 150, right: 50, bottom: 400, left: 50 },
                animated: true,
              });
            }, 500);
          }
        }
      } catch (error) {
        console.error('Directions error:', error);
      }
    };

    fetchDirections();
  }, [driverLocation, ride?.status]);

  const handleStartNavigation = useCallback(() => {
    setNavigationStarted(true);
    Alert.alert('Navigation démarrée', 'Suivez la route bleue');
    
    if (mapRef.current && driverLocation) {
      mapRef.current.animateCamera({
        center: driverLocation,
        zoom: 16,
      }, { duration: 1000 });
    }
  }, [driverLocation]);

  const handleArrived = useCallback(async () => {
    Alert.alert(
      'Arrivé',
      'Confirmez que vous êtes arrivé',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setLoading(true);
            try {
              await driverService.updateRideStatus(rideId, 'arrived');
              setRide(prev => ({ ...prev, status: 'arrived' }));
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.message || 'Erreur');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [rideId]);

  const handleStartRide = useCallback(async () => {
    Alert.alert(
      'Démarrer la course',
      'Le passager est à bord?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          onPress: async () => {
            setLoading(true);
            try {
              await driverService.startRide(rideId);
              setRide(prev => ({ ...prev, status: 'in_progress' }));
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de démarrer');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [rideId]);

  const handleCompleteRide = useCallback(async () => {
    Alert.alert(
      'Terminer',
      'Vous êtes à destination?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          onPress: async () => {
            setLoading(true);
            try {
              await driverService.completeRide(rideId);
              Alert.alert(
                '🎉 Terminé!',
                `Gains: ${ride.fare?.toLocaleString()} FCFA`,
                [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
              );
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de terminer');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [rideId, ride, navigation]);

  if (initializing || !driverLocation || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const destination = ride.status === 'accepted' || ride.status === 'arrived'
    ? ride.pickup?.coordinates
    : ride.dropoff?.coordinates;

  const getStatusText = () => {
    switch (ride.status) {
      case 'accepted': return 'En route vers le passager';
      case 'arrived': return 'En attente du passager';
      case 'in_progress': return 'Course en cours';
      default: return '';
    }
  };

  const getActionButton = () => {
    switch (ride.status) {
      case 'accepted':
        return (
          <>
            {!navigationStarted && (
            <TouchableOpacity 
              style={styles.navButton}
              onPress={handleStartNavigation}
            >
              <Text style={styles.navIcon}>🧭</Text>
              <Text style={styles.navText}>Commencer la navigation</Text>
            </TouchableOpacity>
            )}
            <GlassButton
              title="Je suis arrivé"
              onPress={handleArrived}
              loading={loading}
              style={styles.actionButton}
            />
          </>
        );
      case 'arrived':
        return (
          <GlassButton
            title="Démarrer la course"
            onPress={handleStartRide}
            loading={loading}
          />
        );
      case 'in_progress':
        return (
          <GlassButton
            title="Terminer la course"
            onPress={handleCompleteRide}
            loading={loading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          ...driverLocation,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={false}
      >
        {/* Driver */}
        <Marker
          coordinate={driverLocation}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.driverMarker}>
            <Text style={styles.driverText}>▲</Text>
          </View>
        </Marker>

        {/* Destination */}
        {destination && (
          <Marker
            coordinate={destination}
            pinColor={ride.status === 'in_progress' ? COLORS.red : COLORS.green}
          />
        )}

        {/* Route */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={COLORS.green}
            strokeWidth={5}
          />
        )}
      </MapView>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <View style={styles.etaItem}>
              <Text style={styles.etaValue}>{duration}</Text>
              <Text style={styles.etaLabel}>Temps</Text>
            </View>
            <View style={styles.etaDivider} />
            <View style={styles.etaItem}>
              <Text style={styles.etaValue}>{distance}</Text>
              <Text style={styles.etaLabel}>Distance</Text>
            </View>
          </View>
        </View>

        <View style={styles.addressCard}>
          <View style={styles.addressRow}>
            <View style={ride.status === 'in_progress' ? styles.redSquare : styles.greenDot} />
            <View style={styles.addressTextContainer}>
              <Text style={styles.addressLabel}>
                {ride.status === 'in_progress' ? 'Destination' : 'Point de départ'}
              </Text>
              <Text style={styles.addressText} numberOfLines={2}>
                {ride.status === 'in_progress' 
                  ? ride.dropoff?.address 
                  : ride.pickup?.address}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionContainer}>
          {getActionButton()}
        </View>
      </View>
    </View>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.gray,
  },
  map: {
    width,
    height: height * 0.65,
  },
  driverMarker: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.green,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  driverText: {
    fontSize: 16,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  backIcon: {
    fontSize: 24,
    color: COLORS.black,
  },
  statusBadge: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  etaCard: {
    backgroundColor: 'rgba(0, 133, 63, 0.1)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaItem: {
    flex: 1,
    alignItems: 'center',
  },
  etaValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.green,
    marginBottom: 4,
  },
  etaLabel: {
    fontSize: 12,
    color: COLORS.gray,
    textTransform: 'uppercase',
  },
  etaDivider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.grayLight,
  },
  addressCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.green,
    marginRight: 12,
  },
  redSquare: {
    width: 14,
    height: 14,
    backgroundColor: COLORS.red,
    marginRight: 12,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '500',
  },
  actionContainer: {
    marginTop: 12,
  },
  navButton: {
    backgroundColor: COLORS.green,
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  navIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  navText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  actionButton: {
    marginTop: 8,
  },
});

export default ActiveRideScreen;



