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
  Easing,
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
const SOCKET_URL = 'https://terango-api.fly.dev';

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
          <ScrollView style={cancelStyles.reasonsList}>
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

// Enhanced Searching Animation with orbiting car
const SearchingAnimation = ({ searchTime }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const carPulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pulse animation for the circle
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
    ])).start();

    // Orbit animation - car moves left to right along top arc
    Animated.loop(Animated.sequence([
      Animated.timing(orbitAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(orbitAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();

    // Car pulse animation
    Animated.loop(Animated.sequence([
      Animated.timing(carPulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
      Animated.timing(carPulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const getSearchStatus = () => {
    if (searchTime < 10) return 'Recherche de chauffeurs à proximité...';
    if (searchTime < 20) return 'Expansion de la zone de recherche...';
    if (searchTime < 40) return 'Recherche dans un rayon plus large...';
    return 'Toujours en recherche, merci de patienter...';
  };

  // Calculate car position along arc (-40 to +40 degrees from top)
  const carTranslateX = orbitAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-35, 35],
  });
  
  const carTranslateY = orbitAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -8, 0], // Slight arc movement
  });

  return (
    <View style={searchStyles.container}>
      {/* Pulsing circles */}
      <Animated.View style={[searchStyles.pulseCircle, searchStyles.pulseCircle1, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[searchStyles.pulseCircle, searchStyles.pulseCircle2, { transform: [{ scale: Animated.multiply(pulseAnim, 0.85) }] }]} />
      
      {/* Center circle */}
      <View style={searchStyles.centerCircle} />
      
      {/* Orbiting car */}
      <Animated.View style={[
        searchStyles.carContainer,
        { 
          transform: [
            { translateX: carTranslateX },
            { translateY: carTranslateY },
            { scale: carPulseAnim }
          ] 
        }
      ]}>
        <View style={searchStyles.carIcon}>
          <Text style={{ fontSize: 24 }}>🚗</Text>
        </View>
      </Animated.View>

      {/* Timer */}
      <View style={searchStyles.timerContainer}>
        <Text style={searchStyles.timerText}>{formatTime(searchTime)}</Text>
      </View>
      
      {/* Status text */}
      <Text style={searchStyles.statusText}>{getSearchStatus()}</Text>
      
      {searchTime >= 30 && (
        <Text style={searchStyles.tipText}>💡 Essayez aux heures de pointe pour plus de chauffeurs</Text>
      )}
    </View>
  );
};

// No Drivers Screen with Retry Option
const NoDriversScreen = ({ ride, onRetry, onGoHome, retrying }) => {
  return (
    <View style={noDriversStyles.container}>
      <View style={noDriversStyles.content}>
        <Text style={noDriversStyles.icon}>😔</Text>
        <Text style={noDriversStyles.title}>Aucun chauffeur disponible</Text>
        <Text style={noDriversStyles.subtitle}>
          Désolé, nous n'avons pas trouvé de chauffeur disponible pour le moment.
        </Text>
        
        <View style={noDriversStyles.rideInfo}>
          <View style={noDriversStyles.addressRow}>
            <View style={noDriversStyles.greenDot} />
            <Text style={noDriversStyles.addressText} numberOfLines={1}>{ride?.pickup?.address}</Text>
          </View>
          <View style={noDriversStyles.addressRow}>
            <View style={noDriversStyles.redSquare} />
            <Text style={noDriversStyles.addressText} numberOfLines={1}>{ride?.dropoff?.address}</Text>
          </View>
          <Text style={noDriversStyles.fareText}>{ride?.fare?.toLocaleString()} FCFA</Text>
        </View>

        <TouchableOpacity 
          style={noDriversStyles.retryButton} 
          onPress={onRetry}
          disabled={retrying}
        >
          {retrying ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={noDriversStyles.retryButtonText}>🔄 Réessayer</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity style={noDriversStyles.homeButton} onPress={onGoHome}>
          <Text style={noDriversStyles.homeButtonText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ActiveRideScreen = ({ route, navigation }) => {
  const { rideId: initialRideId } = route.params;
  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const pollInterval = useRef(null);
  const etaInterval = useRef(null);
  const searchTimerRef = useRef(null);
  const alertShownRef = useRef(false);

  const [rideId, setRideId] = useState(initialRideId);
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [distance, setDistance] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [showNoDrivers, setShowNoDrivers] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });
    return () => backHandler.remove();
  }, [ride, showNoDrivers]);

  useEffect(() => {
    if (ride?.status === 'pending' && !showNoDrivers) {
      searchTimerRef.current = setInterval(() => setSearchTime(prev => prev + 1), 1000);
    } else if (searchTimerRef.current) {
      clearInterval(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    return () => { if (searchTimerRef.current) clearInterval(searchTimerRef.current); };
  }, [ride?.status, showNoDrivers]);

  const handleBackPress = () => {
    if (showNoDrivers) {
      navigation.replace('Home');
      return;
    }
    if (!ride) { navigation.goBack(); return; }
    if (['pending', 'accepted', 'arrived', 'in_progress'].includes(ride.status)) {
      Alert.alert('Course en cours', 'Voulez-vous retourner à l\'accueil?', [
        { text: 'Rester', style: 'cancel' },
        { text: 'Accueil', onPress: () => navigation.navigate('Home') },
      ]);
    } else {
      navigation.navigate('Home');
    }
  };

  useEffect(() => {
    fetchRideDetails();
    pollInterval.current = setInterval(fetchRideDetails, 5000);
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
      if (etaInterval.current) clearInterval(etaInterval.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [rideId]);

  useEffect(() => {
    if (ride?.driver && ['accepted', 'in_progress', 'arrived'].includes(ride.status)) {
      connectToSocket();
      if (!etaInterval.current) {
        fetchETA();
        etaInterval.current = setInterval(fetchETA, 10000);
      }
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = setInterval(fetchRideDetails, 8000);
      }
    }
  }, [ride?.status, ride?.driver?._id]);

  const connectToSocket = () => {
    if (socketRef.current?.connected) return;
    socketRef.current = io(SOCKET_URL, { transports: ['websocket'], reconnection: true });
    socketRef.current.on('connect', () => socketRef.current.emit('join-ride-room', rideId));
    socketRef.current.on('driver-location-update', (data) => data.location && setDriverLocation(data.location));
  };

  const fetchETA = async () => {
    const loc = driverLocation || ride?.driver?.currentLocation?.coordinates;
    if (!ride || ride.status !== 'accepted' || !loc || !ride.pickup?.coordinates) return;
    await calculateETA(loc, ride.pickup.coordinates);
  };

  const calculateETA = async (driverLoc, pickupLoc) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${driverLoc.latitude},${driverLoc.longitude}&destination=${pickupLoc.latitude},${pickupLoc.longitude}&key=${GOOGLE_MAPS_KEY}&mode=driving`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK' && data.routes[0]?.legs[0]) {
        setEta(Math.round(data.routes[0].legs[0].duration.value / 60));
        setDistance(data.routes[0].legs[0].distance.text);
      }
    } catch (e) {}
  };

  const fetchRideDetails = async () => {
    try {
      const response = await rideService.getRide(rideId);
      const rideData = response.ride;
      setRide(rideData);
      
      if (rideData.driver?.currentLocation?.coordinates && !driverLocation) {
        setDriverLocation(rideData.driver.currentLocation.coordinates);
      }
      
      if (['accepted', 'in_progress'].includes(rideData.status)) {
        await getDirections(rideData);
      }
      
      if (!alertShownRef.current) {
        if (rideData.status === 'completed') {
          alertShownRef.current = true;
          clearInterval(pollInterval.current);
          navigation.replace('Rating', { ride: rideData });
        } else if (rideData.status === 'cancelled') {
          alertShownRef.current = true;
          clearInterval(pollInterval.current);
          Alert.alert('Course annulée', 'Votre course a été annulée.', [
            { text: 'OK', onPress: () => navigation.replace('Home') }
          ]);
        } else if (rideData.status === 'no_drivers_available') {
          alertShownRef.current = true;
          clearInterval(pollInterval.current);
          setShowNoDrivers(true);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Fetch ride error:', error);
      setLoading(false);
    }
  };

  const getDirections = async (rideData) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${rideData.pickup.coordinates.latitude},${rideData.pickup.coordinates.longitude}&destination=${rideData.dropoff.coordinates.latitude},${rideData.dropoff.coordinates.longitude}&key=${GOOGLE_MAPS_KEY}&mode=driving&language=fr`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.status === 'OK' && data.routes[0]) {
        const coords = PolylineUtil.decode(data.routes[0].overview_polyline.points).map(p => ({ latitude: p[0], longitude: p[1] }));
        setRouteCoordinates(coords);
        mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 120, right: 50, bottom: 350, left: 50 }, animated: true });
      }
    } catch (e) {}
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const response = await rideService.createRide({
        pickup: { address: ride.pickup.address, coordinates: ride.pickup.coordinates },
        dropoff: { address: ride.dropoff.address, coordinates: ride.dropoff.coordinates },
        rideType: ride.rideType || 'standard',
        paymentMethod: ride.paymentMethod || 'cash'
      });
      
      if (response.success) {
        const newRideId = response.ride?.id || response.ride?._id;
        setRideId(newRideId);
        setShowNoDrivers(false);
        setSearchTime(0);
        alertShownRef.current = false;
        setLoading(true);
        
        if (pollInterval.current) clearInterval(pollInterval.current);
        pollInterval.current = setInterval(fetchRideDetails, 5000);
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de créer une nouvelle demande. Veuillez réessayer.');
    } finally {
      setRetrying(false);
    }
  };

  const handleCancelRide = async (reason) => {
    setCancelling(true);
    try {
      await rideService.cancelRide(rideId, reason);
      setShowCancelModal(false);
      navigation.replace('Home');
    } catch (e) {
      setCancelling(false);
    }
  };

  const getStatusConfig = () => {
    if (!ride) return { message: '', icon: '🔄' };
    switch (ride.status) {
      case 'pending': return { message: 'Recherche d\'un chauffeur...', icon: '🔍' };
      case 'accepted': return { message: eta ? `Arrivée dans ${eta} min (${distance})` : 'Chauffeur en route...', icon: '🚗' };
      case 'arrived': return { message: 'Le chauffeur est arrivé!', icon: '📍' };
      case 'in_progress': return { message: 'Course en cours', icon: '🛣️' };
      default: return { message: '', icon: '🔄' };
    }
  };

  const renderStars = (rating) => [...Array(5)].map((_, i) => (
    <Text key={i} style={{ color: i < Math.floor(rating || 5) ? '#FFD700' : '#DDD', fontSize: 12 }}>★</Text>
  ));

  if (showNoDrivers) {
    return (
      <NoDriversScreen 
        ride={ride} 
        onRetry={handleRetry} 
        onGoHome={() => navigation.replace('Home')}
        retrying={retrying}
      />
    );
  }

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
        provider={PROVIDER_GOOGLE}
        customMapStyle={WAZE_DARK_STYLE}
        initialRegion={{ latitude: ride.pickup.coordinates.latitude, longitude: ride.pickup.coordinates.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        <Marker coordinate={ride.pickup.coordinates}><View style={styles.pickupMarker}><View style={styles.pickupDot} /></View></Marker>
        <Marker coordinate={ride.dropoff.coordinates}><View style={styles.dropoffMarker}><View style={styles.dropoffSquare} /></View></Marker>
        {driverLocation && <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}><View style={styles.driverMarker}><Text style={{ fontSize: 22 }}>🚗</Text></View></Marker>}
        {routeCoordinates.length > 0 && <Polyline coordinates={routeCoordinates} strokeColor="#00E676" strokeWidth={5} />}
      </MapView>

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <View style={styles.statusCard}>
          <Text style={styles.statusIcon}>{getStatusConfig().icon}</Text>
          <Text style={styles.statusText}>{getStatusConfig().message}</Text>
        </View>
      </View>

      <View style={styles.bottomCard}>
        {ride.status === 'pending' && <SearchingAnimation searchTime={searchTime} />}

        {ride.driver?.userId && ride.status !== 'pending' && (
          <View style={styles.driverCard}>
            <View style={styles.driverRow}>
              <View style={styles.driverAvatar}><Text style={styles.avatarText}>{ride.driver.userId.name?.charAt(0) || 'D'}</Text></View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{ride.driver.userId.name}</Text>
                <View style={styles.ratingRow}>{renderStars(ride.driver.userId.rating)}<Text style={styles.ratingText}>{ride.driver.userId.rating?.toFixed(1) || '5.0'}</Text></View>
                {ride.driver.vehicle && <Text style={styles.vehicleText}>{ride.driver.vehicle.make} {ride.driver.vehicle.model} • {ride.driver.vehicle.plateNumber}</Text>}
              </View>
            </View>
            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL(`tel:${ride.driver.userId.phone}`)}><View style={styles.contactIconBg}><Text>📞</Text></View><Text style={styles.contactLabel}>Appeler</Text></TouchableOpacity>
              <TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL(`sms:${ride.driver.userId.phone}`)}><View style={styles.contactIconBg}><Text>💬</Text></View><Text style={styles.contactLabel}>Message</Text></TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.addressCard}>
          <View style={styles.addressRow}><View style={styles.addressIconWrap}><View style={styles.greenDot} /></View><View style={styles.addressContent}><Text style={styles.addressLabel}>Départ</Text><Text style={styles.addressText} numberOfLines={1}>{ride.pickup.address}</Text></View></View>
          <View style={styles.addressDivider} />
          <View style={styles.addressRow}><View style={styles.addressIconWrap}><View style={styles.redSquare} /></View><View style={styles.addressContent}><Text style={styles.addressLabel}>Destination</Text><Text style={styles.addressText} numberOfLines={1}>{ride.dropoff.address}</Text></View></View>
        </View>

        <View style={styles.fareCard}><Text style={styles.fareLabel}>💵 Espèces</Text><Text style={styles.fareAmount}>{ride.fare?.toLocaleString()} FCFA</Text></View>

        {['pending', 'accepted'].includes(ride.status) && <GlassButton title="Annuler la course" onPress={() => setShowCancelModal(true)} variant="secondary" />}
      </View>

      <CancelModal visible={showCancelModal} onClose={() => setShowCancelModal(false)} onConfirm={handleCancelRide} loading={cancelling} />
    </View>
  );
};

const noDriversStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'rgba(179, 229, 206, 0.98)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { alignItems: 'center', width: '100%' },
  icon: { fontSize: 60, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#333', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  rideInfo: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 16, width: '100%', marginBottom: 24 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green, marginRight: 12 },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red, marginRight: 12 },
  addressText: { flex: 1, fontSize: 14, color: '#000' },
  fareText: { fontSize: 18, fontWeight: 'bold', color: COLORS.green, textAlign: 'center', marginTop: 8 },
  retryButton: { backgroundColor: COLORS.green, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 14, width: '100%', alignItems: 'center', marginBottom: 12 },
  retryButtonText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
  homeButton: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14, width: '100%', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },
  homeButtonText: { fontSize: 15, fontWeight: '600', color: '#333' },
});

const cancelStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: 'rgba(179, 229, 206, 0.98)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: height * 0.7 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#000', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#333', textAlign: 'center', marginBottom: 20 },
  reasonsList: { maxHeight: 280 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, marginBottom: 8 },
  reasonItemSelected: { borderColor: COLORS.green, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.9)' },
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
  container: { alignItems: 'center', paddingVertical: 20, marginBottom: 12, height: 180 },
  pulseCircle: { position: 'absolute', borderRadius: 100, borderWidth: 2, borderColor: 'rgba(0, 230, 118, 0.3)' },
  pulseCircle1: { width: 120, height: 120, top: 10 },
  pulseCircle2: { width: 90, height: 90, top: 25, borderColor: 'rgba(0, 230, 118, 0.5)' },
  centerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0, 230, 118, 0.15)', position: 'absolute', top: 40 },
  carContainer: { position: 'absolute', top: 15 },
  carIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  timerContainer: { marginTop: 85, backgroundColor: 'rgba(0,133,63,0.15)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  timerText: { fontSize: 20, fontWeight: 'bold', color: COLORS.green },
  statusText: { marginTop: 10, fontSize: 14, fontWeight: '500', color: '#333', textAlign: 'center' },
  tipText: { marginTop: 6, fontSize: 12, color: '#666', textAlign: 'center', paddingHorizontal: 20 },
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
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(33,33,33,0.9)', alignItems: 'center', justifyContent: 'center', marginRight: 12, elevation: 4 },
  backIcon: { fontSize: 22, color: '#FFF', fontWeight: 'bold' },
  statusCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(33,33,33,0.9)', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, elevation: 4 },
  statusIcon: { fontSize: 18, marginRight: 8 },
  statusText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#FFF' },
  bottomCard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(179, 229, 206, 0.98)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, elevation: 12 },
  driverCard: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 14, marginBottom: 12 },
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
  contactLabel: { fontSize: 12, fontWeight: '500', color: '#000' },
  addressCard: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 14, marginBottom: 12 },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  addressIconWrap: { width: 28, alignItems: 'center', marginRight: 10 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red },
  addressDivider: { height: 20, marginLeft: 14, borderLeftWidth: 2, borderLeftColor: 'rgba(0,0,0,0.1)', borderStyle: 'dashed', marginVertical: 6 },
  addressContent: { flex: 1 },
  addressLabel: { fontSize: 11, color: '#666', marginBottom: 1 },
  addressText: { fontSize: 14, fontWeight: '500', color: '#000' },
  fareCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: 14, marginBottom: 12 },
  fareLabel: { fontSize: 14, color: '#333' },
  fareAmount: { fontSize: 18, fontWeight: 'bold', color: COLORS.green },
});

export default ActiveRideScreen;


