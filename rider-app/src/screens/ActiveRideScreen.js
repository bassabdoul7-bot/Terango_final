import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Modal,
  Linking,
  Animated,
  ScrollView,
  BackHandler,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as PolylineUtil from '@mapbox/polyline';
import io from 'socket.io-client';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { rideService } from '../services/api.service';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const SOCKET_URL = 'http://192.168.1.184:5000';

// Cancel Modal
const CancelModal = ({ visible, onClose, onConfirm, loading }) => {
  const [selectedReason, setSelectedReason] = useState(null);
  const reasons = [
    { id: 1, label: 'Temps d\'attente trop long' },
    { id: 2, label: 'J\'ai changé d\'avis' },
    { id: 3, label: 'Le chauffeur m\'a demandé d\'annuler' },
    { id: 4, label: 'Prix trop élevé' },
    { id: 5, label: 'J\'ai trouvé un autre transport' },
    { id: 6, label: 'Autre raison' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cancelStyles.overlay}>
        <View style={cancelStyles.modal}>
          <View style={cancelStyles.handle} />
          <Text style={cancelStyles.title}>Annuler la course?</Text>
          <Text style={cancelStyles.subtitle}>Dites-nous pourquoi</Text>
          <ScrollView style={cancelStyles.reasonsList} showsVerticalScrollIndicator={false}>
            {reasons.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[cancelStyles.reasonItem, selectedReason === reason.id && cancelStyles.reasonItemSelected]}
                onPress={() => setSelectedReason(reason.id)}
              >
                <View style={cancelStyles.radio}>
                  {selectedReason === reason.id && <View style={cancelStyles.radioInner} />}
                </View>
                <Text style={cancelStyles.reasonText}>{reason.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={cancelStyles.actions}>
            <TouchableOpacity style={cancelStyles.backButton} onPress={onClose}>
              <Text style={cancelStyles.backButtonText}>Retour</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cancelStyles.confirmButton, !selectedReason && cancelStyles.confirmButtonDisabled]}
              onPress={() => selectedReason && onConfirm(reasons.find(r => r.id === selectedReason).label)}
              disabled={!selectedReason || loading}
            >
              {loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={cancelStyles.confirmButtonText}>Confirmer</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Searching Animation
const SearchingAnimation = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.timing(rotateAnim, { toValue: 1, duration: 2000, useNativeDriver: true })).start();
  }, []);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={searchStyles.container}>
      <Animated.View style={[searchStyles.pulseCircle, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[searchStyles.spinner, { transform: [{ rotate: spin }] }]} />
      <View style={searchStyles.carIcon}><Text style={{ fontSize: 28 }}>🚗</Text></View>
    </View>
  );
};

