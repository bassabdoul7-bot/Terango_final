import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, Modal, Linking, Animated, BackHandler, Alert, Easing,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as PolylineUtil from '@mapbox/polyline';
import io from 'socket.io-client';
import COLORS from '../constants/colors';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { deliveryService } from '../services/api.service';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const SOCKET_URL = 'http://192.168.1.184:5000';

const STATUS_MAP = {
  pending: { label: 'Recherche de livreur...', color: '#FCD116', icon: '🔍' },
  accepted: { label: 'Livreur en route vers le point de collecte', color: '#00853F', icon: '🛵' },
  picked_up: { label: 'Colis recupere, en route vers vous', color: '#00853F', icon: '📦' },
  at_pickup: { label: 'Livreur arrive au point de collecte', color: '#4CD964', icon: '📍' },
  in_transit: { label: 'Livraison en cours...', color: '#00853F', icon: '🚀' },
  delivered: { label: 'Livre!', color: '#4CD964', icon: '✅' },
  cancelled: { label: 'Annulee', color: '#E31B23', icon: '✕' },
  no_drivers_available: { label: 'Aucun livreur disponible', color: '#E31B23', icon: '😔' },
};

const SearchingAnimation = ({ searchTime }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(dotAnim, { toValue: 1, duration: 2000, useNativeDriver: false })
    ).start();
  }, []);

  return (
    <View style={styles.searchingContainer}>
      <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={{ fontSize: 40 }}>🛵</Text>
      </Animated.View>
      <Text style={styles.searchingTitle}>Recherche d'un livreur...</Text>
      <Text style={styles.searchingTime}>{searchTime}s</Text>
    </View>
  );
};

