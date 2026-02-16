import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Modal, Linking, Animated, BackHandler, Alert, Easing } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as PolylineUtil from '@mapbox/polyline';
import { createAuthSocket } from '../services/socket';
import COLORS from '../constants/colors';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { deliveryService } from '../services/api.service';
import ChatScreen from './ChatScreen';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

var STATUS_MAP = {
  pending: { label: 'Recherche de livreur...', color: COLORS.yellow, icon: '\uD83D\uDD0D' },
  accepted: { label: 'Livreur en route vers le point de collecte', color: COLORS.green, icon: '\uD83D\uDEB5' },
  picked_up: { label: 'Colis recupere, en route vers vous', color: COLORS.green, icon: '\uD83D\uDCE6' },
  at_pickup: { label: 'Livreur arrive au point de collecte', color: COLORS.green, icon: '\uD83D\uDCCD' },
  in_transit: { label: 'Livraison en cours...', color: COLORS.green, icon: '\uD83D\uDE80' },
  delivered: { label: 'Livre!', color: COLORS.green, icon: '\u2705' },
  cancelled: { label: 'Annulee', color: COLORS.red, icon: '\u2715' },
  no_drivers_available: { label: 'Aucun livreur disponible', color: COLORS.red, icon: '\uD83D\uDE1E' },
};

var SearchingAnimation = function(props) {
  var searchTime = props.searchTime;
  var pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(function() { Animated.loop(Animated.sequence([Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })])).start(); }, []);
  return (
    <View style={styles.searchingContainer}>
      <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}><Text style={{ fontSize: 40 }}>{'\uD83D\uDEB5'}</Text></Animated.View>
      <Text style={styles.searchingTitle}>{"Recherche d'un livreur..."}</Text>
      <Text style={styles.searchingTime}>{searchTime + 's'}</Text>
    </View>
  );
};

