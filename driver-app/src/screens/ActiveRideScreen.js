import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
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
  const [ride, setRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const locationSubscription = useRef(null);

  useEffect(() => {
    fetchRideDetails();
    startLocationTracking();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (ride && driverLocation) {
      const destination = ride.status === 'accepted' 
        ? ride.pickup.coordinates 
        : ride.dropoff.coordinates;
      
      getDirections(driverLocation, destination);
    }
  }, [driverLocation, ride?.status]);

  const fetchRideDetails = async () => {
    try {
      if (passedRide) {
        setRide({
          _id: rideId,
          status: 'accepted',
          pickup: passedRide.pickup,
          dropoff: passedRide.dropoff,
          fare: passedRide.fare,
          distance: passedRide.distance
        });
        console.log('===== RIDE DATA =====');
        console.log('Passed ride:', JSON.stringify(passedRide, null, 2));
        console.log('Pickup:', passedRide.pickup);
        console.log('Dropoff:', passedRide.dropoff);
        console.log('====================');
      }
    } catch (error) {
      console.error('Fetch ride error:', error);
    }
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin de votre localisation');
        return;
      }

      // Get initial location
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setDriverLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      // Start watching location (updates every 5 seconds)
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10,
        },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          
          setDriverLocation(newLocation);
          
          // Update backend
          driverService.updateLocation(
            location.coords.latitude,
            location.coords.longitude
          );
        }
      );
    } catch (error) {
      console.error('Location tracking error:', error);
    }
  };

  const getDirections = async (origin, destination) => {
    try {
      const originStr = `${origin.latitude},${origin.longitude}`;
      const destStr = `${destination.latitude},${destination.longitude}`;
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${GOOGLE_MAPS_KEY}&mode=driving&language=fr`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes.length > 0) {
        const routeData = data.routes[0];
        const leg = routeData.legs[0];
        
        // Set distance and duration
        setDistance(leg.distance.text);
        setDuration(leg.duration.text);
        
        // Set route coordinates
        const points = PolylineUtil.decode(routeData.overview_polyline.points);
        const coords = points.map(point => ({
          latitude: point[0],
          longitude: point[1],
        }));
        setRouteCoordinates(coords);
        
        // Fit map to route
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 100, right: 50, bottom: 400, left: 50 },
            animated: true,
          });
        }
      }
    } catch (error) {
      console.error('Directions error:', error);
    }
  };

  const handleArrived = async () => {
    Alert.alert(
      'Arrivé au point de départ',
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
              Alert.alert('Confirmé', 'En attente du passager');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleStartRide = async () => {
    Alert.alert(
      'Démarrer la course',
      'Le passager est-il à bord?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, démarrer',
          onPress: async () => {
            setLoading(true);
            try {
              await driverService.startRide(rideId);
              setRide(prev => ({ ...prev, status: 'in_progress' }));
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de démarrer la course');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCompleteRide = async () => {
    Alert.alert(
      'Terminer la course',
      'Êtes-vous arrivé à destination?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, terminer',
          onPress: async () => {
            setLoading(true);
            try {
              await driverService.completeRide(rideId);
              Alert.alert(
                'Course terminée!',
                'Bravo! Vous avez complété la course.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.navigate('Home')
                  }
                ]
              );
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de terminer la course');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (!driverLocation || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const destination = ride.status === 'accepted' || ride.status === 'arrived'
    ? ride.pickup?.coordinates
    : ride.dropoff?.coordinates;

  const getActionButton = () => {
    switch (ride.status) {
      case 'accepted':
        return (
          <GlassButton
            title="Je suis arrivé"
            onPress={handleArrived}
            loading={loading}
          />
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

  const getStatusText = () => {
    switch (ride.status) {
      case 'accepted':
        return 'En route vers le passager';
      case 'arrived':
        return 'En attente du passager';
      case 'in_progress':
        return 'Course en cours';
      default:
        return '';
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          ...driverLocation,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={false}
      >
        {/* Driver marker */}
        <Marker
          coordinate={driverLocation}
          title="Vous"
        >
          <View style={styles.driverMarker}>
            <Text style={styles.driverMarkerText}>🚗</Text>
          </View>
        </Marker>

        {/* Destination marker */}
        {destination && (
          <Marker
            coordinate={{
              latitude: destination.latitude,
              longitude: destination.longitude,
            }}
            pinColor={ride.status === 'in_progress' ? COLORS.red : COLORS.green}
            title={ride.status === 'in_progress' ? 'Destination' : 'Passager'}
          />
        )}

        {/* Route */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={COLORS.green}
            strokeWidth={4}
          />
        )}
      </MapView>

      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      <View style={styles.statusCard}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
      </View>

      <View style={styles.bottomSheet}>
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <View style={styles.etaItem}>
              <Text style={styles.etaLabel}>Distance</Text>
              <Text style={styles.etaValue}>{distance || '--'}</Text>
            </View>
            <View style={styles.etaDivider} />
            <View style={styles.etaItem}>
              <Text style={styles.etaLabel}>Temps</Text>
              <Text style={styles.etaValue}>{duration || '--'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.rideInfoCard}>
          {ride.status === 'in_progress' ? (
            <>
              <View style={styles.addressRow}>
                <View style={styles.redSquare} />
                <Text style={styles.addressText} numberOfLines={2}>
                  {ride.dropoff?.address || 'Destination'}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.addressRow}>
                <View style={styles.greenDot} />
                <Text style={styles.addressText} numberOfLines={2}>
                  {ride.pickup?.address || 'Point de départ'}
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.actionButtonContainer}>
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
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.gray,
  },
  map: {
    width,
    height: height * 0.6,
  },
  driverMarker: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.green,
  },
  driverMarkerText: {
    fontSize: 20,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
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
  statusCard: {
    position: 'absolute',
    top: 60,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    padding: 20,
  },
  etaCard: {
    backgroundColor: 'rgba(0, 133, 63, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 133, 63, 0.3)',
    marginBottom: 16,
  },
  rideInfoCard: {
    backgroundColor: 'rgba(0, 133, 63, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 133, 63, 0.3)',
    marginBottom: 20,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaItem: {
    flex: 1,
    alignItems: 'center',
  },
  etaLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  etaValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  etaDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.grayLight,
  },
  rideInfoCard: {
    marginBottom: 20,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.green,
    marginRight: 12,
  },
  redSquare: {
    width: 12,
    height: 12,
    backgroundColor: COLORS.red,
    marginRight: 12,
  },
  addressText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.black,
  },
  actionButtonContainer: {
    marginTop: 'auto',
  },
});

export default ActiveRideScreen;



