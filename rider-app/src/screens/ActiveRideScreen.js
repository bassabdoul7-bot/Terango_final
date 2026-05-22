import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Image, Dimensions, Modal, Linking, Animated, ScrollView, BackHandler, Alert, Easing, AppState, Share } from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
const TERANGO_STYLE = require('../constants/terangoMapStyle.json');
import * as PolylineUtil from '@mapbox/polyline';
import { createAuthSocket } from '../services/socket';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';
import { rideService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';
import ChatScreen from './ChatScreen';
import CAR_IMAGES from '../constants/carImages';
import * as ImagePicker from 'expo-image-picker';
const { width, height } = Dimensions.get('window');
// ========== CONFETTI CELEBRATION COMPONENT ==========
const ConfettiCelebration = ({ visible }) => {
  const particles = useRef([...Array(30)].map(() => ({
    x: new Animated.Value(Math.random() * width),
    y: new Animated.Value(-20),
    rotate: new Animated.Value(0),
    opacity: new Animated.Value(1),
    color: ['#D4AF37', '#00853F', '#FF3B30', '#4285F4', '#FF9500'][Math.floor(Math.random() * 5)],
    size: 8 + Math.random() * 12,
  }))).current;
  useEffect(() => {
    if (!visible) return;
    particles.forEach((p, i) => {
      p.x.setValue(Math.random() * width);
      p.y.setValue(-20);
      p.opacity.setValue(1);
      p.rotate.setValue(0);
      Animated.parallel([
        Animated.timing(p.y, { toValue: height + 50, duration: 2500 + Math.random() * 1500, delay: i * 60, useNativeDriver: true }),
        Animated.timing(p.x, { toValue: Math.random() * width, duration: 2500 + Math.random() * 1500, delay: i * 60, useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: 10, duration: 2500, delay: i * 60, useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0, duration: 2500, delay: i * 60 + 1500, useNativeDriver: true }),
      ]).start();
    });
  }, [visible]);
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', width: p.size, height: p.size * 0.6,
          backgroundColor: p.color, borderRadius: 2,
          transform: [
            { translateX: p.x }, { translateY: p.y },
            { rotate: p.rotate.interpolate({ inputRange: [0, 10], outputRange: ['0deg', '720deg'] }) }
          ],
          opacity: p.opacity,
        }} />
      ))}
    </View>
  );
};
// ========== ANIMATED FARE COUNTER ==========
const AnimatedFareCounter = ({ targetFare }) => {
  const [displayFare, setDisplayFare] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!targetFare) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    const duration = 1500;
    const steps = 30;
    const increment = targetFare / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= targetFare) { setDisplayFare(targetFare); clearInterval(timer); }
      else setDisplayFare(Math.round(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [targetFare]);
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim, alignItems: 'center', marginVertical: 16 }}>
      <Text style={{ fontSize: 14, fontFamily: 'LexendDeca_500Medium', color: '#5a5a5a', marginBottom: 4 }}>Montant de la course</Text>
      <Text style={{ fontSize: 42, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow }}>{displayFare.toLocaleString()}</Text>
      <Text style={{ fontSize: 18, fontFamily: 'LexendDeca_600SemiBold', color: '#5a5a5a' }}>FCFA</Text>
    </Animated.View>
  );
};
const CancelModal = ({ visible, onClose, onConfirm, loading }) => {
  const [selectedReason, setSelectedReason] = useState(null);
  const reasons = [{id:1,label:"Temps d'attente trop long"},{id:2,label:"J'ai chang\u00e9 d'avis"},{id:3,label:"Le chauffeur m'a demand\u00e9 d'annuler"},{id:4,label:'Prix trop \u00e9lev\u00e9'},{id:5,label:"J'ai trouv\u00e9 un autre transport"},{id:6,label:'Autre raison'}];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cancelStyles.overlay}><View style={cancelStyles.modal}><View style={cancelStyles.handle} /><Text style={cancelStyles.title}>Annuler la course?</Text><Text style={cancelStyles.subtitle}>Dites-nous pourquoi</Text>
        <ScrollView style={cancelStyles.reasonsList} nestedScrollEnabled={true}>{reasons.map((r) => (<TouchableOpacity key={r.id} style={[cancelStyles.reasonItem, selectedReason === r.id && cancelStyles.reasonItemSelected]} onPress={() => setSelectedReason(r.id)}><View style={cancelStyles.radio}>{selectedReason === r.id && <View style={cancelStyles.radioInner} />}</View><Text style={cancelStyles.reasonText}>{r.label}</Text></TouchableOpacity>))}</ScrollView>
        <View style={cancelStyles.actions}><TouchableOpacity style={cancelStyles.backButton} onPress={onClose}><Text style={cancelStyles.backButtonText}>Retour</Text></TouchableOpacity><TouchableOpacity style={[cancelStyles.confirmButton, !selectedReason && cancelStyles.confirmButtonDisabled]} onPress={() => selectedReason && onConfirm(reasons.find(x => x.id === selectedReason).label)} disabled={!selectedReason || loading}>{loading ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={cancelStyles.confirmButtonText}>Confirmer</Text>}</TouchableOpacity></View>
      </View></View>
    </Modal>
  );
};
const SearchingAnimation = ({ searchTime, rideType }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const carPulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => { Animated.loop(Animated.sequence([Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })])).start(); Animated.loop(Animated.sequence([Animated.timing(orbitAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(orbitAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })])).start(); Animated.loop(Animated.sequence([Animated.timing(carPulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }), Animated.timing(carPulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })])).start(); }, []);
  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const getStatus = () => {
    if (searchTime < 10) return 'Recherche de chauffeurs...';
    if (searchTime < 25) return 'Expansion de la zone...';
    if (searchTime < 60) return 'Notification envoyee a tous les chauffeurs...';
    if (searchTime < 120) return 'Toujours en recherche, merci de patienter...';
    return 'Recherche en cours - jusqu\'a 5 minutes max';
  };
  // Encourage the rider to wait — empirical pattern: most pre-1-minute cancels
  // are pure impatience; the match would have landed within the next 30s.
  const getReassurance = () => {
    if (searchTime < 30) return null;
    if (searchTime < 90) return "Ne quittez pas - un chauffeur peut accepter a tout moment.";
    return "Plus long que d'habitude. Patientez ou reessayez dans quelques minutes.";
  };
  const reassurance = getReassurance();
  return (
    <View style={searchStyles.container}>
      <Animated.View style={[searchStyles.pulseCircle, searchStyles.pulseCircle1, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[searchStyles.pulseCircle, searchStyles.pulseCircle2, { transform: [{ scale: Animated.multiply(pulseAnim, 0.85) }] }]} />
      <View style={searchStyles.centerCircle} />
      <Animated.View style={[searchStyles.carContainer, { transform: [{ translateX: orbitAnim.interpolate({ inputRange: [0, 1], outputRange: [-35, 35] }) }, { translateY: orbitAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -8, 0] }) }, { scale: carPulseAnim }] }]}><View style={searchStyles.carIcon}><Image source={{ uri: (CAR_IMAGES[rideType] || CAR_IMAGES.standard).uri }} style={searchStyles.carImage} resizeMode="contain" /></View></Animated.View>
      <View style={searchStyles.timerContainer}><Text style={searchStyles.timerText}>{formatTime(searchTime)}</Text></View>
      <Text style={searchStyles.statusText}>{getStatus()}</Text>
      {reassurance && <Text style={searchStyles.tipText}>{reassurance}</Text>}
    </View>
  );
};
const NoDriversScreen = ({ ride, onRetry, onGoHome, retrying }) => (
  <View style={noDriversStyles.container}><View style={noDriversStyles.content}>
    <Text style={noDriversStyles.icon}>{"\uD83D\uDE14"}</Text><Text style={noDriversStyles.title}>Aucun chauffeur disponible</Text><Text style={noDriversStyles.subtitle}>{"D\u00e9sol\u00e9, aucun chauffeur disponible pour le moment."}</Text>
    <View style={noDriversStyles.rideInfo}><View style={noDriversStyles.addressRow}><View style={noDriversStyles.greenDot} /><Text style={noDriversStyles.addressText} numberOfLines={1}>{ride?.pickup?.address}</Text></View><View style={noDriversStyles.addressRow}><View style={noDriversStyles.redSquare} /><Text style={noDriversStyles.addressText} numberOfLines={1}>{ride?.dropoff?.address}</Text></View><Text style={noDriversStyles.fareText}>{ride?.fare?.toLocaleString()+' FCFA'}</Text></View>
    <TouchableOpacity style={noDriversStyles.retryButton} onPress={onRetry} disabled={retrying}>{retrying ? <ActivityIndicator color="#FFF" /> : <Text style={noDriversStyles.retryButtonText}>{"\uD83D\uDD04 R\u00e9essayer"}</Text>}</TouchableOpacity>
    <TouchableOpacity style={noDriversStyles.homeButton} onPress={onGoHome}><Text style={noDriversStyles.homeButtonText}>{"Retour \u00e0 l'accueil"}</Text></TouchableOpacity>
  </View></View>
);
const ActiveRideScreen = ({ route, navigation }) => {
  const { rideId: initialRideId } = route.params;
  const mapRef = useRef(null);
  const cameraRef = useRef(null); const socketRef = useRef(null); const pollInterval = useRef(null); const etaInterval = useRef(null); const searchTimerRef = useRef(null); const alertShownRef = useRef(false);
  const [showChat, setShowChat] = useState(false);
  const [rideId, setRideId] = useState(initialRideId); const [ride, setRide] = useState(null); const [loading, setLoading] = useState(true); const [routeCoordinates, setRouteCoordinates] = useState([]); const [driverLocation, setDriverLocation] = useState(null); const [eta, setEta] = useState(null); const [distance, setDistance] = useState(null); const [showCancelModal, setShowCancelModal] = useState(false); const [cancelling, setCancelling] = useState(false); const [searchTime, setSearchTime] = useState(0); const [showNoDrivers, setShowNoDrivers] = useState(false); const [retrying, setRetrying] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showFareAnimation, setShowFareAnimation] = useState(false);
  const [completedFare, setCompletedFare] = useState(0);
  // Animated car rotation for driver marker
  const driverRotation = useRef(new Animated.Value(0)).current;
  const prevDriverLoc = useRef(null);
  useEffect(() => { const bh = BackHandler.addEventListener('hardwareBackPress', () => { handleBackPress(); return true; }); return () => bh.remove(); }, [ride, showNoDrivers]);
  useEffect(() => { if (ride?.status === 'pending' && !showNoDrivers) { searchTimerRef.current = setInterval(() => setSearchTime(prev => prev + 1), 1000); } else if (searchTimerRef.current) { clearInterval(searchTimerRef.current); } return () => { if (searchTimerRef.current) clearInterval(searchTimerRef.current); }; }, [ride?.status, showNoDrivers]);
  // Calculate driver heading for smooth car rotation
  useEffect(() => {
    if (!driverLocation || !prevDriverLoc.current) { prevDriverLoc.current = driverLocation; return; }
    const dx = driverLocation.longitude - prevDriverLoc.current.longitude;
    const dy = driverLocation.latitude - prevDriverLoc.current.latitude;
    if (Math.abs(dx) > 0.00001 || Math.abs(dy) > 0.00001) {
      const angle = Math.atan2(dx, dy) * (180 / Math.PI);
      Animated.timing(driverRotation, { toValue: angle, duration: 500, useNativeDriver: true }).start();
    }
    prevDriverLoc.current = driverLocation;
  }, [driverLocation]);
  const handleBackPress = () => { if (showNoDrivers) { navigation.replace('Home'); return; } if (!ride) { navigation.goBack(); return; } if (ride.status === 'pending') { Alert.alert('Recherche en cours', 'Voulez-vous annuler?', [{ text: 'Rester', style: 'cancel' }, { text: 'Annuler', style: 'destructive', onPress: () => handleCancelRide('Annul\u00e9 par le passager') }]); } else if (['accepted', 'arrived', 'in_progress'].includes(ride.status)) { Alert.alert('Course en cours', 'Vous avez une course active.'); } else { navigation.navigate('Home'); } };
  useEffect(() => { fetchRideDetails(); pollInterval.current = setInterval(fetchRideDetails, 5000); return () => { if (pollInterval.current) clearInterval(pollInterval.current); if (etaInterval.current) clearInterval(etaInterval.current); if (socketRef.current) socketRef.current.disconnect(); }; }, [rideId]);
  useEffect(() => { if (ride?.driver?.userId && ['queued', 'accepted', 'in_progress', 'arrived'].includes(ride.status)) { connectToSocket(); if (!etaInterval.current) { fetchETA(); etaInterval.current = setInterval(fetchETA, 10000); } if (pollInterval.current) { clearInterval(pollInterval.current); pollInterval.current = setInterval(fetchRideDetails, 8000); } } }, [ride?.status, ride?.driver?._id]);
  const fetchRideDetails = async () => { try { const r = await rideService.getRide(rideId); const rd = r.ride; setRide(rd); if (rd.driver?.currentLocation?.coordinates && !driverLocation) setDriverLocation(rd.driver.currentLocation.coordinates); if (["accepted", "in_progress"].includes(rd.status) && routeCoordinates.length === 0) { try { await getDirections(rd); } catch(e) {} } if (!alertShownRef.current) { if (rd.status === "completed") { alertShownRef.current = true; clearInterval(pollInterval.current); setCompletedFare(rd.fare || 0); setShowFareAnimation(true); setShowConfetti(true); setTimeout(() => { navigation.replace("Rating", { ride: rd }); }, 4000); } else if (rd.status === "cancelled") { alertShownRef.current = true; clearInterval(pollInterval.current); Alert.alert("Course annul\u00e9e", "Votre course a \u00e9t\u00e9 annul\u00e9e.", [{ text: "OK", onPress: () => navigation.replace("Home") }]); } else if (rd.status === "no_drivers_available") { alertShownRef.current = true; clearInterval(pollInterval.current); setShowNoDrivers(true); } } setLoading(false); } catch (e) { setLoading(false); } };
  const connectToSocket = async () => { if (socketRef.current?.connected) return; socketRef.current = await createAuthSocket(); socketRef.current.on('connect', () => socketRef.current.emit('join-ride-room', rideId)); socketRef.current.on('driver-location-update', (d) => { if (d && d.location && typeof d.location.latitude === 'number' && typeof d.location.longitude === 'number') setDriverLocation(d.location); }); socketRef.current.on('ride-accepted', function() { setTimeout(fetchRideDetails, 1500); }); socketRef.current.on('ride-no-drivers', () => { if (!alertShownRef.current) { alertShownRef.current = true; clearInterval(pollInterval.current); setShowNoDrivers(true); } }); socketRef.current.on('ride-cancelled', () => { if (!alertShownRef.current) { alertShownRef.current = true; clearInterval(pollInterval.current); Alert.alert('Course annul\u00e9e', 'Votre course a \u00e9t\u00e9 annul\u00e9e.', [{ text: 'OK', onPress: () => navigation.replace('Home') }]); } }); };
  const fetchETA = async () => { const loc = driverLocation || ride?.driver?.currentLocation?.coordinates; if (!ride || ride.status !== 'accepted' || !loc || !ride.pickup?.coordinates) return; try { const url = `https://osrm.terango.sn/route/v1/driving/${loc.longitude},${loc.latitude};${ride.pickup.coordinates.longitude},${ride.pickup.coordinates.latitude}?overview=false&steps=false`; const r = await fetch(url); const data = await r.json(); if (data.code === 'Ok' && data.routes[0]?.legs[0]) { setEta(Math.round(data.routes[0].legs[0].duration / 60)); setDistance(data.routes[0].legs[0].distance < 1000 ? Math.round(data.routes[0].legs[0].distance) + ' m' : (data.routes[0].legs[0].distance/1000).toFixed(1) + ' km'); } } catch (e) {} };
  const getDirections = async (rd) => { try { const url = `https://osrm.terango.sn/route/v1/driving/${rd.pickup.coordinates.longitude},${rd.pickup.coordinates.latitude};${rd.dropoff.coordinates.longitude},${rd.dropoff.coordinates.latitude}?overview=full&geometries=polyline`; const r = await fetch(url); const data = await r.json(); if (data.code === 'Ok' && data.routes[0]) { const coords = PolylineUtil.decode(data.routes[0].geometry).map(p => ({ latitude: p[0], longitude: p[1] })); setRouteCoordinates(coords); if (cameraRef.current && coords.length > 0) { try { await new Promise(function(r) { setTimeout(r, 500); });
          const lats = coords.map(c => c.latitude);
          const lons = coords.map(c => c.longitude);
          cameraRef.current.fitBounds([Math.max(...lons), Math.max(...lats)], [Math.min(...lons), Math.min(...lats)], [120, 50, 350, 50], 500); } catch(e) { console.log('fitBounds error:', e); }
        } } } catch (e) {} };
  const handleRetry = async () => { setRetrying(true); try { const r = await rideService.createRide({ pickup: { address: ride.pickup.address, coordinates: ride.pickup.coordinates }, dropoff: { address: ride.dropoff.address, coordinates: ride.dropoff.coordinates }, rideType: ride.rideType || 'standard', paymentMethod: ride.paymentMethod || 'cash' }); if (r.success) { setRideId(r.ride?.id || r.ride?._id); setShowNoDrivers(false); setSearchTime(0); alertShownRef.current = false; setLoading(true); if (pollInterval.current) clearInterval(pollInterval.current); pollInterval.current = setInterval(fetchRideDetails, 5000); } } catch (e) { Alert.alert('Erreur', 'Impossible de r\u00e9essayer.'); } finally { setRetrying(false); } };
  const handleCancelRide = async (reason) => { setCancelling(true); try { await rideService.cancelRide(rideId, reason); setShowCancelModal(false); navigation.replace('Home'); } catch (e) { setCancelling(false); } };

  // Safety: share a live-tracking link to an emergency contact. Calls the
  // existing /api/rides/:id/share endpoint which returns a public share URL,
  // then hands it to the native share sheet (WhatsApp, SMS, etc.). The URL
  // serves a no-auth HTML page on the backend that shows driver position +
  // pickup/dropoff in real time via the /share socket namespace.
  const auth = useAuth();
  const userObj = (auth && auth.user) || {};
  const trustedContacts = (userObj.emergencyContacts || []).filter(function(c) { return c && c.name && c.phone; });
  const autoShareConfig = userObj.autoShare || {};
  const [shareLoading, setShareLoading] = useState(false);
  const autoShareFiredRef = useRef(false);

  // Build a share message for a specific driver context.
  const buildShareMessage = (url) => {
    const driverPart = ride && ride.driver && ride.driver.userId && ride.driver.userId.name
      ? ' avec ' + ride.driver.userId.name : '';
    const platePart = ride && ride.driver && ride.driver.vehicle && ride.driver.vehicle.licensePlate
      ? ' (plaque ' + ride.driver.vehicle.licensePlate + ')' : '';
    return 'Suivez mon trajet TeranGO en direct' + driverPart + platePart + ': ' + url;
  };

  // Open WhatsApp first (most-used in Senegal); fall back to SMS.
  const openMessenger = async (phone, message) => {
    const clean = String(phone || '').replace(/[^0-9+]/g, '').replace(/^\+/, '');
    const waUrl = 'whatsapp://send?phone=' + clean + '&text=' + encodeURIComponent(message);
    const smsUrl = 'sms:' + (String(phone).indexOf('+') === 0 ? phone : ('+' + clean)) + '?body=' + encodeURIComponent(message);
    try {
      const canWa = await Linking.canOpenURL(waUrl);
      if (canWa) { await Linking.openURL(waUrl); return true; }
      await Linking.openURL(smsUrl);
      return true;
    } catch (e) {
      try { await Linking.openURL(smsUrl); return true; } catch (e2) { return false; }
    }
  };

  // Share the live link to a specific trusted contact in one tap.
  const handleShareToContact = async (contact) => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      const r = await rideService.shareRide(rideId);
      const url = r && r.shareUrl;
      if (!url) { Alert.alert('Erreur', 'Lien indisponible'); return; }
      await openMessenger(contact.phone, buildShareMessage(url));
    } catch (e) {
      console.warn('Share to contact error:', e && e.message);
      Alert.alert('Erreur', 'Impossible de partager');
    } finally { setShareLoading(false); }
  };

  // Open the native share sheet for everything else.
  const handleShareTrip = async () => {
    if (shareLoading) return;
    setShareLoading(true);
    try {
      const r = await rideService.shareRide(rideId);
      const url = r && r.shareUrl;
      if (!url) { Alert.alert('Erreur', 'Lien indisponible'); return; }
      await Share.share({ message: buildShareMessage(url), url: url, title: 'Mon trajet TeranGO' });
    } catch (e) {
      console.warn('Share trip error:', e && e.message);
      Alert.alert('Erreur', 'Impossible de partager le trajet');
    } finally { setShareLoading(false); }
  };

  // Auto-share when the ride transitions to accepted and the user opted in.
  // Checks the time window when alwaysOn is false. Fires once per screen mount
  // via `autoShareFiredRef`.
  useEffect(() => {
    if (!ride || autoShareFiredRef.current) return;
    if (!['accepted', 'arrived', 'in_progress'].includes(ride.status)) return;
    if (!autoShareConfig.enabled) return;
    if (!autoShareConfig.contactPhone) return;
    // Hour window check (wraps midnight): start <= now < end OR (start > end AND (now >= start OR now < end))
    if (!autoShareConfig.alwaysOn) {
      const h = new Date().getHours();
      const s = autoShareConfig.startHour;
      const e = autoShareConfig.endHour;
      const inWindow = s <= e ? (h >= s && h < e) : (h >= s || h < e);
      if (!inWindow) return;
    }
    autoShareFiredRef.current = true;
    handleShareToContact({ name: autoShareConfig.contactName, phone: autoShareConfig.contactPhone });
  }, [ride && ride.status]);

  // "Arrived safely" — pings every trusted contact with a quick reassurance
  // message. Visible during in_progress; tap once, opens WhatsApp prefilled.
  const handleArrivedSafely = async () => {
    if (trustedContacts.length === 0) {
      Alert.alert('Pas de contact', 'Ajoutez d\'abord un contact de confiance dans les parametres de securite.');
      return;
    }
    const message = 'Bonne nouvelle: je suis arrive(e) sain(e) et sauf(ve). Merci de votre attention. — TeranGO';
    for (let i = 0; i < trustedContacts.length; i++) {
      await openMessenger(trustedContacts[i].phone, message);
    }
  };

  const [sosSending, setSosSending] = useState(false);
  const handleSOS = () => {
    Alert.alert(
      'Alerte SOS',
      "Envoyer une alerte d'urgence ? Une video sera enregistree comme preuve.",
      [
        { text: 'Annuler', style: 'cancel' },
        { text: "Envoyer l'alerte", style: 'destructive', onPress: async () => {
          setSosSending(true);
          try { await rideService.triggerSOS(rideId); } catch (e) { console.error('SOS error:', e); }
          setSosSending(false);
          try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (perm.status !== 'granted') {
              Alert.alert('Permission requise', 'Activez la camera pour enregistrer une video de securite.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: 'videos',
              videoMaxDuration: 120,
              videoQuality: 1,
            });
            if (result.canceled || !result.assets || result.assets.length === 0) return;
            const v = result.assets[0];
            const duration = v.duration ? Math.round(v.duration / 1000) : 0;
            await rideService.uploadEmergencyRecording(rideId, v.uri, duration);
            Alert.alert('Enregistrement envoye', 'Votre video de securite a ete sauvegardee.');
          } catch (err) {
            console.error('SOS recording error:', err);
            Alert.alert('Erreur', "Impossible d'envoyer l'enregistrement.");
          }
        }}
      ]
    );
  };
  const getStatusConfig = () => { if (!ride) return { message: '', icon: '\uD83D\uDD04' }; switch (ride.status) { case 'pending': return { message: "Recherche d'un chauffeur...", icon: '\uD83D\uDD0D' }; case 'queued': return { message: 'Chauffeur termine une course...', icon: '\u23F3' }; case 'accepted': return { message: eta ? `Arriv\u00e9e dans ${eta} min (${distance})` : 'Chauffeur en route...', icon: '\uD83D\uDE97' }; case 'arrived': return { message: 'Le chauffeur est arriv\u00e9!', icon: '\uD83D\uDCCD' }; case 'in_progress': return { message: 'Course en cours', icon: '\uD83D\uDEE3\uFE0F' }; default: return { message: '', icon: '\uD83D\uDD04' }; } };
  const renderStars = (rating) => [...Array(5)].map((_, i) => (<Text key={i} style={{ color: i < Math.floor(rating || 5) ? '#FFD700' : '#555', fontSize: 12, fontFamily: 'LexendDeca_400Regular' }}>{"\u2605"}</Text>));
  // ========== FARE ANIMATION + CONFETTI SCREEN ==========
  if (showFareAnimation) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
        <ConfettiCelebration visible={showConfetti} />
        <Text style={{ fontSize: 60, marginBottom: 8 }}>{String.fromCodePoint(0x1F389)}</Text>
        <Text style={{ fontSize: 24, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 4 }}>{'Course terminée!'}</Text>
        <Text style={{ fontSize: 14, fontFamily: 'LexendDeca_400Regular', color: '#5a5a5a' }}>Merci d'avoir choisi TeranGO</Text>
        <AnimatedFareCounter targetFare={completedFare} />
        <Text style={{ fontSize: 13, fontFamily: 'LexendDeca_400Regular', color: '#757575' }}>Redirection vers la notation...</Text>
      </View>
    );
  }
  if (showNoDrivers) return <NoDriversScreen ride={ride} onRetry={handleRetry} onGoHome={() => navigation.replace('Home')} retrying={retrying} />;
  if (loading || !ride) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.green} /><Text style={styles.loadingText}>Chargement...</Text></View>);
  return (
    <View style={styles.container}>
      <Map ref={mapRef} style={styles.map} mapStyle={TERANGO_STYLE} logo={false} attribution={false}>
        <Camera ref={cameraRef} center={[ride?.pickup?.coordinates?.longitude || -17.4467, ride?.pickup?.coordinates?.latitude || 14.6928]} zoom={13} />
        <Marker id="pickup" lngLat={[ride.pickup.coordinates.longitude, ride.pickup.coordinates.latitude]}>
          <View style={styles.pickupMarker}><View style={styles.pickupDot} /></View>
        </Marker>
        <Marker id="dropoff" lngLat={[ride.dropoff.coordinates.longitude, ride.dropoff.coordinates.latitude]}>
          <View style={styles.dropoffMarker}><View style={styles.dropoffSquare} /></View>
        </Marker>
        {driverLocation && (
          <Marker id="driver" lngLat={[driverLocation.longitude, driverLocation.latitude]}>
            <View style={styles.driverMarkerOuter}>
              <Image source={{ uri: "https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberX_v1.png" }} style={styles.driverCarImage} resizeMode="contain" />
            </View>
          </Marker>
        )}
        {routeCoordinates.length > 0 && (
          <GeoJSONSource id="routeSource" data={{ type: "Feature", geometry: { type: "LineString", coordinates: routeCoordinates.map(c => [c.longitude, c.latitude]) } }}>
            <Layer type="line" id="routeShadow" paint={{ "line-color": "#4285F4", "line-width": 12, "line-opacity": 0.3  }} layout={{ "line-cap": "round", "line-join": "round" }} />
            <Layer type="line" id="routeLine" paint={{ "line-color": "#4285F4", "line-width": 5  }} layout={{ "line-cap": "round", "line-join": "round" }} />
          </GeoJSONSource>
        )}
      </Map>
      <View style={styles.topBar}><TouchableOpacity style={styles.backButton} onPress={handleBackPress}><Text style={styles.backIcon}>{"\u2190"}</Text></TouchableOpacity><View style={styles.statusCard}><Text style={styles.statusIcon}>{getStatusConfig().icon}</Text><Text style={styles.statusText}>{getStatusConfig().message}</Text></View></View>
      <View style={styles.bottomCard}>
        {ride.status === 'pending' && (<>
          <SearchingAnimation searchTime={searchTime} rideType={ride?.rideType} />
          <View style={styles.fareCard}><Text style={[styles.fareLabel, ride.paymentMethod === 'wave' && {color:'#1DC3E1'}]}>{ride.paymentMethod === 'wave' ? '\uD83C\uDF0A Wave' : '\uD83D\uDCB5 Especes'}</Text><Text style={styles.fareAmount}>{ride.fare?.toLocaleString()+' FCFA'}</Text></View>
          <GlassButton title="Annuler la course" onPress={() => setShowCancelModal(true)} variant="secondary" />
        </>)}
        {ride.status !== 'pending' && !(ride.driver && ride.driver.userId) && (
          <View style={{alignItems:'center',padding:20}}><ActivityIndicator size='large' color={COLORS.green} /><Text style={{color:'#5a5a5a',marginTop:10,fontFamily:'LexendDeca_400Regular'}}>Chargement du chauffeur...</Text></View>
        )}
        {ride.status !== 'pending' && ride.driver && ride.driver.userId && (
          <ScrollView style={styles.bottomScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled={true} bounces={false}>
            {ride.driver && ride.driver.userId && ride.driver.userId.name && (
              <View style={styles.driverCard}>
                <View style={styles.driverRow}>
                  <View style={styles.driverPhotos}>
                    {ride?.driver?.userId?.profilePhoto ? <Image source={{uri: ride.driver.userId.profilePhoto}} style={styles.driverAvatarImg} /> : <View style={styles.driverAvatar}><Text style={styles.avatarText}>{ride?.driver?.userId?.name?.charAt(0) || "D"}</Text></View>}
                    {ride?.driver?.vehicleFrontPhoto ? <View style={styles.vehiclePhotoWrap}><Image source={{uri: ride.driver.vehicleFrontPhoto}} style={styles.vehiclePhoto} resizeMode="cover" /></View> : null}

                  </View>
                  <View style={styles.driverDetails}>
                    <Text style={styles.driverName}>{ride?.driver?.userId?.name || 'Chauffeur'}</Text>
                    <View style={styles.ratingRow}>{renderStars(ride?.driver?.userId?.rating)}<Text style={styles.ratingText}>{(ride?.driver?.userId?.rating != null ? Number(ride.driver.userId.rating).toFixed(1) : '5.0')}</Text></View>
                    {ride?.driver?.vehicle ? <Text style={styles.vehicleText}>{(ride?.driver?.vehicle?.make||'')+' '+(ride?.driver?.vehicle?.model||'')+(ride?.driver?.vehicle?.color?' \u2022 '+ride?.driver?.vehicle?.color:'')}</Text> : null}
                    {ride?.driver?.vehicle?.licensePlate ? <View style={styles.plateBadge}><Text style={styles.plateText}>{ride.driver.vehicle.licensePlate}</Text></View> : null}
                  </View>
                  <View style={styles.fareTag}><Text style={styles.fareTagAmount}>{(ride.fare || 0).toLocaleString()}</Text><Text style={styles.fareTagCurrency}>FCFA</Text></View>
                </View>
                <View style={styles.contactRow}>
                  <TouchableOpacity style={styles.contactButton} onPress={() => Linking.openURL('tel:'+(ride?.driver?.userId?.phone || ''))}><Text style={styles.contactBtnIcon}>{String.fromCodePoint(0x1F4DE)}</Text><Text style={styles.contactLabel}>Appeler</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.contactButton} onPress={() => setShowChat(true)}><Text style={styles.contactBtnIcon}>{String.fromCodePoint(0x1F4AC)}</Text><Text style={styles.contactLabel}>Chat</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.contactButton} onPress={handleShareTrip} disabled={shareLoading}><Text style={styles.contactBtnIcon}>{String.fromCodePoint(0x1F4E4)}</Text><Text style={styles.contactLabel}>{shareLoading ? '...' : 'Partager'}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.contactButton} onPress={handleSOS} disabled={sosSending}><Text style={[styles.contactBtnIcon, { color: '#FF3B30' }]}>{String.fromCodePoint(0x1F6A8)}</Text><Text style={[styles.contactLabel, { color: '#FF3B30', fontFamily: 'LexendDeca_700Bold' }]}>{sosSending ? 'Envoi...' : 'SOS'}</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.contactButton} onPress={() => Alert.alert('Support TeranGO', 'Comment pouvons-nous vous aider?', [{text:'Annuler',style:'cancel'},{text:'Appeler',onPress:()=>Linking.openURL('tel:+221338234567')},{text:'WhatsApp',onPress:()=>Linking.openURL('https://wa.me/221778234567')}])}><Text style={styles.contactBtnIcon}>{String.fromCodePoint(0x2139) + String.fromCodePoint(0xFE0F)}</Text><Text style={styles.contactLabel}>Support</Text></TouchableOpacity>
                </View>

                {/* One-tap share chips to trusted contacts (Safety > Contacts de confiance) */}
                {trustedContacts.length > 0 && (
                  <View style={styles.trustedChipsRow}>
                    <Text style={styles.trustedChipsLabel}>Partager avec</Text>
                    {trustedContacts.map(function(c, i) {
                      return (
                        <TouchableOpacity key={i} style={styles.trustedChip} onPress={function() { handleShareToContact(c); }} disabled={shareLoading}>
                          <Text style={styles.trustedChipText}>{String.fromCodePoint(0x1F4E4) + ' ' + (c.name || 'Contact')}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* "Arrived safely" — visible only during in_progress so it
                    doesn't compete with the pre-pickup UI. */}
                {ride.status === 'in_progress' && trustedContacts.length > 0 && (
                  <TouchableOpacity style={styles.arrivedSafelyBtn} onPress={handleArrivedSafely}>
                    <Text style={styles.arrivedSafelyText}>{String.fromCodePoint(0x2705) + " J'arrive bien — prevenir mes proches"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {ride.pinRequired && ride.securityPin && (
              <View style={styles.pinCard}>
                <View style={styles.pinRow}><Text style={styles.pinIcon}>{"\uD83D\uDD12"}</Text><Text style={styles.pinLabel}>{"Code de s\u00e9curit\u00e9"}</Text></View>
                <Text style={styles.pinCode}>{ride.securityPin}</Text>
                <Text style={styles.pinHint}>{"Donnez ce code \u00e0 votre chauffeur"}</Text>
              </View>
            )}
            <View style={styles.addressCard}><View style={styles.addressRow}><View style={styles.addressIconWrap}><View style={styles.greenDot} /></View><View style={styles.addressContent}><Text style={styles.addressLabel}>{"D\u00e9part"}</Text><Text style={styles.addressText} numberOfLines={1}>{ride?.pickup?.address || 'Depart'}</Text></View></View><View style={styles.addressDivider} /><View style={styles.addressRow}><View style={styles.addressIconWrap}><View style={styles.redSquare} /></View><View style={styles.addressContent}><Text style={styles.addressLabel}>Destination</Text><Text style={styles.addressText} numberOfLines={1}>{ride?.dropoff?.address || 'Destination'}</Text></View></View></View>
            {['pending', 'queued', 'accepted'].includes(ride.status) && <GlassButton title="Annuler la course" onPress={() => setShowCancelModal(true)} variant="secondary" />}
            <View style={{height: 10}} />
          </ScrollView>
        )}
      </View>
      <Modal visible={showChat} animationType="slide" onRequestClose={() => setShowChat(false)}><ChatScreen socket={socketRef.current} rideId={rideId} deliveryId={null} myRole="rider" myUserId={null} otherName={ride?.driver?.userId?.name || 'Chauffeur'} onClose={() => setShowChat(false)} /></Modal>
      <CancelModal visible={showCancelModal} onClose={() => setShowCancelModal(false)} onConfirm={handleCancelRide} loading={cancelling} />
    </View>
  );
};
const noDriversStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { alignItems: 'center', width: '100%' },
  icon: { fontSize: 60, marginBottom: 16, fontFamily: 'LexendDeca_400Regular' },
  title: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#5a5a5a', textAlign: 'center', marginBottom: 24, lineHeight: 20, fontFamily: 'LexendDeca_400Regular' },
  rideInfo: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 16, width: '100%', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green, marginRight: 12 },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red, marginRight: 12 },
  addressText: { flex: 1, fontSize: 14, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular' },
  fareText: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow, textAlign: 'center', marginTop: 8 },
  retryButton: { backgroundColor: COLORS.green, paddingVertical: 16, paddingHorizontal: 40, borderRadius: 14, width: '100%', alignItems: 'center', marginBottom: 12 },
  retryButtonText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#FFF' },
  homeButton: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14, width: '100%', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  homeButtonText: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: '#5a5a5a' },
});
const cancelStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, maxHeight: height * 0.7, borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#757575', textAlign: 'center', marginBottom: 20, fontFamily: 'LexendDeca_400Regular' },
  reasonsList: { maxHeight: 280 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  reasonItemSelected: { borderColor: COLORS.yellow, backgroundColor: 'rgba(212,175,55,0.08)' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#757575', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.yellow },
  reasonText: { fontSize: 14, color: '#1A1A1A', flex: 1, fontFamily: 'LexendDeca_400Regular' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  backButton: { flex: 1, padding: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backButtonText: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: '#5a5a5a' },
  confirmButton: { flex: 1, padding: 14, backgroundColor: COLORS.red, borderRadius: 12, alignItems: 'center' },
  confirmButtonDisabled: { opacity: 0.5 },
  confirmButtonText: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: '#FFF' },
});
const searchStyles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 20, marginBottom: 12, height: 180 },
  pulseCircle: { position: 'absolute', borderRadius: 100, borderWidth: 2, borderColor: 'rgba(0,133,63,0.3)' },
  pulseCircle1: { width: 120, height: 120, top: 10 },
  pulseCircle2: { width: 90, height: 90, top: 25, borderColor: 'rgba(0,133,63,0.5)' },
  centerCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(0,133,63,0.15)', position: 'absolute', top: 40 },
  carContainer: { position: 'absolute', top: 15 },
  carIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', elevation: 6 },
  carImage: { width: 52, height: 38 },
  timerContainer: { marginTop: 85, backgroundColor: 'rgba(0,133,63,0.12)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  timerText: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.green },
  statusText: { marginTop: 10, fontSize: 14, fontFamily: 'LexendDeca_500Medium', color: '#5a5a5a', textAlign: 'center' },
  tipText: { marginTop: 6, fontSize: 12, color: '#757575', textAlign: 'center', paddingHorizontal: 20, fontFamily: 'LexendDeca_400Regular' },
});
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 16, fontSize: 16, color: COLORS.textDarkSub, fontFamily: 'LexendDeca_400Regular' },
  map: { ...StyleSheet.absoluteFillObject },
  pickupMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.green },
  pickupDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  dropoffMarker: { width: 26, height: 26, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.red },
  dropoffSquare: { width: 10, height: 10, backgroundColor: COLORS.red },
  driverMarkerOuter: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  driverCarImage: { width: 70, height: 50 },
  driverArrowTop: { width: 0, height: 0, borderLeftWidth: 16, borderRightWidth: 16, borderBottomWidth: 30, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#D4AF37' },
  driverArrowBottom: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#D4A900', marginTop: -4 },
  driverMarkerDot: { position: 'absolute', top: 16, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#D4AF37' },
  topBar: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 12, elevation: 4, borderWidth: 1, borderColor: '#EEF0F3' },
  backIcon: { fontSize: 22, color: '#1A1A1A', fontFamily: 'LexendDeca_700Bold' },
  statusCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(212,175,55,0.7)', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, elevation: 4, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)' },
  statusIcon: { fontSize: 18, marginRight: 8, fontFamily: 'LexendDeca_400Regular' },
  statusText: { flex: 1, fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.darkBg },
  bottomCard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, elevation: 12, borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder, maxHeight: '65%' },
  bottomScroll: { flexGrow: 0 },
  driverCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  driverAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  driverAvatarImg: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: COLORS.yellow },
  avatarText: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: '#FFF' },
  driverDetails: { flex: 1 },
  driverName: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  ratingText: { marginLeft: 4, fontSize: 12, fontFamily: 'LexendDeca_600SemiBold', color: '#5a5a5a' },
  vehicleText: { fontSize: 12, color: '#757575', fontFamily: 'LexendDeca_400Regular' },
  driverPhotos: { alignItems: 'center', marginRight: 12, gap: 6 },
  vehiclePhotoWrap: { width: 72, height: 48, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F3' },
  vehiclePhoto: { width: 72, height: 48, borderRadius: 10 },
  plateBadge: { backgroundColor: COLORS.yellowGlow10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  plateText: { fontSize: 11, color: COLORS.yellow, fontFamily: 'LexendDeca_700Bold' },
  contactRow: { flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 10 },
  contactButton: { alignItems: 'center', flex: 1 },
  contactBtnIcon: { fontSize: 22, marginBottom: 2, fontFamily: 'LexendDeca_400Regular' },
  contactLabel: { fontSize: 11, fontFamily: 'LexendDeca_500Medium', color: '#5a5a5a' },
  trustedChipsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  trustedChipsLabel: { fontSize: 11, color: '#5a5a5a', fontFamily: 'LexendDeca_600SemiBold', marginRight: 8, marginBottom: 6 },
  trustedChip: { backgroundColor: 'rgba(0,133,63,0.08)', borderWidth: 1, borderColor: 'rgba(0,133,63,0.25)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6, marginBottom: 6 },
  trustedChipText: { fontSize: 12, color: COLORS.green, fontFamily: 'LexendDeca_600SemiBold' },
  arrivedSafelyBtn: { marginTop: 10, paddingVertical: 12, borderRadius: 10, backgroundColor: 'rgba(0,133,63,0.12)', borderWidth: 1, borderColor: 'rgba(0,133,63,0.3)', alignItems: 'center' },
  arrivedSafelyText: { fontSize: 13, color: COLORS.green, fontFamily: 'LexendDeca_700Bold' },
  fareTag: { alignItems: 'flex-end' },
  fareTagAmount: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },
  fareTagCurrency: { fontSize: 11, color: '#757575', fontFamily: 'LexendDeca_400Regular' },
  addressCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  addressIconWrap: { width: 28, alignItems: 'center', marginRight: 10 },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red },
  addressDivider: { height: 20, marginLeft: 14, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.08)', borderStyle: 'dashed', marginVertical: 6 },
  addressContent: { flex: 1 },
  addressLabel: { fontSize: 11, color: '#757575', marginBottom: 1, fontFamily: 'LexendDeca_400Regular' },
  addressText: { fontSize: 14, fontFamily: 'LexendDeca_500Medium', color: '#1A1A1A' },
  pinCard: { backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.3)' },
  pinRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  pinIcon: { fontSize: 16, marginRight: 6, fontFamily: 'LexendDeca_400Regular' },
  pinLabel: { fontSize: 13, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular' },
  pinCode: { fontSize: 28, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow, letterSpacing: 8, textAlign: 'center' },
  pinHint: { fontSize: 11, color: '#757575', textAlign: 'center', marginTop: 4, fontFamily: 'LexendDeca_400Regular' },
  fareCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  fareLabel: { fontSize: 14, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular' },
  fareAmount: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },
});
class ActiveRideErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error: error }; }
  componentDidCatch(error, info) { console.log('ActiveRide CRASH:', error, info); }
  render() {
    if (this.state.hasError) {
      return React.createElement(View, { style: { flex: 1, backgroundColor: '#001A12', justifyContent: 'center', alignItems: 'center', padding: 20 } },
        React.createElement(Text, { style: { fontSize: 40, marginBottom: 16 } }, '\u26A0\uFE0F'),
        React.createElement(Text, { style: { fontSize: 18, color: '#FFF', fontFamily: 'LexendDeca_700Bold', marginBottom: 8 } }, 'Oups! Une erreur est survenue'),
        React.createElement(Text, { style: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 20, fontFamily: 'LexendDeca_400Regular' } }, String(this.state.error)),
        React.createElement(TouchableOpacity, { style: { backgroundColor: '#D4AF37', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 }, onPress: () => this.props.navigation.replace('Home') },
          React.createElement(Text, { style: { fontSize: 16, color: '#001A12', fontFamily: 'LexendDeca_700Bold' } }, "Retour a l'accueil")
        )
      );
    }
    return React.createElement(ActiveRideScreen, this.props);
  }
}
export default function(props) { return React.createElement(ActiveRideErrorBoundary, props); };