const ActiveRideScreen = ({ route, navigation }) => {
  const { rideId } = route.params;
  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const pollInterval = useRef(null);
  const etaInterval = useRef(null);

  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Handle hardware back button (Android)
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });
    return () => backHandler.remove();
  }, [ride]);

  const handleBackPress = () => {
    if (!ride) {
      navigation.goBack();
      return;
    }
    if (['pending', 'accepted', 'arrived', 'in_progress'].includes(ride.status)) {
      Alert.alert(
        'Course en cours',
        'Votre course est toujours active. Voulez-vous retourner à l\'accueil? La course continuera en arrière-plan.',
        [
          { text: 'Rester ici', style: 'cancel' },
          { text: 'Aller à l\'accueil', onPress: () => navigation.navigate('Home') },
        ]
      );
    } else {
      navigation.navigate('Home');
    }
  };

  useEffect(() => {
    fetchRideDetails();
    pollInterval.current = setInterval(fetchRideDetails, 8000);
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      if (etaInterval.current) clearInterval(etaInterval.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    if (ride?.driver && (ride.status === 'accepted' || ride.status === 'in_progress' || ride.status === 'arrived')) {
      connectToSocket();
      if (!etaInterval.current) {
        fetchETA();
        etaInterval.current = setInterval(fetchETA, 10000);
      }
    }
    return () => {
      if (etaInterval.current && ride?.status !== 'accepted') {
        clearInterval(etaInterval.current);
        etaInterval.current = null;
      }
    };
  }, [ride?.status, ride?.driver?._id]);

  const connectToSocket = () => {
    if (socketRef.current?.connected) return;
    socketRef.current = io(SOCKET_URL, { transports: ['websocket'], reconnection: true });
    socketRef.current.on('connect', () => {
      console.log('✅ Rider socket connected');
      socketRef.current.emit('join-ride-room', rideId);
    });
    socketRef.current.on('driver-location-update', (data) => {
      if (data.location) {
        console.log('📍 Driver location:', data.location.latitude, data.location.longitude);
        setDriverLocation(data.location);
      }
    });
  };

  const fetchETA = async () => {
    if (!ride || ride.status !== 'accepted' || !driverLocation || !ride.pickup?.coordinates) {
      if (ride?.driver?.currentLocation?.coordinates) {
        await calculateETA(ride.driver.currentLocation.coordinates, ride.pickup.coordinates);
      }
      return;
    }
    await calculateETA(driverLocation, ride.pickup.coordinates);
  };

  const calculateETA = async (driverLoc, pickupLoc) => {
    try {
      const origin = `${driverLoc.latitude},${driverLoc.longitude}`;
      const destination = `${pickupLoc.latitude},${pickupLoc.longitude}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_KEY}&mode=driving`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK' && data.routes[0]?.legs[0]) {
        const leg = data.routes[0].legs[0];
        setEta(Math.round(leg.duration.value / 60));
        setDistance(leg.distance.text);
      }
    } catch (error) {
      console.error('ETA error:', error);
    }
  };

  const fetchRideDetails = async () => {
    try {
      const response = await rideService.getRide(rideId);
      const rideData = response.ride;
      setRide(rideData);
      if (rideData.driver?.currentLocation?.coordinates && !driverLocation) {
        setDriverLocation(rideData.driver.currentLocation.coordinates);
      }
      if (rideData.status === 'accepted' || rideData.status === 'in_progress') {
        await getDirections(rideData);
      }
      if (rideData.status === 'completed') {
        Alert.alert('Course terminée', 'Merci d\'avoir voyagé avec TeranGO!', [{ text: 'OK', onPress: () => navigation.replace('Home') }]);
      }
      if (rideData.status === 'cancelled') {
        Alert.alert('Course annulée', 'Votre course a été annulée.', [{ text: 'OK', onPress: () => navigation.replace('Home') }]);
      }
      if (rideData.status === 'no_drivers_available') {
        Alert.alert('Aucun chauffeur', 'Désolé, aucun chauffeur disponible.', [{ text: 'OK', onPress: () => navigation.replace('Home') }]);
      }
      setLoading(false);
    } catch (error) {
      console.error('Fetch ride error:', error);
      setLoading(false);
    }
  };

  const getDirections = async (rideData) => {
    try {
      const origin = `${rideData.pickup.coordinates.latitude},${rideData.pickup.coordinates.longitude}`;
      const destination = `${rideData.dropoff.coordinates.latitude},${rideData.dropoff.coordinates.longitude}`;
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_KEY}&mode=driving&language=fr`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK' && data.routes[0]) {
        const points = PolylineUtil.decode(data.routes[0].overview_polyline.points);
        const coords = points.map(p => ({ latitude: p[0], longitude: p[1] }));
        setRouteCoordinates(coords);
        if (mapRef.current) {
          setTimeout(() => mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 120, right: 50, bottom: 350, left: 50 }, animated: true }), 500);
        }
      }
    } catch (error) {
      console.error('Directions error:', error);
    }
  };

  const handleCancelRide = async (reason) => {
    setCancelling(true);
    try {
      await rideService.cancelRide(rideId, reason);
      setShowCancelModal(false);
      navigation.replace('Home');
    } catch (error) {
      console.error('Cancel error:', error);
      setCancelling(false);
    }
  };

  const handleCallDriver = () => ride?.driver?.userId?.phone && Linking.openURL(`tel:${ride.driver.userId.phone}`);
  const handleMessageDriver = () => ride?.driver?.userId?.phone && Linking.openURL(`sms:${ride.driver.userId.phone}`);

  const getStatusConfig = () => {
    if (!ride) return { message: '', icon: '🔄' };
    switch (ride.status) {
      case 'pending': return { message: 'Recherche d\'un chauffeur...', icon: '🔍' };
      case 'accepted': return { message: eta ? `Arrivée dans ${eta} min (${distance})` : 'Chauffeur en route...', icon: '🚗' };
      case 'arrived': return { message: 'Le chauffeur est arrivé!', icon: '📍' };
      case 'in_progress': return { message: 'Course en cours', icon: '🛣️' };
      case 'completed': return { message: 'Course terminée', icon: '✅' };
      default: return { message: '', icon: '🔄' };
    }
  };

  const renderStars = (rating) => [...Array(5)].map((_, i) => (
    <Text key={i} style={{ color: i < Math.floor(rating || 5) ? '#FFD700' : '#DDD', fontSize: 12 }}>★</Text>
  ));

  if (loading || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const statusConfig = getStatusConfig();

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={WAZE_DARK_STYLE}
        initialRegion={{ latitude: ride.pickup.coordinates.latitude, longitude: ride.pickup.coordinates.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        <Marker coordinate={ride.pickup.coordinates} title="Départ">
          <View style={styles.pickupMarker}><View style={styles.pickupDot} /></View>
        </Marker>
        <Marker coordinate={ride.dropoff.coordinates} title="Destination">
          <View style={styles.dropoffMarker}><View style={styles.dropoffSquare} /></View>
        </Marker>
        {driverLocation && (
          <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.driverMarker}><Text style={{ fontSize: 22 }}>🚗</Text></View>
          </Marker>
        )}
        {routeCoordinates.length > 0 && <Polyline coordinates={routeCoordinates} strokeColor="#00E676" strokeWidth={5} />}
      </MapView>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.statusCard}>
          <Text style={styles.statusIcon}>{statusConfig.icon}</Text>
          <Text style={styles.statusText}>{statusConfig.message}</Text>
        </View>
      </View>

      <View style={styles.bottomCard}>
        {ride.status === 'pending' && (
          <View style={styles.searchingSection}>
            <SearchingAnimation />
            <Text style={styles.searchingTitle}>Connexion avec un chauffeur...</Text>
            <Text style={styles.searchingSubtitle}>Cela peut prendre quelques instants</Text>
          </View>
        )}

        {ride.driver?.userId && ride.status !== 'pending' && (
          <View style={styles.driverCard}>
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}>
                <Text style={styles.avatarText}>{ride.driver.userId.name?.charAt(0).toUpperCase() || 'D'}</Text>
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{ride.driver.userId.name}</Text>
                <View style={styles.ratingRow}>
                  {renderStars(ride.driver.userId.rating)}
                  <Text style={styles.ratingText}>{ride.driver.userId.rating?.toFixed(1) || '5.0'}</Text>
                </View>
                {ride.driver.vehicle && (
                  <Text style={styles.vehicleText}>{ride.driver.vehicle.make} {ride.driver.vehicle.model} • {ride.driver.vehicle.plateNumber}</Text>
                )}
              </View>
            </View>
            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.contactButton} onPress={handleCallDriver}>
                <View style={styles.contactIconBg}><Text style={styles.contactIcon}>📞</Text></View>
                <Text style={styles.contactLabel}>Appeler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactButton} onPress={handleMessageDriver}>
                <View style={styles.contactIconBg}><Text style={styles.contactIcon}>💬</Text></View>
                <Text style={styles.contactLabel}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.addressCard}>
          <View style={styles.addressRow}>
            <View style={styles.addressIconWrap}><View style={styles.greenDot} /></View>
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>Départ</Text>
              <Text style={styles.addressText} numberOfLines={1}>{ride.pickup.address}</Text>
            </View>
          </View>
          <View style={styles.addressDivider} />
          <View style={styles.addressRow}>
            <View style={styles.addressIconWrap}><View style={styles.redSquare} /></View>
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>Destination</Text>
              <Text style={styles.addressText} numberOfLines={1}>{ride.dropoff.address}</Text>
            </View>
          </View>
        </View>

        <View style={styles.fareCard}>
          <Text style={styles.fareLabel}>💵 Espèces</Text>
          <Text style={styles.fareAmount}>{ride.fare?.toLocaleString()} FCFA</Text>
        </View>

        {(ride.status === 'pending' || ride.status === 'accepted') && (
          <GlassButton title="Annuler la course" onPress={() => setShowCancelModal(true)} variant="secondary" />
        )}
      </View>

      <CancelModal visible={showCancelModal} onClose={() => setShowCancelModal(false)} onConfirm={handleCancelRide} loading={cancelling} />
    </View>
  );
};

const cancelStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'rgba(179, 229, 206, 0.98)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: height * 0.7 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#333', textAlign: 'center', marginBottom: 20 },
  reasonsList: { maxHeight: 280 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  reasonItemSelected: { borderColor: COLORS.green, backgroundColor: 'rgba(255,255,255,0.9)' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  reasonText: { fontSize: 14, color: '#000', flex: 1 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  backButton: { flex: 1, padding: 14, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, alignItems: 'center' },
  backButtonText: { fontSize: 15, fontWeight: '600', color: '#000' },
  confirmButton: { flex: 1, padding: 14, backgroundColor: COLORS.red, borderRadius: 12, alignItems: 'center' },
  confirmButtonDisabled: { opacity: 0.5 },
  confirmButtonText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
});

const searchStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', height: 100, marginBottom: 12 },
  pulseCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0, 230, 118, 0.2)' },
  spinner: { position: 'absolute', width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: 'transparent', borderTopColor: '#00E676' },
  carIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', elevation: 4 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#212121' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#212121' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#AAA' },
  map: { ...StyleSheet.absoluteFillObject },
  pickupMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#212121', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#00E676' },
  pickupDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#00E676' },
  dropoffMarker: { width: 26, height: 26, backgroundColor: '#212121', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FF5252' },
  dropoffSquare: { width: 10, height: 10, backgroundColor: '#FF5252' },
  driverMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  topBar: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(33,33,33,0.9)', alignItems: 'center', justifyContent: 'center', marginRight: 12, elevation: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  backIcon: { fontSize: 22, color: '#FFF', fontWeight: 'bold' },
  statusCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(33,33,33,0.9)', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, elevation: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statusIcon: { fontSize: 18, marginRight: 8 },
  statusText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#FFF' },
  bottomCard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(179, 229, 206, 0.98)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, elevation: 12 },
  searchingSection: { alignItems: 'center', marginBottom: 12 },
  searchingTitle: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 4 },
  searchingSubtitle: { fontSize: 13, color: '#333' },
  driverCard: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  driverAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  driverDetails: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: 'bold', color: '#000', marginBottom: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  ratingText: { marginLeft: 4, fontSize: 12, fontWeight: '600', color: '#333' },
  vehicleText: { fontSize: 12, color: '#555' },
  contactRow: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)', paddingTop: 12 },
  contactButton: { alignItems: 'center' },
  contactIconBg: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FCD116', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  contactIcon: { fontSize: 18 },
  contactLabel: { fontSize: 12, fontWeight: '500', color: '#000' },
  addressCard: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  addressIconWrap: { width: 28, alignItems: 'center', marginRight: 10 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red },
  addressDivider: { height: 20, marginLeft: 14, borderLeftWidth: 2, borderLeftColor: 'rgba(0,0,0,0.1)', borderStyle: 'dashed', marginVertical: 6 },
  addressContent: { flex: 1 },
  addressLabel: { fontSize: 11, color: '#666', marginBottom: 1 },
  addressText: { fontSize: 14, fontWeight: '500', color: '#000' },
  fareCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  fareLabel: { fontSize: 14, color: '#333' },
  fareAmount: { fontSize: 18, fontWeight: 'bold', color: COLORS.green },
});

export default ActiveRideScreen;
