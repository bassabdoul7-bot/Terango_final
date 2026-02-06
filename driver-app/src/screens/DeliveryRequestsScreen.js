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
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import COLORS from '../constants/colors';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { driverService, deliveryService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');
const SOCKET_URL = 'https://terango-api.fly.dev';

var MINT = 'rgba(179, 229, 206, 0.95)';
var MINT_LIGHT = 'rgba(179, 229, 206, 0.12)';
var MINT_BORDER = 'rgba(179, 229, 206, 0.25)';
var YELLOW = '#FCD116';
var DARK_BG = '#0a0a0a';

var SERVICE_ICONS = {
  colis: { icon: '📦', label: 'Colis', color: '#FF9500' },
  commande: { icon: '🛒', label: 'Commande', color: '#AF52DE' },
  resto: { icon: '🍽️', label: 'Restaurant', color: '#FF3B30' },
};

const DeliveryRequestsScreen = ({ navigation, route }) => {
  const { driver } = useAuth();
  const driverId = route.params?.driverId || driver?._id;

  const [location, setLocation] = useState(null);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [earnings, setEarnings] = useState({ today: 0, deliveriesCompleted: 0 });
  const [offerTimeout, setOfferTimeout] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);

  const slideAnim = useRef(new Animated.Value(height)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    getLocation();
    connectSocket();
    return () => {
      if (socket) {
        socket.emit('driver-offline', driverId);
        socket.disconnect();
      }
      if (offerTimeout) clearTimeout(offerTimeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (currentRequest) {
      // Start countdown
      setTimeLeft(60);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleReject();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();

      // Slide up
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [currentRequest]);

  function getLocation() {
    Location.requestForegroundPermissionsAsync().then(result => {
      if (result.status !== 'granted') {
        setLocation({ latitude: 14.6928, longitude: -17.4467, latitudeDelta: 0.05, longitudeDelta: 0.05 });
        return;
      }
      Location.getCurrentPositionAsync({}).then(loc => {
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        });
      });
    });
  }

  function connectSocket() {
    const newSocket = io(SOCKET_URL, { transports: ['websocket'], reconnection: true });

    newSocket.on('connect', () => {
      console.log('Driver delivery socket connected');
      newSocket.emit('driver-online', {
        driverId: driverId,
        location: location,
        services: ['colis', 'commande', 'resto']
      });

      // Listen for delivery offers
      console.log('Listening for: new-delivery-' + driverId);
      newSocket.on('new-delivery-' + driverId, (data) => {
        console.log('📦 Delivery offer received:', data.serviceType);
        setCurrentRequest(data);
      });

      // Listen for order offers (restaurant)
      newSocket.on('new-order-' + driverId, (data) => {
        console.log('🍽️ Order offer received:', data);
        setCurrentRequest({
          deliveryId: data.orderId,
          serviceType: 'resto',
          pickup: data.pickup,
          dropoff: data.dropoff,
          fare: data.deliveryFee || 500,
          restaurantName: data.restaurantName,
          isOrder: true,
        });
      });

      // Delivery taken by another driver
      newSocket.on('delivery-taken-' + driverId, () => {
        setCurrentRequest(null);
        Alert.alert('Livraison prise', 'Un autre livreur a accepte cette livraison.');
      });
    });

    newSocket.on('disconnect', () => {
      console.log('Driver delivery socket disconnected');
    });

    setSocket(newSocket);
  }

  const handleAccept = async () => {
    if (!currentRequest || loading) return;
    setLoading(true);

    try {
      if (currentRequest.isOrder) {
        // Restaurant order — accept differently if needed
        // For now, treat same as delivery
        Alert.alert('Commande acceptee!', 'Dirigez-vous vers le restaurant.');
        setCurrentRequest(null);
        navigation.navigate('ActiveRide', { deliveryMode: true, deliveryData: currentRequest });
      } else {
        const response = await deliveryService.acceptDelivery(currentRequest.deliveryId);
        if (response.success) {
          setCurrentRequest(null);
          navigation.navigate('ActiveRide', { deliveryMode: true, deliveryData: currentRequest });
        } else {
          Alert.alert('Erreur', response.message || 'Impossible d\'accepter');
        }
      }
    } catch (error) {
      console.error('Accept delivery error:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    setCurrentRequest(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  function getServiceInfo(type) {
    return SERVICE_ICONS[type] || SERVICE_ICONS.colis;
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      {location && (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={WAZE_DARK_STYLE}
          initialRegion={location}
          showsUserLocation={true}
          showsMyLocationButton={false}
        />
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.topTitle}>
          <Text style={styles.topTitleText}>🏍️ Mode Livraison</Text>
        </View>
      </View>

      {/* Waiting state */}
      {!currentRequest && (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingIcon}>📡</Text>
          <Text style={styles.waitingTitle}>En attente de livraisons...</Text>
          <Text style={styles.waitingSub}>Les demandes de colis, commandes et restaurants apparaitront ici</Text>
          <View style={styles.serviceTypes}>
            {Object.keys(SERVICE_ICONS).map(key => {
              var info = SERVICE_ICONS[key];
              return (
                <View key={key} style={styles.serviceType}>
                  <Text style={styles.serviceTypeIcon}>{info.icon}</Text>
                  <Text style={styles.serviceTypeLabel}>{info.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Delivery offer card */}
      {currentRequest && (
        <Animated.View style={[styles.offerCard, { transform: [{ translateY: slideAnim }, { scale: pulseAnim }] }]}>
          {/* Timer */}
          <View style={styles.timerBar}>
            <View style={[styles.timerFill, { width: (timeLeft / 60 * 100) + '%' }]} />
          </View>

          {/* Service badge */}
          <View style={styles.offerHeader}>
            <View style={[styles.serviceBadge, { backgroundColor: getServiceInfo(currentRequest.serviceType).color + '20' }]}>
              <Text style={styles.serviceBadgeIcon}>{getServiceInfo(currentRequest.serviceType).icon}</Text>
              <Text style={[styles.serviceBadgeText, { color: getServiceInfo(currentRequest.serviceType).color }]}>
                {getServiceInfo(currentRequest.serviceType).label}
              </Text>
            </View>
            <Text style={styles.offerTimer}>{timeLeft + 's'}</Text>
          </View>

          {/* Fare */}
          <Text style={styles.offerFare}>{(currentRequest.fare || 0).toLocaleString() + ' FCFA'}</Text>

          {/* Restaurant name if order */}
          {currentRequest.restaurantName && (
            <Text style={styles.offerRestaurant}>{'🏪 ' + currentRequest.restaurantName}</Text>
          )}

          {/* Pickup & dropoff */}
          <View style={styles.offerRoute}>
            <View style={styles.offerDotLine}>
              <View style={styles.offerGDot} />
              <View style={styles.offerDLine} />
              <View style={styles.offerRSquare} />
            </View>
            <View style={styles.offerAddresses}>
              <Text style={styles.offerAddr} numberOfLines={1}>
                {currentRequest.pickup ? currentRequest.pickup.address : 'Point de retrait'}
              </Text>
              <Text style={styles.offerAddr} numberOfLines={1}>
                {currentRequest.dropoff ? currentRequest.dropoff.address : 'Point de livraison'}
              </Text>
            </View>
          </View>

          {/* Package info if colis */}
          {currentRequest.packageDetails && (
            <View style={styles.packageInfo}>
              <Text style={styles.packageText}>
                {'📏 Taille: ' + (currentRequest.packageDetails.size || 'petit')}
                {currentRequest.packageDetails.isFragile ? '  ⚠️ Fragile' : ''}
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.offerActions}>
            <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
              <Text style={styles.rejectBtnText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.acceptBtn, loading && { opacity: 0.6 }]}
              onPress={handleAccept}
              disabled={loading}
            >
              <Text style={styles.acceptBtnText}>{loading ? 'Acceptation...' : 'Accepter'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  // Top bar
  topBar: {
    position: 'absolute', top: 60, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: MINT,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, elevation: 4,
  },
  backIcon: { fontSize: 22, color: '#000', fontWeight: 'bold' },
  topTitle: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 16,
    paddingVertical: 12, borderRadius: 16, elevation: 4,
  },
  topTitleText: { fontSize: 16, fontWeight: '700', color: '#fff', textAlign: 'center' },

  // Waiting
  waitingCard: {
    position: 'absolute', bottom: 40, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.9)', borderRadius: 24, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: MINT_BORDER,
  },
  waitingIcon: { fontSize: 40, marginBottom: 12 },
  waitingTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  waitingSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 16 },
  serviceTypes: { flexDirection: 'row', gap: 20 },
  serviceType: { alignItems: 'center' },
  serviceTypeIcon: { fontSize: 28, marginBottom: 4 },
  serviceTypeLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },

  // Offer card
  offerCard: {
    position: 'absolute', bottom: 30, left: 16, right: 16,
    backgroundColor: '#111', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: MINT_BORDER, elevation: 10,
  },
  timerBar: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2,
    marginBottom: 16, overflow: 'hidden',
  },
  timerFill: { height: '100%', backgroundColor: YELLOW, borderRadius: 2 },
  offerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  serviceBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 12,
  },
  serviceBadgeIcon: { fontSize: 18, marginRight: 6 },
  serviceBadgeText: { fontSize: 14, fontWeight: '700' },
  offerTimer: { fontSize: 20, fontWeight: '800', color: YELLOW },
  offerFare: { fontSize: 32, fontWeight: '800', color: '#fff', marginBottom: 8 },
  offerRestaurant: { fontSize: 15, color: MINT, fontWeight: '600', marginBottom: 12 },

  // Route
  offerRoute: { flexDirection: 'row', marginBottom: 14 },
  offerDotLine: { alignItems: 'center', marginRight: 12, paddingTop: 4 },
  offerGDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CD964' },
  offerDLine: { width: 2, height: 20, backgroundColor: 'rgba(179,229,206,0.3)', marginVertical: 3 },
  offerRSquare: { width: 10, height: 10, backgroundColor: '#FF3B30' },
  offerAddresses: { flex: 1, justifyContent: 'space-between' },
  offerAddr: { fontSize: 14, color: 'rgba(255,255,255,0.7)', paddingVertical: 2 },

  // Package info
  packageInfo: {
    backgroundColor: MINT_LIGHT, borderRadius: 10, padding: 10,
    marginBottom: 14, borderWidth: 1, borderColor: MINT_BORDER,
  },
  packageText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },

  // Actions
  offerActions: { flexDirection: 'row', gap: 12 },
  rejectBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,59,48,0.15)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)',
  },
  rejectBtnText: { fontSize: 24, color: '#FF3B30', fontWeight: 'bold' },
  acceptBtn: {
    flex: 1, height: 56, borderRadius: 28, backgroundColor: YELLOW,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtnText: { fontSize: 18, fontWeight: '700', color: '#000' },
});

export default DeliveryRequestsScreen;

