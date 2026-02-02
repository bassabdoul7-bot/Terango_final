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
import io from 'socket.io-client';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';
import { rideService } from '../services/api.service';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const SOCKET_URL = 'http://192.168.1.184:5000';

const ActiveRideScreen = ({ route, navigation }) => {
  const { rideId } = route.params;

  const mapRef = useRef(null);
  const socketRef = useRef(null);
  
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  
  const pollInterval = useRef(null);

  useEffect(() => {
    fetchRideDetails();
    startPolling();

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Connect to Socket.IO when ride is accepted
  useEffect(() => {
    if (ride && ride.driver && (ride.status === 'accepted' || ride.status === 'in_progress')) {
      connectToSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('driver-location-update');
      }
    };
  }, [ride]);

  const connectToSocket = () => {
    if (socketRef.current) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected for rider');
      // Join room to receive driver updates
      socketRef.current.emit('join-ride-room', rideId);
    });

    socketRef.current.on('driver-location-update', (data) => {
      console.log('Driver location update:', data);
      if (data.driverId === ride.driver._id) {
        setDriverLocation(data.location);
        
        // Calculate ETA and distance if rider hasn't been picked up yet
        if (ride.status === 'accepted') {
          calculateETA(data.location, ride.pickup.coordinates);
        }
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  };

  const calculateETA = (driverLoc, pickupLoc) => {
    const R = 6371e3; // Earth radius in meters
    const phi1 = driverLoc.latitude * Math.PI / 180;
    const phi2 = pickupLoc.latitude * Math.PI / 180;
    const deltaPhi = (pickupLoc.latitude - driverLoc.latitude) * Math.PI / 180;
    const deltaLambda = (pickupLoc.longitude - driverLoc.longitude) * Math.PI / 180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distanceInMeters = R * c;
    setDistance(formatDistance(distanceInMeters));

    // Rough ETA calculation (assuming average speed of 30 km/h in city)
    const etaMinutes = Math.round((distanceInMeters / 1000) * 2); // 2 min per km
    setEta(etaMinutes);
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

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
      Alert.alert('Erreur', 'Impossible de recuperer les details de la course');
      navigation.goBack();
    }
  };

  const startPolling = () => {
    pollInterval.current = setInterval(() => {
      fetchRideDetails();
    }, 10000); // Poll every 10 seconds for ride status updates
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
      'Etes-vous sur de vouloir annuler cette course?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await rideService.cancelRide(rideId);
              Alert.alert('Course annulee', 'Votre course a ete annulee');
              navigation.navigate('Home');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible d\'annuler la course');
            }
          }
        }
      ]
    );
  };

  const getStatusMessage = () => {
    if (!ride) return '';
    
    switch (ride.status) {
      case 'pending':
        return 'Recherche d\'un chauffeur...';
      case 'accepted':
        if (eta) {
          return `Le chauffeur arrive dans ${eta} min (${distance})`;
        }
        return 'Le chauffeur est en route';
      case 'arrived':
        return 'Le chauffeur est arrive';
      case 'in_progress':
        return 'Course en cours';
      case 'completed':
        return 'Course terminee';
      default:
        return '';
    }
  };

  if (loading || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

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
        {/* Pickup marker */}
        <Marker
          coordinate={ride.pickup.coordinates}
          pinColor={COLORS.green}
          title="Point de depart"
        />

        {/* Dropoff marker */}
        <Marker
          coordinate={ride.dropoff.coordinates}
          pinColor={COLORS.red}
          title="Destination"
        />

        {/* Driver marker - real-time position */}
        {driverLocation && (
          <Marker
            coordinate={driverLocation}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverText}>🚗</Text>
            </View>
          </Marker>
        )}

        {/* Route polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={COLORS.green}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Top status bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{getStatusMessage()}</Text>
        </View>
      </View>

      {/* Bottom card with ride info */}
      <View style={styles.bottomCard}>
        {ride.driver && (
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Text style={styles.avatarText}>
                {ride.driver.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{ride.driver.name}</Text>
              <Text style={styles.driverPhone}>{ride.driver.phone}</Text>
            </View>
          </View>
        )}

        <View style={styles.addressSection}>
          <View style={styles.addressRow}>
            <View style={styles.greenDot} />
            <Text style={styles.addressText} numberOfLines={2}>
              {ride.pickup.address}
            </Text>
          </View>
          <View style={styles.addressRow}>
            <View style={styles.redSquare} />
            <Text style={styles.addressText} numberOfLines={2}>
              {ride.dropoff.address}
            </Text>
          </View>
        </View>

        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Prix de la course</Text>
          <Text style={styles.fareAmount}>{ride.fare?.toLocaleString()} FCFA</Text>
        </View>

        {ride.status === 'pending' && (
          <GlassButton
            title="Annuler la course"
            onPress={handleCancelRide}
            variant="secondary"
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    ...StyleSheet.absoluteFillObject,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  driverText: {
    fontSize: 24,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  backIcon: {
    fontSize: 28,
    color: COLORS.black,
  },
  statusBadge: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
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
  },
  addressSection: {
    marginBottom: 20,
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
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginBottom: 16,
  },
  fareLabel: {
    fontSize: 14,
    color: COLORS.gray,
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.green,
  },
});

export default ActiveRideScreen;