import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';

const { width, height } = Dimensions.get('window');
const SOCKET_URL = 'http://192.168.1.184:5000';

const RideRequestsScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [rideRequests, setRideRequests] = useState([]);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [earnings, setEarnings] = useState({ today: 0, ridesCompleted: 0 });
  
  const slideAnim = useRef(new Animated.Value(height)).current;
  const mapRef = useRef(null);

  useEffect(() => {
    getLocation();
    connectSocket();
    fetchEarnings();

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (currentRequest) {
      showRequestCard();
    } else {
      hideRequestCard();
    }
  }, [currentRequest]);

  const fetchEarnings = async () => {
    try {
      const response = await driverService.getEarnings();
      setEarnings({
        today: response.earnings.today || 0,
        ridesCompleted: response.earnings.totalRides || 0,
      });
    } catch (error) {
      console.log('Earnings error:', error);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin de votre localisation');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });

      setInterval(async () => {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        
        await driverService.updateLocation(loc.coords.latitude, loc.coords.longitude);
      }, 10000);
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const connectSocket = () => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('new-ride-request', (rideData) => {
      console.log('New ride request:', rideData);
      
      setRideRequests(prev => [...prev, rideData]);
      
      if (!currentRequest) {
        setCurrentRequest(rideData);
      }
      
      Alert.alert(
        '🚨 Nouvelle course!',
        `${rideData.distance.toFixed(1)} km • ${rideData.fare.toLocaleString()} FCFA`,
        [{ text: 'OK' }]
      );
    });
  };

  const showRequestCard = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();

    if (mapRef.current && currentRequest) {
      mapRef.current.fitToCoordinates([
        {
          latitude: currentRequest.pickup.coordinates.latitude,
          longitude: currentRequest.pickup.coordinates.longitude,
        },
        {
          latitude: currentRequest.dropoff.coordinates.latitude,
          longitude: currentRequest.dropoff.coordinates.longitude,
        }
      ], {
        edgePadding: { top: 100, right: 50, bottom: 400, left: 50 },
        animated: true,
      });
    }
  };

  const hideRequestCard = () => {
    Animated.timing(slideAnim, {
      toValue: height,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const handleGoOffline = async () => {
    Alert.alert(
      'Passer hors ligne?',
      'Vous arrêterez de recevoir des courses',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Hors ligne',
          style: 'destructive',
          onPress: async () => {
            try {
              await driverService.toggleOnlineStatus(false);
              navigation.replace('Home');
            } catch (error) {
              console.error('Toggle offline error:', error);
              navigation.replace('Home');
            }
          }
        }
      ]
    );
  };

  const handleAccept = async () => {
    if (!currentRequest) return;

    setLoading(true);
    try {
      await driverService.acceptRide(currentRequest.rideId);
      
      setRideRequests(prev => prev.filter(r => r.rideId !== currentRequest.rideId));
      
      navigation.replace('ActiveRide', {
        rideId: currentRequest.rideId,
        ride: currentRequest
      });
      
      setCurrentRequest(null);
    } catch (error) {
      console.error('Accept ride error:', error);
      Alert.alert('Erreur', 'Impossible d\'accepter la course');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!currentRequest) return;

    try {
      await driverService.rejectRide(currentRequest.rideId, 'Trop loin');
      
      setRideRequests(prev => prev.filter(r => r.rideId !== currentRequest.rideId));
      
      const nextRequest = rideRequests.find(r => r.rideId !== currentRequest.rideId);
      setCurrentRequest(nextRequest || null);
    } catch (error) {
      console.error('Reject ride error:', error);
    }
  };

  return (
    <View style={styles.container}>
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={location}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {location && (
            <Marker
              coordinate={location}
              title="Votre position"
            >
              <View style={styles.driverMarker}>
                <Text style={styles.driverMarkerText}>▲</Text>
              </View>
            </Marker>
          )}

          {currentRequest && (
            <>
              <Marker
                coordinate={{
                  latitude: currentRequest.pickup.coordinates.latitude,
                  longitude: currentRequest.pickup.coordinates.longitude,
                }}
                pinColor={COLORS.green}
                title="Départ"
              />
              <Marker
                coordinate={{
                  latitude: currentRequest.dropoff.coordinates.latitude,
                  longitude: currentRequest.dropoff.coordinates.longitude,
                }}
                pinColor={COLORS.red}
                title="Arrivée"
              />
              
              <Circle
                center={{
                  latitude: currentRequest.pickup.coordinates.latitude,
                  longitude: currentRequest.pickup.coordinates.longitude,
                }}
                radius={500}
                strokeColor="rgba(0, 133, 63, 0.3)"
                fillColor="rgba(0, 133, 63, 0.1)"
              />
            </>
          )}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Chargement de la carte...</Text>
        </View>
      )}

      {/* Top Bar - Earnings + Go Offline */}
      <View style={styles.topBar}>
        <View style={styles.earningsCard}>
          <Text style={styles.earningsValue}>{earnings.today.toLocaleString()} FCFA</Text>
          <Text style={styles.earningsLabel}>Aujourd'hui • {earnings.ridesCompleted} courses</Text>
        </View>

        <TouchableOpacity
          style={styles.offlineButton}
          onPress={handleGoOffline}
        >
          <View style={styles.onlineDot} />
          <Text style={styles.offlineText}>En ligne</Text>
        </TouchableOpacity>
      </View>

      {/* Menu Button */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => navigation.navigate('Menu')}
      >
        <Text style={styles.menuIcon}>☰</Text>
      </TouchableOpacity>

      {/* Ride request card */}
      <Animated.View 
        style={[
          styles.requestCard,
          { transform: [{ translateY: slideAnim }] }
        ]}
      >
        {currentRequest ? (
          <View style={styles.requestContent}>
            <View style={styles.requestHeader}>
              <View>
                <Text style={styles.requestTitle}>Nouvelle course</Text>
                <Text style={styles.requestSubtitle}>
                  {currentRequest.distance.toFixed(1)} km • {Math.round(currentRequest.distance * 2)} min
                </Text>
              </View>
              <Text style={styles.fareText}>{currentRequest.fare.toLocaleString()} FCFA</Text>
            </View>

            <View style={styles.addressesContainer}>
              <View style={styles.addressRow}>
                <View style={styles.greenDot} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {currentRequest.pickup.address}
                </Text>
              </View>
              <View style={styles.dashedLine} />
              <View style={styles.addressRow}>
                <View style={styles.redSquare} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {currentRequest.dropoff.address}
                </Text>
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={handleReject}
                disabled={loading}
              >
                <Text style={styles.rejectButtonText}>Rejeter</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.acceptButton, loading && styles.acceptButtonDisabled]}
                onPress={handleAccept}
                disabled={loading}
              >
                <Text style={styles.acceptButtonText}>
                  {loading ? 'Acceptation...' : 'Accepter'}
                </Text>
              </TouchableOpacity>
            </View>

            {rideRequests.length > 1 && (
              <Text style={styles.queueText}>
                +{rideRequests.length - 1} autre{rideRequests.length > 2 ? 's' : ''} en attente
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyTitle}>En attente de courses</Text>
            <Text style={styles.emptySubtitle}>
              Vous recevrez une notification dès qu'une course est disponible
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
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
  driverMarker: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.green,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  driverMarkerText: {
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earningsCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: COLORS.green,
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.green,
    marginBottom: 2,
  },
  earningsLabel: {
    fontSize: 11,
    color: '#666',
  },
  offlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FCD116',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.green,
    marginRight: 8,
  },
  offlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  menuButton: {
    position: 'absolute',
    bottom: 120,
    right: 20,
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
  requestCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 12,
  },
  requestContent: {
    padding: 24,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  requestTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  requestSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  fareText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.green,
  },
  addressesContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 16,
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
  dashedLine: {
    height: 20,
    marginLeft: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#ccc',
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FCD116',
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  queueText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default RideRequestsScreen;