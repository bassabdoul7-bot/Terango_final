import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as PolylineUtil from '@mapbox/polyline';
import GlassButton from '../components/GlassButton';

import COLORS from '../constants/colors';
import { rideService } from '../services/api.service';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const ActiveRideScreen = ({ route, navigation }) => {
  const { rideId } = route.params;
  
  const mapRef = useRef(null);
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const pollInterval = useRef(null);

  useEffect(() => {
    fetchRideDetails();
    startPolling();

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, []);

  const fetchRideDetails = async () => {
    try {
      const response = await rideService.getRide(rideId);
      setRide(response.ride);
      
      if (response.ride.status === 'accepted' || response.ride.status === 'in_progress') {
        await getDirections(response.ride);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Fetch ride error:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les détails de la course');
      navigation.goBack();
    }
  };

  const startPolling = () => {
    pollInterval.current = setInterval(() => {
      fetchRideDetails();
    }, 5000);
  };

  const getDirections = async (rideData) => {
    try {
      const origin = `${rideData.pickup.coordinates.latitude},${rideData.pickup.coordinates.longitude}`;
      const destination = `${rideData.dropoff.coordinates.latitude},${rideData.dropoff.coordinates.longitude}`;
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_KEY}&mode=driving&language=fr`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes.length > 0) {
        const routeData = data.routes[0];
        const points = PolylineUtil.decode(routeData.overview_polyline.points);
        const coords = points.map(point => ({
          latitude: point[0],
          longitude: point[1],
        }));
        setRouteCoordinates(coords);
        
        if (mapRef.current) {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
            animated: true,
          });
        }
      }
    } catch (error) {
      console.error('Directions error:', error);
    }
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Annuler la course',
      'Êtes-vous sûr de vouloir annuler cette course?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await rideService.cancelRide(rideId, 'Annulé par le passager');
              Alert.alert('Course annulée', 'Votre course a été annulée', [
                { text: 'OK', onPress: () => navigation.navigate('Home') }
              ]);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible d\'annuler la course');
            }
          }
        }
      ]
    );
  };

  if (loading || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const getStatusText = () => {
    switch (ride.status) {
      case 'pending':
        return 'Recherche de chauffeur...';
      case 'accepted':
        return 'Chauffeur en route';
      case 'in_progress':
        return 'Course en cours';
      case 'completed':
        return 'Course terminée';
      case 'cancelled':
        return 'Course annulée';
      default:
        return 'Statut inconnu';
    }
  };

  const getStatusColor = () => {
    switch (ride.status) {
      case 'pending':
        return COLORS.yellow;
      case 'accepted':
      case 'in_progress':
        return COLORS.green;
      case 'completed':
        return COLORS.blue;
      case 'cancelled':
        return COLORS.red;
      default:
        return COLORS.gray;
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: ride.pickup.coordinates.latitude,
          longitude: ride.pickup.coordinates.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Marker
          coordinate={{
            latitude: ride.pickup.coordinates.latitude,
            longitude: ride.pickup.coordinates.longitude,
          }}
          pinColor={COLORS.green}
          title="Départ"
        />

        <Marker
          coordinate={{
            latitude: ride.dropoff.coordinates.latitude,
            longitude: ride.dropoff.coordinates.longitude,
          }}
          pinColor={COLORS.red}
          title="Arrivée"
        />

        {ride.driverId && ride.driverId.currentLocation && (
          <Marker
            coordinate={{
              latitude: ride.driverId.currentLocation.coordinates[1],
              longitude: ride.driverId.currentLocation.coordinates[0],
            }}
            title="Chauffeur"
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerText}>🚗</Text>
            </View>
          </Marker>
        )}

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
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>

      <View style={styles.bottomSheet}>
        {ride.status === 'pending' ? (
          <View style={styles.pendingContainer}>
            <ActivityIndicator size="large" color={COLORS.green} />
            <Text style={styles.pendingTitle}>Recherche de chauffeur...</Text>
            <Text style={styles.pendingSubtitle}>
              Nous recherchons un chauffeur disponible près de vous
            </Text>
          </View>
        ) : ride.driverId ? (
          <View style={styles.driverContainer}>
            <View style={styles.driverCard}>
              <View style={styles.driverInfo}>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {ride.driverId.userId?.name?.charAt(0) || 'D'}
                  </Text>
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>{ride.driverId.userId?.name || 'Chauffeur'}</Text>
                  <Text style={styles.driverPhone}>{ride.driverId.userId?.phone || ''}</Text>
                  <View style={styles.ratingContainer}>
                    <Text style={styles.ratingText}>⭐ {ride.driverId.userId?.rating?.toFixed(1) || '5.0'}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.rideDetailsCard}>
              <View style={styles.addressRow}>
                <View style={styles.greenDot} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {ride.pickup.address}
                </Text>
              </View>
              <View style={styles.addressRow}>
                <View style={styles.redSquare} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {ride.dropoff.address}
                </Text>
              </View>
            </View>

            <View style={styles.fareCard}>
              <View style={styles.fareContainer}>
                <Text style={styles.fareLabel}>Total</Text>
                <Text style={styles.fareAmount}>{ride.fare?.toLocaleString()} FCFA</Text>
              </View>
            </View>
          </View>
        ) : null}

        {ride.status === 'pending' && (
          <View style={styles.actionButtons}>
            <GlassButton
              title="Annuler la course"
              onPress={handleCancelRide}
              variant="outline"
            />
          </View>
        )}

        {ride.status === 'completed' && (
          <View style={styles.actionButtons}>
            <GlassButton
              title="Retour à l'accueil"
              onPress={() => navigation.navigate('Home')}
            />
          </View>
        )}
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
    height: height * 0.5,
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
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  driverMarker: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.green,
  },
  driverMarkerText: {
    fontSize: 20,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  pendingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  pendingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: 16,
    marginBottom: 8,
  },
  pendingSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
  },
  driverContainer: {
    flex: 1,
  },
  driverCard: {
    backgroundColor: 'rgba(0, 133, 63, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 133, 63, 0.3)',
    marginBottom: 12,
  },
  rideDetailsCard: {
    backgroundColor: 'rgba(0, 133, 63, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 133, 63, 0.3)',
    marginBottom: 12,
  },
  fareCard: {
    backgroundColor: 'rgba(0, 133, 63, 0.15)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 133, 63, 0.3)',
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  driverAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  driverPhone: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '600',
  },
  rideDetailsCard: {
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: 14,
    color: COLORS.black,
  },
  fareCard: {
    marginBottom: 16,
  },
  fareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 16,
    color: COLORS.gray,
  },
  fareAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  actionButtons: {
    marginTop: 'auto',
  },
});

export default ActiveRideScreen;