const ActiveDeliveryScreen = ({ route, navigation }) => {
  const { deliveryId } = route.params;

  const [delivery, setDelivery] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [showNoDrivers, setShowNoDrivers] = useState(false);

  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const pollRef = useRef(null);
  const searchTimerRef = useRef(null);

  useEffect(() => {
    fetchDelivery();
    connectSocket();
    startPolling();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (pollRef.current) clearInterval(pollRef.current);
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (delivery && delivery.status === 'pending') {
      searchTimerRef.current = setInterval(() => {
        setSearchTime(prev => prev + 1);
      }, 1000);
    } else {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    }
    return () => { if (searchTimerRef.current) clearInterval(searchTimerRef.current); };
  }, [delivery?.status]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (delivery && ['pending', 'accepted', 'picked_up', 'at_pickup', 'in_transit'].includes(delivery.status)) {
        Alert.alert('Livraison en cours', 'Vous ne pouvez pas quitter pendant une livraison active.');
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [delivery]);

  const fetchDelivery = async () => {
    try {
      var res = await deliveryService.getDeliveryById(deliveryId);
      if (res.delivery) {
        setDelivery(res.delivery);
        if (res.delivery.driver) {
          setDriverInfo(res.delivery.driver);
        }
        if (res.delivery.status === 'no_drivers_available') {
          setShowNoDrivers(true);
        }
        if (res.delivery.status === 'delivered') {
          navigation.replace('Home');
        }
        getDirections(res.delivery);
      }
      setLoading(false);
    } catch (err) {
      console.log('Fetch delivery error:', err);
      setLoading(false);
    }
  };

  const connectSocket = () => {
    var socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Delivery socket connected');
      socket.emit('join-delivery-room', deliveryId);
    });

    socket.on('delivery-accepted-' + deliveryId, (data) => {
      console.log('Delivery accepted:', data);
      setDelivery(prev => prev ? { ...prev, status: 'accepted', driver: data.driver } : prev);
      setDriverInfo(data.driver);
    });

    socket.on('delivery-status-' + deliveryId, (data) => {
      console.log('Delivery status update:', data);
      setDelivery(prev => prev ? { ...prev, status: data.status } : prev);
      if (data.status === 'delivered') {
        setTimeout(() => navigation.replace('Home'), 3000);
      }
    });

    socket.on('delivery-expired-' + deliveryId, () => {
      setShowNoDrivers(true);
      setDelivery(prev => prev ? { ...prev, status: 'no_drivers_available' } : prev);
    });

    socket.on('delivery-cancelled-' + deliveryId, () => {
      Alert.alert('Livraison annulee', 'La livraison a ete annulee.');
      navigation.replace('Home');
    });
  };

  const startPolling = () => {
    pollRef.current = setInterval(fetchDelivery, 8000);
  };

  const getDirections = async (del) => {
    if (!del || !del.pickup || !del.dropoff) return;
    try {
      var origin = del.pickup.coordinates.latitude + ',' + del.pickup.coordinates.longitude;
      var dest = del.dropoff.coordinates.latitude + ',' + del.dropoff.coordinates.longitude;
      var url = 'https://maps.googleapis.com/maps/api/directions/json?origin=' + origin + '&destination=' + dest + '&key=' + GOOGLE_MAPS_KEY;
      var response = await fetch(url);
      var data = await response.json();
      if (data.status === 'OK' && data.routes[0]) {
        var points = PolylineUtil.decode(data.routes[0].overview_polyline.points);
        var coords = points.map(function(p) { return { latitude: p[0], longitude: p[1] }; });
        setRouteCoords(coords);
        if (data.routes[0].legs && data.routes[0].legs[0]) {
          setEta(data.routes[0].legs[0].duration.text);
        }
      }
    } catch (err) {
      console.log('Directions error:', err);
    }
  };

  const handleCancel = async (reason) => {
    setCancelling(true);
    try {
      await deliveryService.cancelDelivery(deliveryId, reason || 'Annulee par le client');
      setShowCancelModal(false);
      navigation.replace('Home');
    } catch (err) {
      Alert.alert('Erreur', 'Impossible d\'annuler la livraison');
    } finally {
      setCancelling(false);
    }
  };

  const callDriver = () => {
    if (driverInfo && driverInfo.phone) {
      Linking.openURL('tel:' + driverInfo.phone);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  var statusInfo = STATUS_MAP[delivery?.status] || STATUS_MAP.pending;
  var canCancel = delivery && ['pending', 'accepted'].includes(delivery.status);

  var initialRegion = delivery ? {
    latitude: delivery.pickup.coordinates.latitude,
    longitude: delivery.pickup.coordinates.longitude,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  } : { latitude: 14.7167, longitude: -17.4677, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={WAZE_DARK_STYLE}
        initialRegion={initialRegion}
        showsUserLocation={true}
      >
        {delivery && (
          <>
            <Marker coordinate={{ latitude: delivery.pickup.coordinates.latitude, longitude: delivery.pickup.coordinates.longitude }} title="Collecte" pinColor={COLORS.green} />
            <Marker coordinate={{ latitude: delivery.dropoff.coordinates.latitude, longitude: delivery.dropoff.coordinates.longitude }} title="Livraison" pinColor={COLORS.red} />
          </>
        )}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor={COLORS.green} />
        )}
        {driverLocation && (
          <Marker coordinate={driverLocation}>
            <View style={styles.driverMarker}><Text style={{ fontSize: 20 }}>🛵</Text></View>
          </Marker>
        )}
      </MapView>

      <View style={styles.statusBar}>
        <Text style={{ fontSize: 18 }}>{statusInfo.icon}</Text>
        <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        {eta && delivery?.status !== 'no_drivers_available' && delivery?.status !== 'pending' && <Text style={{ fontSize: 13, color: '#FCD116', fontWeight: '600' }}>{eta}</Text>}
      </View>

      {delivery?.status === 'pending' && !showNoDrivers && (
        <SearchingAnimation searchTime={searchTime} />
      )}

      {showNoDrivers && (
        <View style={styles.noDriverCard}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>😔</Text>
          <Text style={styles.noDriverTitle}>Aucun livreur disponible</Text>
          <Text style={styles.noDriverSub}>Veuillez reessayer dans quelques minutes</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.replace('Home')}>
            <Text style={styles.retryBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      )}

      {driverInfo && delivery?.status !== 'pending' && delivery?.status !== 'no_drivers_available' && (
        <View style={styles.driverCard}>
          <View style={styles.driverAvatar}>
            <Text style={{ fontSize: 24, color: '#fff' }}>{(driverInfo.firstName || 'L')[0]}</Text>
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{(driverInfo.firstName || '') + ' ' + (driverInfo.lastName || '')}</Text>
            <Text style={styles.driverVehicle}>{driverInfo.vehicleType || 'Moto'}</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={callDriver}>
            <Text style={{ fontSize: 20 }}>📞</Text>
          </TouchableOpacity>
        </View>
      )}

      {delivery && (
        <View style={styles.bottomCard}>
          <View style={styles.addressRow}>
            <View style={styles.greenDot} />
            <Text style={styles.addressText} numberOfLines={1}>{delivery.pickup.address}</Text>
          </View>
          <View style={styles.dashedLine} />
          <View style={styles.addressRow}>
            <View style={styles.redSquare} />
            <Text style={styles.addressText} numberOfLines={1}>{delivery.dropoff.address}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={styles.fareLabel}>{(delivery.serviceType || 'colis').toUpperCase()}</Text>
            <Text style={styles.fareValue}>{(delivery.fare || 0).toLocaleString()} FCFA</Text>
          </View>
          {canCancel && (
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCancelModal(true)}>
              <Text style={styles.cancelBtnText}>Annuler la livraison</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Annuler la livraison?</Text>
            <Text style={styles.modalSub}>Etes-vous sur de vouloir annuler?</Text>
            <TouchableOpacity style={styles.modalConfirmBtn} onPress={() => handleCancel('Annulee par le client')} disabled={cancelling}>
              {cancelling ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Oui, annuler</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCancelModal(false)}>
              <Text style={styles.modalCancelText}>Non, continuer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { flex: 1 },
  loadingScreen: { flex: 1, backgroundColor: '#0a0f14', alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#fff', marginTop: 16, fontSize: 16 },
  statusBar: {
    position: 'absolute', top: 60, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(20,25,30,0.9)', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(179,229,206,0.25)',
  },
  statusText: { fontSize: 14, fontWeight: '600', flex: 1 },
  searchingContainer: {
    position: 'absolute', top: height * 0.3, alignSelf: 'center', alignItems: 'center',
  },
  pulseCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(252,209,22,0.2)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FCD116', marginBottom: 16,
  },
  searchingTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  searchingTime: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  noDriverCard: {
    position: 'absolute', top: height * 0.25, left: 30, right: 30,
    backgroundColor: 'rgba(20,25,30,0.95)', borderRadius: 24, padding: 30,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(179,229,206,0.25)',
  },
  noDriverTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  noDriverSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: '#FCD116', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  retryBtnText: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  driverCard: {
    position: 'absolute', bottom: 290, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(179,229,206,0.95)', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  driverAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  driverDetails: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  driverVehicle: { fontSize: 13, color: '#333', marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FCD116', alignItems: 'center', justifyContent: 'center',
  },
  driverMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(252,209,22,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  bottomCard: {
    position: 'absolute', bottom: 30, left: 16, right: 16,
    backgroundColor: 'rgba(179,229,206,0.95)', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green, marginRight: 12 },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red, marginRight: 12 },
  dashedLine: { height: 16, marginLeft: 6, borderLeftWidth: 2, borderLeftColor: 'rgba(0,0,0,0.2)', borderStyle: 'dashed', marginVertical: 2 },
  addressText: { flex: 1, fontSize: 14, color: '#000', fontWeight: '500' },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  fareLabel: { fontSize: 13, color: '#333', fontWeight: '600' },
  fareValue: { fontSize: 20, fontWeight: 'bold', color: '#000' },
  cancelBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(227,27,35,0.1)', alignItems: 'center', borderWidth: 1, borderColor: '#E31B23' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#E31B23' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#1a1f24', borderRadius: 24, padding: 30, width: width - 60, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(179,229,206,0.25)' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  modalSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24, textAlign: 'center' },
  modalConfirmBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: '#E31B23', alignItems: 'center', marginBottom: 12 },
  modalConfirmText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  modalCancelBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  modalCancelText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});

export default ActiveDeliveryScreen;