var ActiveDeliveryScreen = function(props) {
  var navigation = props.navigation; var route = props.route;
  var deliveryId = route.params.deliveryId;
  var deliveryState = useState(null); var delivery = deliveryState[0]; var setDelivery = deliveryState[1];
  var driverInfoState = useState(null); var driverInfo = driverInfoState[0]; var setDriverInfo = driverInfoState[1];
  var driverLocState = useState(null); var driverLocation = driverLocState[0]; var setDriverLocation = driverLocState[1];
  var etaState = useState(null); var eta = etaState[0]; var setEta = etaState[1];
  var routeState = useState([]); var routeCoords = routeState[0]; var setRouteCoords = routeState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];
  var cancellingState = useState(false); var cancelling = cancellingState[0]; var setCancelling = cancellingState[1];
  var cancelModalState = useState(false); var showCancelModal = cancelModalState[0]; var setShowCancelModal = cancelModalState[1];
  var searchTimeState = useState(0); var searchTime = searchTimeState[0]; var setSearchTime = searchTimeState[1];
  var noDriversState = useState(false); var showNoDrivers = noDriversState[0]; var setShowNoDrivers = noDriversState[1];
  var chatState = useState(false); var showChat = chatState[0]; var setShowChat = chatState[1];
  var mapRef = useRef(null); var socketRef = useRef(null); var pollRef = useRef(null); var searchTimerRef = useRef(null);

  useEffect(function() { fetchDelivery(); connectSocket(); startPolling(); return function() { if (socketRef.current) socketRef.current.disconnect(); if (pollRef.current) clearInterval(pollRef.current); if (searchTimerRef.current) clearInterval(searchTimerRef.current); }; }, []);
  useEffect(function() { if (delivery && delivery.status === 'pending') { searchTimerRef.current = setInterval(function() { setSearchTime(function(p) { return p + 1; }); }, 1000); } else { if (searchTimerRef.current) clearInterval(searchTimerRef.current); } return function() { if (searchTimerRef.current) clearInterval(searchTimerRef.current); }; }, [delivery ? delivery.status : null]);
  useEffect(function() { var bh = BackHandler.addEventListener('hardwareBackPress', function() { if (delivery && ['pending', 'accepted', 'picked_up', 'at_pickup', 'in_transit'].indexOf(delivery.status) !== -1) { Alert.alert('Livraison en cours', 'Vous ne pouvez pas quitter.'); return true; } return false; }); return function() { bh.remove(); }; }, [delivery]);
  useEffect(function() { if (delivery && delivery.driver && ['accepted', 'picked_up', 'at_pickup', 'in_transit'].indexOf(delivery.status) !== -1) { getDirections(delivery); } }, [delivery ? delivery.status : null, delivery ? delivery.driver : null]);

  function fetchDelivery() {
    deliveryService.getDeliveryById(deliveryId).then(function(res) {
      if (res.delivery) { setDelivery(res.delivery); if (res.delivery.driver) setDriverInfo(res.delivery.driver); if (res.delivery.status === 'no_drivers_available') setShowNoDrivers(true); if (res.delivery.status === 'delivered') navigation.replace('Home'); if (res.delivery.status === 'cancelled') { clearInterval(pollRef.current); Alert.alert('Livraison annul\u00e9e', 'La livraison a \u00e9t\u00e9 annul\u00e9e.', [{ text: 'OK', onPress: function() { navigation.replace('Home'); } }]); return; } } setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  function connectSocket() {
    createAuthSocket().then(function(socket) { socketRef.current = socket;
      socket.on('connect', function() { socket.emit('join-delivery-room', deliveryId); });
      socket.on('delivery-accepted', function(data) { setDelivery(function(p) { return p ? Object.assign({}, p, { status: 'accepted', driver: data.driver }) : p; }); setDriverInfo(data.driver); });
      socket.on('delivery-status', function(data) { setDelivery(function(p) { return p ? Object.assign({}, p, { status: data.status }) : p; }); if (data.status === 'delivered') setTimeout(function() { navigation.replace('Home'); }, 3000); });
      socket.on('delivery-expired', function() { setShowNoDrivers(true); setDelivery(function(p) { return p ? Object.assign({}, p, { status: 'no_drivers_available' }) : p; }); });
      socket.on('delivery-cancelled', function() { Alert.alert('Livraison annulee', 'La livraison a ete annulee.'); navigation.replace('Home'); });
    });
  }

  function startPolling() { pollRef.current = setInterval(fetchDelivery, 8000); }

  function getDirections(del) {
    if (!del || !del.pickup || !del.dropoff) return;
    var origin = del.pickup.coordinates.latitude + ',' + del.pickup.coordinates.longitude;
    var dest = del.dropoff.coordinates.latitude + ',' + del.dropoff.coordinates.longitude;
    fetch('https://maps.googleapis.com/maps/api/directions/json?origin=' + origin + '&destination=' + dest + '&key=' + GOOGLE_MAPS_KEY).then(function(r) { return r.json(); }).then(function(data) {
      if (data.status === 'OK' && data.routes[0]) { var points = PolylineUtil.decode(data.routes[0].overview_polyline.points); setRouteCoords(points.map(function(p) { return { latitude: p[0], longitude: p[1] }; })); if (data.routes[0].legs && data.routes[0].legs[0]) setEta(data.routes[0].legs[0].duration.text); }
    }).catch(function() {});
  }

  function handleCancel(reason) {
    setCancelling(true);
    deliveryService.cancelDelivery(deliveryId, reason || 'Annulee par le client').then(function() { setShowCancelModal(false); navigation.replace('Home'); }).catch(function() { Alert.alert('Erreur', "Impossible d'annuler"); }).finally(function() { setCancelling(false); });
  }

  function callDriver() { if (driverInfo && driverInfo.phone) Linking.openURL('tel:' + driverInfo.phone); }

  if (loading) return (<View style={styles.loadingScreen}><ActivityIndicator size="large" color={COLORS.green} /><Text style={styles.loadingText}>Chargement...</Text></View>);

  var statusInfo = STATUS_MAP[delivery ? delivery.status : 'pending'] || STATUS_MAP.pending;
  var canCancel = delivery && ['pending', 'accepted'].indexOf(delivery.status) !== -1;
  var initialRegion = delivery ? { latitude: delivery.pickup.coordinates.latitude, longitude: delivery.pickup.coordinates.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 } : { latitude: 14.7167, longitude: -17.4677, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE} customMapStyle={WAZE_DARK_STYLE} initialRegion={initialRegion} showsUserLocation={true}>
        {delivery && (<><Marker coordinate={{ latitude: delivery.pickup.coordinates.latitude, longitude: delivery.pickup.coordinates.longitude }} title="Collecte" pinColor={COLORS.green} /><Marker coordinate={{ latitude: delivery.dropoff.coordinates.latitude, longitude: delivery.dropoff.coordinates.longitude }} title="Livraison" pinColor={COLORS.red} /></>)}
        {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="#4285F4" />}
        {driverLocation && <Marker coordinate={driverLocation}><View style={styles.driverMarker}><Text style={{ fontSize: 20 }}>{'\uD83D\uDEB5'}</Text></View></Marker>}
      </MapView>

      <View style={styles.statusBar}><Text style={{ fontSize: 18 }}>{statusInfo.icon}</Text><Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>{eta && delivery && delivery.status !== 'no_drivers_available' && delivery.status !== 'pending' && <Text style={styles.etaText}>{eta}</Text>}</View>

      {delivery && delivery.status === 'pending' && !showNoDrivers && <SearchingAnimation searchTime={searchTime} />}

      {showNoDrivers && (
        <View style={styles.noDriverCard}><Text style={{ fontSize: 48, marginBottom: 12 }}>{'\uD83D\uDE1E'}</Text><Text style={styles.noDriverTitle}>Aucun livreur disponible</Text><Text style={styles.noDriverSub}>Veuillez reessayer dans quelques minutes</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={function() { navigation.replace('Home'); }}><Text style={styles.retryBtnText}>Retour</Text></TouchableOpacity>
        </View>
      )}

      {driverInfo && delivery && delivery.status !== 'pending' && delivery.status !== 'no_drivers_available' && (
        <View style={styles.driverCard}><View style={styles.driverAvatar}><Text style={{ fontSize: 24, color: '#fff' }}>{(driverInfo.firstName || 'L')[0]}</Text></View>
          <View style={styles.driverDetails}><Text style={styles.driverName}>{(driverInfo.firstName || '') + ' ' + (driverInfo.lastName || '')}</Text><Text style={styles.driverVehicle}>{driverInfo.vehicleType || 'Moto'}</Text></View>
          <View style={{ flexDirection: 'row', gap: 8 }}><TouchableOpacity style={styles.chatBtnSmall} onPress={function() { setShowChat(true); }}><Text style={{ fontSize: 20 }}>{String.fromCodePoint(0x1F4AC)}</Text></TouchableOpacity><TouchableOpacity style={styles.callBtn} onPress={callDriver}><Text style={{ fontSize: 20 }}>{String.fromCodePoint(0x1F4DE)}</Text></TouchableOpacity></View>
        </View>
      )}

      {delivery && (
        <View style={styles.bottomCard}>
          <View style={styles.addressRow}><View style={styles.greenDot} /><Text style={styles.addressText} numberOfLines={1}>{delivery.pickup.address}</Text></View>
          <View style={styles.dashedLine} />
          <View style={styles.addressRow}><View style={styles.redSquare} /><Text style={styles.addressText} numberOfLines={1}>{delivery.dropoff.address}</Text></View>
          <View style={styles.fareRow}><Text style={styles.fareLabel}>{(delivery.serviceType || 'colis').toUpperCase()}</Text><Text style={styles.fareValue}>{(delivery.fare || 0).toLocaleString() + ' FCFA'}</Text></View>
          {canCancel && <TouchableOpacity style={styles.cancelBtn} onPress={function() { setShowCancelModal(true); }}><Text style={styles.cancelBtnText}>Annuler la livraison</Text></TouchableOpacity>}
        </View>
      )}

      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}><View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Annuler la livraison?</Text><Text style={styles.modalSub}>{"Etes-vous s\u00fbr de vouloir annuler?"}</Text>
          <TouchableOpacity style={styles.modalConfirmBtn} onPress={function() { handleCancel('Annulee par le client'); }} disabled={cancelling}>{cancelling ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Oui, annuler</Text>}</TouchableOpacity>
          <TouchableOpacity style={styles.modalCancelBtn} onPress={function() { setShowCancelModal(false); }}><Text style={styles.modalCancelText}>Non, continuer</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={showChat} animationType="slide" onRequestClose={function() { setShowChat(false); }}>
        <ChatScreen socket={socketRef.current} rideId={null} deliveryId={deliveryId} myRole="rider" myUserId={null} otherName={driverInfo ? driverInfo.name : 'Livreur'} onClose={function() { setShowChat(false); }} />
      </Modal>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { flex: 1 },
  loadingScreen: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textDarkSub, marginTop: 16, fontSize: 16 },
  statusBar: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.darkCard, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  statusText: { fontSize: 14, fontWeight: '600', flex: 1 },
  etaText: { fontSize: 13, color: COLORS.yellow, fontWeight: '600' },
  searchingContainer: { position: 'absolute', top: height * 0.3, alignSelf: 'center', alignItems: 'center' },
  pulseCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(252,209,22,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.yellow, marginBottom: 16 },
  searchingTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textDark },
  searchingTime: { fontSize: 14, color: COLORS.textDarkMuted, marginTop: 4 },
  noDriverCard: { position: 'absolute', top: height * 0.25, left: 30, right: 30, backgroundColor: COLORS.darkCard, borderRadius: 24, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: COLORS.darkCardBorder },
  noDriverTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 8 },
  noDriverSub: { fontSize: 14, color: COLORS.textLightMuted, textAlign: 'center', marginBottom: 20 },
  retryBtn: { backgroundColor: COLORS.yellow, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  retryBtnText: { fontSize: 16, fontWeight: 'bold', color: COLORS.darkBg },
  driverCard: { position: 'absolute', bottom: 290, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  driverDetails: { flex: 1 },
  driverName: { fontSize: 16, fontWeight: 'bold', color: COLORS.textLight },
  driverVehicle: { fontSize: 13, color: COLORS.textLightMuted, marginTop: 2 },
  chatBtnSmall: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(66,133,244,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(66,133,244,0.3)' },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  driverMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  bottomCard: { position: 'absolute', bottom: 30, left: 16, right: 16, backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green, marginRight: 12 },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red, marginRight: 12 },
  dashedLine: { height: 16, marginLeft: 6, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.12)', borderStyle: 'dashed', marginVertical: 2 },
  addressText: { flex: 1, fontSize: 14, color: COLORS.textLightSub, fontWeight: '500' },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  fareLabel: { fontSize: 13, color: COLORS.textLightMuted, fontWeight: '600' },
  fareValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.yellow },
  cancelBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(227,27,35,0.1)', alignItems: 'center', borderWidth: 1, borderColor: '#E31B23' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#E31B23' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: COLORS.darkCard, borderRadius: 24, padding: 30, width: width - 60, alignItems: 'center', borderWidth: 1, borderColor: COLORS.darkCardBorder },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 8 },
  modalSub: { fontSize: 14, color: COLORS.textLightMuted, marginBottom: 24, textAlign: 'center' },
  modalConfirmBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: '#E31B23', alignItems: 'center', marginBottom: 12 },
  modalConfirmText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  modalCancelBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  modalCancelText: { fontSize: 16, fontWeight: '600', color: COLORS.textLightSub },
});

export default ActiveDeliveryScreen;
