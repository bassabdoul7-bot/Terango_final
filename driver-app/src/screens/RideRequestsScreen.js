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
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const { width, height } = Dimensions.get('window');
const SOCKET_URL = 'http://192.168.1.184:5000';

const RideRequestsScreen = ({ navigation, route }) => {
  const { driver } = useAuth();
  const driverId = route.params?.driverId || driver?._id;
  
  const [location, setLocation] = useState(null);
  const [rideRequests, setRideRequests] = useState([]);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [earnings, setEarnings] = useState({ today: 0, ridesCompleted: 0 });
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offerTimeout, setOfferTimeout] = useState(null);
  
  const slideAnim = useRef(new Animated.Value(height)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);

  useEffect(() => {
    getLocation();
    connectSocket();
    fetchEarnings();

    return () => {
      if (socket) {
        if (driverId) {
          socket.emit('driver-offline', driverId);
        }
        socket.disconnect();
      }
      if (offerTimeout) {
        clearTimeout(offerTimeout);
      }
    };
  }, []);

  useEffect(() => {
    if (currentRequest) {
      showRequestCard();
    } else {
      hideRequestCard();
    }
  }, [currentRequest]);

  useEffect(() => {
    if (!currentRequest) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanAnim.setValue(0);
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
    if (!driverId) {
      console.error('No driver ID available');
      return;
    }

    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      // Join driver's personal room for TARGETED offers
      newSocket.emit('driver-online', driverId);
      console.log(`Listening for targeted offers: new-ride-offer-${driverId}`);
    });

    // UBER-LEVEL: Listen for TARGETED ride offers only
    newSocket.on(`new-ride-offer-${driverId}`, (rideData) => {
      console.log('🎯 TARGETED ride offer received:', rideData);
      
      setRideRequests(prev => [...prev, rideData]);
      
      if (!currentRequest) {
        setCurrentRequest(rideData);
        
        // Start 15-second countdown
        const timeout = setTimeout(() => {
          console.log('⏰ Offer expired, auto-rejecting');
          handleReject();
        }, rideData.offerExpiresIn || 15000);
        
        setOfferTimeout(timeout);
      }
    });

    // Listen for ride taken by another driver
    newSocket.on(`ride-taken-${driverId}`, (data) => {
      console.log('Ride taken by another driver:', data);
      Alert.alert('Course prise', 'Un autre chauffeur a accepté cette course');
      
      if (currentRequest) {
        setRideRequests(prev => prev.filter(r => r.rideId !== currentRequest.rideId));
        const nextRequest = rideRequests.find(r => r.rideId !== currentRequest.rideId);
        setCurrentRequest(nextRequest || null);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
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
    setShowOfflineModal(false);
    try {
      await driverService.toggleOnlineStatus(false);
      
      if (socket && driverId) {
        socket.emit('driver-offline', driverId);
      }
      
      navigation.replace('Home');
    } catch (error) {
      console.error('Toggle offline error:', error);
      Alert.alert('Erreur', 'Impossible de passer hors ligne');
    }
  };

  const handleAccept = async () => {
    if (!currentRequest) return;

    // Clear timeout
    if (offerTimeout) {
      clearTimeout(offerTimeout);
      setOfferTimeout(null);
    }

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
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible d\'accepter la course');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!currentRequest) return;

    // Clear timeout
    if (offerTimeout) {
      clearTimeout(offerTimeout);
      setOfferTimeout(null);
    }

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

      <View style={styles.topBar}>
        <View style={styles.earningsCard}>
          <Text style={styles.earningsValue}>{earnings.today.toLocaleString()} FCFA</Text>
          <Text style={styles.earningsLabel}>Aujourd'hui • {earnings.ridesCompleted} courses</Text>
        </View>

        <TouchableOpacity
          style={styles.offlineButton}
          onPress={() => setShowOfflineModal(true)}
        >
          <View style={styles.onlineDot} />
          <Text style={styles.offlineText}>En ligne</Text>
        </TouchableOpacity>
      </View>

      {!currentRequest && (
        <View style={styles.scanningBar}>
          <Animated.View
            style={[
              styles.scanningLine,
              {
                transform: [
                  {
                    translateX: scanAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-width, width],
                    }),
                  },
                ],
              },
            ]}
          />
          
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.navigate('Menu')}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      )}

      {currentRequest && (
        <View style={styles.menuBarWhenRequest}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => navigation.navigate('Menu')}
          >
            <Text style={styles.menuIcon}>☰</Text>
          </TouchableOpacity>
        </View>
      )}

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
                <Text style={styles.requestTitle}>Nouvelle course 🎯</Text>
                <Text style={styles.requestSubtitle}>
                  {currentRequest.distance.toFixed(1)} km • {Math.round(currentRequest.distance * 2)} min
                  {currentRequest.distanceToPickup && ` • ${currentRequest.distanceToPickup.toFixed(1)}km de vous`}
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
              Vous recevrez des offres ciblées basées sur votre position
            </Text>
          </View>
        )}
      </Animated.View>

      <ConfirmModal
        visible={showOfflineModal}
        title="Passer hors ligne?"
        message="Vous arrêterez de recevoir des courses"
        cancelText="Rester en ligne"
        confirmText="Hors ligne"
        onCancel={() => setShowOfflineModal(false)}
        onConfirm={handleGoOffline}
      />
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
  scanningBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(179, 229, 206, 0.85)',
    overflow: 'hidden',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  scanningLine: {
    position: 'absolute',
    width: 80,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  menuBarWhenRequest: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: 'rgba(179, 229, 206, 0.85)',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  menuButton: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FCD116',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuIcon: {
    fontSize: 28,
    color: '#000',
    fontWeight: 'bold',
  },
  requestCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(179, 229, 206, 0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
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
    color: '#333',
  },
  fareText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  addressesContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
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
    borderLeftColor: 'rgba(0, 0, 0, 0.3)',
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
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
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#FCD116',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    color: '#333',
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
    color: '#333',
    textAlign: 'center',
  },
});

export default RideRequestsScreen;