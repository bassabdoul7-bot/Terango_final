import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Modal, Linking, Animated, BackHandler, Alert, Easing } from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

const TERANGO_STYLE = require('../constants/terangoMapStyle.json');
import * as PolylineUtil from '@mapbox/polyline';
import { Audio } from 'expo-av';
import { createAuthSocket } from '../services/socket';
import COLORS from '../constants/colors';
import { deliveryService } from '../services/api.service';
import ChatScreen from './ChatScreen';

const { width, height } = Dimensions.get('window');

var STATUS_MAP = {
  pending: { label: 'Recherche de livreur...', color: COLORS.yellow, icon: '\uD83D\uDD0D' },
  accepted: { label: 'Livreur en route vers le point de collecte', color: COLORS.green, icon: '\uD83D\uDEB5' },
  at_pickup: { label: 'Livreur arrive au point de collecte', color: COLORS.green, icon: '\uD83D\uDCCD' },
  picked_up: { label: 'Colis recupere, en route vers vous', color: COLORS.green, icon: '\uD83D\uDCE6' },
  at_dropoff: { label: 'Livreur arrive au point de livraison', color: COLORS.green, icon: '\uD83D\uDCCD' },
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
      <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]}><Text style={{ fontSize: 40 , fontFamily: 'LexendDeca_400Regular' }}>{'\uD83D\uDEB5'}</Text></Animated.View>
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
  var deliveredState = useState(false); var showDelivered = deliveredState[0]; var setShowDelivered = deliveredState[1];
  var chatState = useState(false); var showChat = chatState[0]; var setShowChat = chatState[1];
  var mapRef = useRef(null); var socketRef = useRef(null); var pollRef = useRef(null); var searchTimerRef = useRef(null);

  // ========== EMERGENCY RECORDING ==========
  var recState = useState(false); var isRecording = recState[0]; var setIsRecording = recState[1];
  var recTimeState = useState(0); var recordingTime = recTimeState[0]; var setRecordingTime = recTimeState[1];
  var uploadingRecState = useState(false); var uploadingRecording = uploadingRecState[0]; var setUploadingRecording = uploadingRecState[1];
  var recordingRef = useRef(null);
  var recordingTimerRef = useRef(null);
  var recordingPulse = useRef(new Animated.Value(1)).current;
  var MAX_RECORDING_SECONDS = 300;

  function startEmergencyRecording() {
    Audio.requestPermissionsAsync().then(function(permission) {
      if (permission.status !== 'granted') { Alert.alert('Permission requise', 'Activez le microphone pour enregistrer.'); return; }
      Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true }).then(function() {
        var recording = new Audio.Recording();
        recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY).then(function() {
          recording.startAsync().then(function() {
            recordingRef.current = recording;
            setIsRecording(true);
            setRecordingTime(0);
            recordingTimerRef.current = setInterval(function() {
              setRecordingTime(function(prev) {
                if (prev + 1 >= MAX_RECORDING_SECONDS) { stopEmergencyRecording(); return prev; }
                return prev + 1;
              });
            }, 1000);
            Animated.loop(Animated.sequence([
              Animated.timing(recordingPulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
              Animated.timing(recordingPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
            ])).start();
          });
        });
      });
    }).catch(function(err) { console.error('Start recording error:', err); Alert.alert('Erreur', "Impossible de demarrer l'enregistrement"); });
  }

  function stopEmergencyRecording() {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    recordingPulse.stopAnimation();
    recordingPulse.setValue(1);
    if (!recordingRef.current) { setIsRecording(false); return; }
    var duration = recordingTime;
    recordingRef.current.stopAndUnloadAsync().then(function() {
      Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      var uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      if (!uri) return;
      setUploadingRecording(true);
      deliveryService.uploadEmergencyRecording(deliveryId, uri, duration).then(function() {
        Alert.alert('Enregistrement sauvegarde', "L'enregistrement d'urgence a ete envoye.");
      }).catch(function(err) {
        console.error('Upload recording error:', err);
        Alert.alert('Erreur', "Impossible d'envoyer l'enregistrement.");
      }).finally(function() { setUploadingRecording(false); });
    }).catch(function(err) { console.error('Stop recording error:', err); setIsRecording(false); });
  }

  useEffect(function() {
    return function() {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recordingRef.current) { try { recordingRef.current.stopAndUnloadAsync(); } catch (e) {} }
    };
  }, []);

  useEffect(function() { fetchDelivery(); connectSocket(); startPolling(); return function() { if (socketRef.current) socketRef.current.disconnect(); if (pollRef.current) clearInterval(pollRef.current); if (searchTimerRef.current) clearInterval(searchTimerRef.current); }; }, []);
  useEffect(function() { if (delivery && delivery.status === 'pending') { searchTimerRef.current = setInterval(function() { setSearchTime(function(p) { return p + 1; }); }, 1000); } else { if (searchTimerRef.current) clearInterval(searchTimerRef.current); } return function() { if (searchTimerRef.current) clearInterval(searchTimerRef.current); }; }, [delivery ? delivery.status : null]);
  useEffect(function() { var bh = BackHandler.addEventListener('hardwareBackPress', function() { if (delivery && ['pending', 'accepted', 'picked_up', 'at_pickup', 'in_transit'].indexOf(delivery.status) !== -1) { Alert.alert('Livraison en cours', 'Vous ne pouvez pas quitter.'); return true; } return false; }); return function() { bh.remove(); }; }, [delivery]);
  useEffect(function() { if (delivery && delivery.driver && ['accepted', 'picked_up', 'at_pickup', 'in_transit'].indexOf(delivery.status) !== -1) { getDirections(delivery); } }, [delivery ? delivery.status : null, delivery ? delivery.driver : null]);

  function fetchDelivery() {
    deliveryService.getDeliveryById(deliveryId).then(function(res) {
      if (res.delivery) { setDelivery(res.delivery); if (res.delivery.driver) setDriverInfo(res.delivery.driver); if (res.delivery.status === 'no_drivers_available') setShowNoDrivers(true); if (res.delivery.status === 'delivered') setShowDelivered(true); if (res.delivery.status === 'cancelled') { clearInterval(pollRef.current); Alert.alert('Livraison annul\u00e9e', 'La livraison a \u00e9t\u00e9 annul\u00e9e.', [{ text: 'OK', onPress: function() { navigation.replace('Home'); } }]); return; } } setLoading(false);
    }).catch(function() { setLoading(false); });
  }

  function connectSocket() {
    createAuthSocket().then(function(socket) { socketRef.current = socket;
      socket.on('connect', function() { socket.emit('join-delivery-room', deliveryId); });
      socket.on('delivery-accepted', function(data) { setDelivery(function(p) { return p ? Object.assign({}, p, { status: 'accepted', driver: data.driver }) : p; }); setDriverInfo(data.driver); });
      socket.on('delivery-status', function(data) { setDelivery(function(p) { return p ? Object.assign({}, p, { status: data.status }) : p; }); if (data.status === 'delivered') setShowDelivered(true); });
      socket.on('delivery-expired', function() { setShowNoDrivers(true); setDelivery(function(p) { return p ? Object.assign({}, p, { status: 'no_drivers_available' }) : p; }); });
      socket.on('delivery-cancelled', function() { Alert.alert('Livraison annulee', 'La livraison a ete annulee.'); navigation.replace('Home'); });
    });
  }

  function startPolling() { pollRef.current = setInterval(fetchDelivery, 8000); }

  function getDirections(del) {
    if (!del || !del.pickup || !del.dropoff) return;
    var origin = del.pickup.coordinates.latitude + ',' + del.pickup.coordinates.longitude;
    var dest = del.dropoff.coordinates.latitude + ',' + del.dropoff.coordinates.longitude;
    fetch('https://osrm.terango.sn/route/v1/driving/' + origin + ';' + dest + '?overview=full&geometries=polyline').then(function(r) { return r.json(); }).then(function(data) {
      if (data.code === 'Ok' && data.routes[0]) { var points = PolylineUtil.decode(data.routes[0].geometry); setRouteCoords(points.map(function(p) { return { latitude: p[0], longitude: p[1] }; })); if (data.routes[0].legs && data.routes[0].legs[0]) { var dur = data.routes[0].legs[0].duration; setEta(dur < 60 ? Math.round(dur) + ' sec' : Math.round(dur/60) + ' min'); } }
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
      <Map ref={mapRef} style={styles.map} mapStyle={TERANGO_STYLE} logo={false} attribution={false}>
        <Camera center={[initialRegion.longitude, initialRegion.latitude]} zoom={13} />
        {delivery && (
          <>
            <Marker id="pickup" lngLat={[delivery.pickup.coordinates.longitude, delivery.pickup.coordinates.latitude]}>
              <View style={styles.pickupMarker}><View style={styles.pickupDot} /></View>
            </Marker>
            <Marker id="dropoff" lngLat={[delivery.dropoff.coordinates.longitude, delivery.dropoff.coordinates.latitude]}>
              <View style={styles.dropoffMarker}><View style={styles.dropoffDot} /></View>
            </Marker>
          </>
        )}
        {routeCoords.length > 0 && (
          <GeoJSONSource id="routeSource" data={{ type: "Feature", geometry: { type: "LineString", coordinates: routeCoords.map(c => [c.longitude, c.latitude]) } }}>
            <Layer type="line" id="routeLine" paint={{ "line-color": "#FFFFFF", "line-width": 4  }} layout={{ "line-cap": "round", "line-join": "round" }} />
          </GeoJSONSource>
        )}
        {driverLocation && (
          <Marker id="driver" lngLat={[driverLocation.longitude, driverLocation.latitude]}>
            <View style={styles.driverMarker}><Text style={{ fontSize: 20, fontFamily: "LexendDeca_400Regular" }}>{"\uD83D\uDEB5"}</Text></View>
          </Marker>
        )}
      </Map>

      <View style={styles.statusBar}><Text style={{ fontSize: 18 , fontFamily: 'LexendDeca_400Regular' }}>{statusInfo.icon}</Text><Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>{eta && delivery && delivery.status !== 'no_drivers_available' && delivery.status !== 'pending' && <Text style={styles.etaText}>{eta}</Text>}</View>

      {delivery && ['accepted', 'at_pickup', 'picked_up', 'in_transit'].indexOf(delivery.status) !== -1 && (
        <View style={sosDeliveryStyles.container}>
          {isRecording ? (
            <View style={sosDeliveryStyles.recordingRow}>
              <Animated.View style={[sosDeliveryStyles.pulseDot, { transform: [{ scale: recordingPulse }] }]} />
              <Text style={sosDeliveryStyles.timerText}>{Math.floor(recordingTime / 60) + ':' + (recordingTime % 60).toString().padStart(2, '0')}</Text>
              <TouchableOpacity style={sosDeliveryStyles.stopBtn} onPress={stopEmergencyRecording}>
                <Text style={sosDeliveryStyles.stopBtnText}>Arreter</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={sosDeliveryStyles.sosBtn} onPress={startEmergencyRecording} disabled={uploadingRecording}>
              {uploadingRecording ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={sosDeliveryStyles.sosIcon}>{String.fromCodePoint(0x1F3A4)}</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      {delivery && delivery.status === 'pending' && !showNoDrivers && <SearchingAnimation searchTime={searchTime} />}

      {showNoDrivers && (
        <View style={styles.noDriverCard}><Text style={{ fontSize: 48, marginBottom: 12 , fontFamily: 'LexendDeca_400Regular' }}>{'\uD83D\uDE1E'}</Text><Text style={styles.noDriverTitle}>Aucun livreur disponible</Text><Text style={styles.noDriverSub}>Veuillez reessayer dans quelques minutes</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={function() { navigation.replace('Home'); }}><Text style={styles.retryBtnText}>Retour</Text></TouchableOpacity>
        </View>
      )}

      {driverInfo && delivery && delivery.status !== 'pending' && delivery.status !== 'no_drivers_available' && (
        <View style={styles.driverCard}><View style={styles.driverAvatar}><Text style={{ fontSize: 24, color: '#fff' , fontFamily: 'LexendDeca_400Regular' }}>{(driverInfo.firstName || 'L')[0]}</Text></View>
          <View style={styles.driverDetails}><Text style={styles.driverName}>{(driverInfo.firstName || '') + ' ' + (driverInfo.lastName || '')}</Text><Text style={styles.driverVehicle}>{driverInfo.vehicleType || 'Moto'}</Text></View>
          <View style={{ flexDirection: 'row', gap: 8 }}><TouchableOpacity style={styles.chatBtnSmall} onPress={function() { setShowChat(true); }}><Text style={{ fontSize: 20 , fontFamily: 'LexendDeca_400Regular' }}>{String.fromCodePoint(0x1F4AC)}</Text></TouchableOpacity><TouchableOpacity style={styles.callBtn} onPress={callDriver}><Text style={{ fontSize: 20 , fontFamily: 'LexendDeca_400Regular' }}>{String.fromCodePoint(0x1F4DE)}</Text></TouchableOpacity></View>
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

      {showDelivered && (
        <View style={styles.deliveredOverlay}>
          <View style={styles.deliveredCard}>
            <Text style={{fontSize:48,marginBottom:12}}>{'\u2705'}</Text>
            <Text style={styles.deliveredTitle}>Livraison effectuee!</Text>
            <Text style={styles.deliveredSub}>{'Votre ' + (delivery && delivery.serviceType === 'colis' ? 'colis' : 'commande') + ' a ete livre avec succes.'}</Text>
            {delivery && delivery.fare && <Text style={styles.deliveredFare}>{delivery.fare.toLocaleString() + ' FCFA'}</Text>}
            {delivery && delivery.paymentMethod === 'wave' && <Text style={styles.deliveredWave}>{'\uD83C\uDF0A Paye par Wave'}</Text>}
            <TouchableOpacity style={styles.deliveredBtn} onPress={function() { navigation.replace('Home'); }}>
              <Text style={styles.deliveredBtnText}>Retour a l'accueil</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { flex: 1 },
  loadingScreen: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textDarkSub, marginTop: 16, fontSize: 16 , fontFamily: 'LexendDeca_400Regular' },
  statusBar: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(212,175,55,0.7)', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)' },
  statusText: { fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', flex: 1 },
  etaText: { fontSize: 13, color: COLORS.yellow, fontFamily: 'LexendDeca_600SemiBold' },
  searchingContainer: { position: 'absolute', top: height * 0.3, alignSelf: 'center', alignItems: 'center' },
  pulseCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(212,175,55,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.yellow, marginBottom: 16 },
  searchingTitle: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: COLORS.textDark },
  searchingTime: { fontSize: 14, color: COLORS.textDarkMuted, marginTop: 4 , fontFamily: 'LexendDeca_400Regular' },
  noDriverCard: { position: 'absolute', top: height * 0.25, left: 30, right: 30, backgroundColor: COLORS.darkCard, borderRadius: 24, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: COLORS.darkCardBorder },
  noDriverTitle: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 8 },
  noDriverSub: { fontSize: 14, color: COLORS.textLightMuted, textAlign: 'center', marginBottom: 20 , fontFamily: 'LexendDeca_400Regular' },
  retryBtn: { backgroundColor: COLORS.yellow, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  retryBtnText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  driverCard: { position: 'absolute', bottom: 290, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  driverAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  driverDetails: { flex: 1 },
  driverName: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight },
  driverVehicle: { fontSize: 13, color: COLORS.textLightMuted, marginTop: 2 , fontFamily: 'LexendDeca_400Regular' },
  chatBtnSmall: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(66,133,244,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(66,133,244,0.3)' },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  driverMarker: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  bottomCard: { position: 'absolute', bottom: 30, left: 16, right: 16, backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green, marginRight: 12 },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red, marginRight: 12 },
  dashedLine: { height: 16, marginLeft: 6, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.12)', borderStyle: 'dashed', marginVertical: 2 },
  addressText: { flex: 1, fontSize: 14, color: COLORS.textLightSub, fontFamily: 'LexendDeca_500Medium' },
  fareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  fareLabel: { fontSize: 13, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_600SemiBold' },
  fareValue: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },
  cancelBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(227,27,35,0.1)', alignItems: 'center', borderWidth: 1, borderColor: '#E31B23' },
  cancelBtnText: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: '#E31B23' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: COLORS.darkCard, borderRadius: 24, padding: 30, width: width - 60, alignItems: 'center', borderWidth: 1, borderColor: COLORS.darkCardBorder },
  modalTitle: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 8 },
  modalSub: { fontSize: 14, color: COLORS.textLightMuted, marginBottom: 24, textAlign: 'center' , fontFamily: 'LexendDeca_400Regular' },
  modalConfirmBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: '#E31B23', alignItems: 'center', marginBottom: 12 },
  modalConfirmText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#fff' },
  modalCancelBtn: { width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  modalCancelText: { fontSize: 16, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightSub },
  deliveredOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,26,18,0.95)', justifyContent: 'center', alignItems: 'center' },
  deliveredCard: { backgroundColor: COLORS.darkCard, borderRadius: 24, padding: 32, width: width - 48, alignItems: 'center', borderWidth: 1, borderColor: COLORS.darkCardBorder },
  deliveredTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: COLORS.green, marginBottom: 8 },
  deliveredSub: { fontSize: 14, fontFamily: 'LexendDeca_400Regular', color: COLORS.textLightMuted, textAlign: 'center', marginBottom: 16 },
  deliveredFare: { fontSize: 28, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow, marginBottom: 8 },
  deliveredWave: { fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', color: '#1DC3E1', marginBottom: 20 },
  deliveredBtn: { width: '100%', paddingVertical: 16, borderRadius: 14, backgroundColor: COLORS.green, alignItems: 'center' },
  deliveredBtnText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF' },
});

var sosDeliveryStyles = StyleSheet.create({
  container: { position: 'absolute', top: 110, right: 20, zIndex: 20 },
  sosBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E31B23', alignItems: 'center', justifyContent: 'center', elevation: 8, borderWidth: 2, borderColor: 'rgba(227,27,35,0.5)' },
  sosIcon: { fontSize: 22 },
  recordingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(227,27,35,0.9)', borderRadius: 24, paddingVertical: 10, paddingHorizontal: 14, gap: 10, elevation: 8 },
  pulseDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FF4444' },
  timerText: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF' },
  stopBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 6, paddingHorizontal: 14 },
  stopBtnText: { fontSize: 13, fontFamily: 'LexendDeca_700Bold', color: '#E31B23' },
});

export default ActiveDeliveryScreen;









