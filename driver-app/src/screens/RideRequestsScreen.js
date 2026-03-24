import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Dimensions, Image, Vibration, Linking } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Map, Camera, Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

const TERANGO_STYLE = require('../constants/terangoMapStyle.json');
import * as Location from 'expo-location';
import { createAuthSocket } from '../services/socket';
import COLORS from '../constants/colors';
import CAR_IMAGES from '../constants/carImages';
import { driverService, deliveryService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const { width, height } = Dimensions.get('window');

const RideRequestsScreen = ({ navigation, route }) => {
  const { driver } = useAuth();
  const driverId = route.params?.driverId || driver?._id;
  const passedLocation = route.params?.location || null;
  const [location, setLocation] = useState(passedLocation ? { latitude: passedLocation.latitude, longitude: passedLocation.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 } : null);
  const [rideRequests, setRideRequests] = useState([]);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [earnings, setEarnings] = useState({ today: 0, ridesCompleted: 0 });
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offerTimeout, setOfferTimeout] = useState(null);
  const currentRequestRef = useRef(null);
  const offerTimeoutRef = useRef(null);
  const [activeServices, setActiveServices] = useState({ rides: true, colis: false, commande: false, resto: false });
  const activeServicesRef = useRef({ rides: true, colis: false, commande: false, resto: false });
  const [showFilters, setShowFilters] = useState(false);
  const [blockedForPayment, setBlockedForPayment] = useState(null);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const soundRef = useRef(null);
  const vibrationInterval = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const playRideAlert = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: false });
      // Create a repeating beep using expo-av tone
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      // Pulse vibration pattern like Uber
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      vibrationInterval.current = setInterval(() => {
        Vibration.vibrate([0, 400, 200, 400]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 1500);
      // Pulse animation for the card
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true })
      ])).start();
    } catch (e) { console.log('Sound error:', e); }
  };

  const stopRideAlert = async () => {
    try {
      if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; }
      if (vibrationInterval.current) { clearInterval(vibrationInterval.current); vibrationInterval.current = null; }
      Vibration.cancel();
      pulseAnim.setValue(1);
    } catch (e) {}
  };

  useEffect(() => { getLocation(); connectSocket(); fetchEarnings(); var earningsInterval = setInterval(fetchEarnings, 30000); return () => { if (socket) { if (driverId) socket.emit('driver-offline', driverId); socket.disconnect(); } if (offerTimeout) clearTimeout(offerTimeout); clearInterval(earningsInterval); stopRideAlert(); }; }, []);
  useEffect(() => { currentRequestRef.current = currentRequest; if (currentRequest) { showRequestCard(); playRideAlert(); } else { hideRequestCard(); stopRideAlert(); } return () => { stopRideAlert(); }; }, [currentRequest]);
  useEffect(() => { if (!currentRequest) { Animated.loop(Animated.sequence([Animated.timing(scanAnim, { toValue: 1, duration: 1500, useNativeDriver: true }), Animated.timing(scanAnim, { toValue: 0, duration: 1500, useNativeDriver: true })])).start(); } else { scanAnim.setValue(0); } }, [currentRequest]);
  useEffect(() => { activeServicesRef.current = activeServices; }, [activeServices]);

  const fetchEarnings = async () => { try { const r = await driverService.getEarnings(); setEarnings({ today: r.earnings.today || 0, ridesCompleted: r.earnings.totalRides || 0 }); } catch (e) {} };
  const toggleService = async (key) => { const updated = { ...activeServices, [key]: !activeServices[key] }; if (!Object.values(updated).some(v => v)) { Alert.alert('Attention', 'Gardez au moins un service actif.'); return; } setActiveServices(updated); try { await driverService.updateServicePreferences(updated); } catch (e) { setActiveServices(activeServices); } };

  const getLocation = async () => {
    try { const { status } = await Location.requestForegroundPermissionsAsync(); if (status !== 'granted') { Alert.alert('Permission refus\u00e9e', 'Localisation requise'); return; }
      try { const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); setLocation({ latitude: cur.coords.latitude, longitude: cur.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }); } catch(e) { console.log("Location update error:", e); }
      setInterval(async () => { const loc = await Location.getCurrentPositionAsync({}); setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }); await driverService.updateLocation(loc.coords.latitude, loc.coords.longitude); }, 10000);
    } catch (e) { console.error('Location error:', e); }
  };

  const connectSocket = () => {
    if (!driverId) return;
    createAuthSocket().then(function(newSocket) { setSocket(newSocket);
      newSocket.on('connect', () => { newSocket.emit('driver-online', { driverId, latitude: location?.latitude, longitude: location?.longitude }); });
      newSocket.on('new-ride-offer', (rideData) => { rideData._offerType = 'ride'; if (!activeServicesRef.current.rides) return; if (currentRequestRef.current) { setRideRequests(prev => [...prev, rideData]); return; } if (offerTimeoutRef.current) { clearTimeout(offerTimeoutRef.current); } setCurrentRequest(rideData); setRideRequests(prev => [...prev, rideData]); var t = setTimeout(() => { handleReject(); }, rideData.offerExpiresIn || 15000); offerTimeoutRef.current = t; setOfferTimeout(t); });
      newSocket.on('ride-taken', () => { Alert.alert('Course prise', 'Un autre chauffeur a accepte cette course'); stopRideAlert(); if (offerTimeoutRef.current) { clearTimeout(offerTimeoutRef.current); offerTimeoutRef.current = null; } var req = currentRequestRef.current; if (req) { setRideRequests(function(prev) { var remaining = prev.filter(function(r) { return r.rideId !== req.rideId; }); var next = remaining.length > 0 ? remaining[0] : null; setCurrentRequest(next); return remaining; }); } });
      newSocket.on('ride-cancelled', function() { stopRideAlert(); if (offerTimeoutRef.current) { clearTimeout(offerTimeoutRef.current); offerTimeoutRef.current = null; } setCurrentRequest(null); setRideRequests([]); setOfferTimeout(null); });
      newSocket.on('new-delivery', (d) => { var sType = d.serviceType || 'colis'; if (sType === 'colis' && !activeServicesRef.current.colis) return; if (sType === 'commande' && !activeServicesRef.current.commande) return; if ((sType === 'resto' || sType === 'restaurant') && !activeServicesRef.current.resto) return; var offerData = { rideId: d.deliveryId, _offerType: d.serviceType || 'colis', _isDelivery: true, pickup: d.pickup, dropoff: d.dropoff, fare: d.fare, packageDetails: d.packageDetails, restaurantName: d.restaurantName, serviceType: d.serviceType, offerExpiresIn: 60000 }; setRideRequests(prev => [...prev, offerData]); if (!currentRequest) { setCurrentRequest(offerData); const t = setTimeout(() => { handleReject(); }, 60000); setOfferTimeout(t); } });
      newSocket.on('delivery-taken', () => { Alert.alert('Livraison prise', 'Un autre livreur a accept\u00e9.'); if (currentRequest && currentRequest._isDelivery) setCurrentRequest(null); });
      newSocket.on('blocked-for-payment', (data) => { setBlockedForPayment(data); });
      newSocket.on('ride-completed-earnings', () => { fetchEarnings(); });
      newSocket.on('disconnect', () => {});
    });
  };

  const showRequestCard = () => { Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start(); if (mapRef.current && currentRequest) { if (cameraRef.current) { var pLat=currentRequest.pickup.coordinates.latitude; var pLon=currentRequest.pickup.coordinates.longitude; var dLat=currentRequest.dropoff.coordinates.latitude; var dLon=currentRequest.dropoff.coordinates.longitude; cameraRef.current.fitBounds([Math.min(pLon,dLon),Math.min(pLat,dLat),Math.max(pLon,dLon),Math.max(pLat,dLat)],{top:100,right:50,bottom:400,left:50},500); } } };
  const hideRequestCard = () => { Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(); };
  const handleGoOffline = async () => { setShowOfflineModal(false); try { await driverService.toggleOnlineStatus(false); if (socket && driverId) socket.emit('driver-offline', driverId); navigation.replace('Home'); } catch (e) { Alert.alert('Erreur', 'Impossible de passer hors ligne'); } };

  const handleAccept = async () => {
    if (!currentRequest) return; stopRideAlert(); if (offerTimeout) { clearTimeout(offerTimeout); setOfferTimeout(null); } setLoading(true);
    try { if (currentRequest._isDelivery) { await deliveryService.acceptDelivery(currentRequest.rideId); setRideRequests(prev => prev.filter(r => r.rideId !== currentRequest.rideId)); navigation.replace('ActiveRide', { rideId: currentRequest.rideId, ride: currentRequest, deliveryMode: true, deliveryData: currentRequest }); } else { await driverService.acceptRide(currentRequest.rideId); setRideRequests(prev => prev.filter(r => r.rideId !== currentRequest.rideId)); navigation.replace('ActiveRide', { rideId: currentRequest.rideId, ride: currentRequest }); } setCurrentRequest(null); } catch (e) { Alert.alert('Erreur', e.response?.data?.message || "Impossible d'accepter"); } finally { setLoading(false); }
  };

  const handleReject = async () => { var req = currentRequestRef.current; if (!req) return; stopRideAlert(); if (offerTimeoutRef.current) { clearTimeout(offerTimeoutRef.current); offerTimeoutRef.current = null; } if (offerTimeout) { clearTimeout(offerTimeout); setOfferTimeout(null); } try { if (!req._isDelivery) await driverService.rejectRide(req.rideId, 'Trop loin').catch(function(){}); } catch (e) {} setRideRequests(function(prev) { var remaining = prev.filter(function(r) { return r.rideId !== req.rideId; }); var next = remaining.length > 0 ? remaining[0] : null; setCurrentRequest(next); if (next) { var t = setTimeout(function() { handleReject(); }, next.offerExpiresIn || 15000); offerTimeoutRef.current = t; setOfferTimeout(t); } return remaining; }); };

  return (
    <View style={styles.container}>
      {location ? (
        <Map ref={mapRef} style={styles.map} mapStyle={TERANGO_STYLE} logo={false} attribution={false}>
          <Camera ref={cameraRef} center={[location.longitude, location.latitude]} zoom={14} />
          {location && (
            <Marker id="driverPos" lngLat={[location.longitude, location.latitude]}>
              <View style={styles.driverMarkerOuter}><View style={styles.driverMarkerShadow} /><View style={styles.driverMarkerArrow}><View style={styles.driverArrowTop} /><View style={styles.driverArrowBottom} /></View><View style={styles.driverMarkerDot} /></View>
            </Marker>
          )}
          {currentRequest && (
            <>
              <Marker id="reqPickup" lngLat={[currentRequest.pickup.coordinates.longitude, currentRequest.pickup.coordinates.latitude]}>
                <View style={styles.pickupMarker}><View style={styles.pickupDot} /></View>
              </Marker>
              <Marker id="reqDropoff" lngLat={[currentRequest.dropoff.coordinates.longitude, currentRequest.dropoff.coordinates.latitude]}>
                <View style={styles.dropoffMarker}><View style={styles.dropoffDot} /></View>
              </Marker>
              <GeoJSONSource id="circleSource" data={{ type: "Feature", geometry: { type: "Point", coordinates: [currentRequest.pickup.coordinates.longitude, currentRequest.pickup.coordinates.latitude] } }}>
                <Layer type="circle" id="circleLayer" paint={{ "circle-radius": 50, "circle-color": "rgba(0,133,63,0.1)", "circle-stroke-color": "rgba(0,133,63,0.3)", "circle-stroke-width": 1 }} />
              </GeoJSONSource>
            </>
          )}
        </Map>
      ) : (<View style={styles.loadingContainer}><Text style={styles.loadingText}>Chargement de la carte...</Text></View>)}

      <View style={styles.topBar}>
        <View style={styles.earningsCard}><Text style={styles.earningsValue}>{earnings.today.toLocaleString()+' FCFA'}</Text><Text style={styles.earningsLabel}>{"Aujourd'hui \u2022 "+earnings.ridesCompleted+' courses'}</Text></View>
        <TouchableOpacity style={styles.offlineButton} onPress={() => setShowOfflineModal(true)}><View style={styles.onlineDot} /><Text style={styles.offlineText}>En ligne</Text></TouchableOpacity>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(!showFilters)}><Text style={styles.filterBtnText}>{showFilters ? '\u2715' : '\u2699'}</Text></TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filterBar}>
          {[{key:'rides',label:'Courses',icon:'\uD83D\uDE97'},{key:'colis',label:'Colis',icon:'\uD83D\uDCE6'},{key:'commande',label:'Commandes',icon:'\uD83D\uDED2'},{key:'resto',label:'Restaurant',icon:'\uD83C\uDF7D\uFE0F'}].map((svc) => (
            <TouchableOpacity key={svc.key} style={[styles.filterChip, activeServices[svc.key] && styles.filterChipActive]} onPress={() => toggleService(svc.key)}>
              <Text style={styles.filterChipIcon}>{svc.icon}</Text><Text style={[styles.filterChipLabel, activeServices[svc.key] && styles.filterChipLabelActive]}>{svc.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!currentRequest && (
        <View style={styles.scanningBar}>
          <Animated.View style={[styles.scanningLine, { transform: [{ translateX: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-width, width] }) }] }]} />
          <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Menu')}><Text style={styles.menuIcon}>{"\u2630"}</Text></TouchableOpacity>
        </View>
      )}
      {currentRequest && (<View style={styles.menuBarWhenRequest}><TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Menu')}><Text style={styles.menuIcon}>{"\u2630"}</Text></TouchableOpacity></View>)}

      <Animated.View style={[styles.requestCard, { transform: [{ translateY: slideAnim }, { scale: pulseAnim }] }]}>
        {currentRequest ? (
          <View style={styles.requestContent}>
            <View style={styles.requestHeader}>
              <View><Text style={styles.requestTitle}>{currentRequest._isDelivery ? (currentRequest.serviceType === "colis" ? "\uD83D\uDCE6 Nouveau colis" : currentRequest.serviceType === "commande" ? "\uD83D\uDED2 Nouvelle commande" : "\uD83C\uDF7D\uFE0F Commande restaurant") : "Nouvelle course \uD83D\uDCCD"}</Text><Text style={styles.requestSubtitle}>{(currentRequest.distance || 0).toFixed(1)+' km \u2022 '+Math.round(currentRequest.distance * 2)+' min'+(currentRequest.distanceToPickup ? ' \u2022 '+currentRequest.distanceToPickup.toFixed(1)+'km de vous' : '')}</Text></View>
              <Text style={styles.fareText}>{(currentRequest.driverEarnings||currentRequest.fare||0).toLocaleString()+' FCFA'}</Text><Text style={styles.fareBreakdown}>{'Tarif passager: '+(currentRequest.fare||0).toLocaleString()+' | Commission: '+(currentRequest.platformCommission||0).toLocaleString()}</Text>
            </View>
            {currentRequest._isDelivery ? (
              <View style={styles.rideTypeRow}><View style={{width:40,height:40,borderRadius:20,backgroundColor:currentRequest.serviceType==='colis'?'rgba(255,149,0,0.15)':currentRequest.serviceType==='commande'?'rgba(175,82,222,0.15)':'rgba(255,59,48,0.15)',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:22, fontFamily: 'LexendDeca_400Regular' }}>{currentRequest.serviceType==='colis'?'\uD83D\uDCE6':currentRequest.serviceType==='commande'?'\uD83D\uDED2':'\uD83C\uDF7D\uFE0F'}</Text></View><View style={styles.rideTypeInfo}><Text style={styles.rideTypeName}>{currentRequest.serviceType==='colis'?'Livraison Colis':currentRequest.serviceType==='commande'?'Commande':'Restaurant'}</Text><Text style={styles.rideTypeDesc}>{currentRequest.restaurantName||(currentRequest.packageDetails?'Taille: '+currentRequest.packageDetails.size:'Livraison rapide')}</Text></View><View style={[styles.rideTypeBadge,{backgroundColor:'rgba(255,149,0,0.15)'}]}><Text style={[styles.rideTypeBadgeText,{color:'#FF9500'}]}>{(currentRequest.serviceType||'LIVRAISON').toUpperCase()}</Text></View></View>
            ) : (
              <View style={styles.rideTypeRow}><Image source={{uri:(CAR_IMAGES[currentRequest.rideType]||CAR_IMAGES.standard).uri}} style={styles.rideTypeImage} resizeMode='contain' /><View style={styles.rideTypeInfo}><Text style={styles.rideTypeName}>{(CAR_IMAGES[currentRequest.rideType]||CAR_IMAGES.standard).name}</Text><Text style={styles.rideTypeDesc}>{(CAR_IMAGES[currentRequest.rideType]||CAR_IMAGES.standard).description}</Text></View><View style={styles.rideTypeBadge}><Text style={styles.rideTypeBadgeText}>{(currentRequest.rideType||'standard').toUpperCase()}</Text></View></View>
            )}
            <View style={styles.addressesContainer}><View style={styles.addressRow}><View style={styles.greenDot}/><Text style={styles.addressText} numberOfLines={1}>{currentRequest.pickup.address}</Text></View><View style={styles.dashedLine}/><View style={styles.addressRow}><View style={styles.redSquare}/><Text style={styles.addressText} numberOfLines={1}>{currentRequest.dropoff.address}</Text></View></View>
            <View style={styles.actionButtons}><TouchableOpacity style={styles.rejectButton} onPress={handleReject} disabled={loading}><Text style={styles.rejectButtonText}>Rejeter</Text></TouchableOpacity><TouchableOpacity style={[styles.acceptButton, loading && styles.acceptButtonDisabled]} onPress={handleAccept} disabled={loading}><Text style={styles.acceptButtonText}>{loading ? 'Acceptation...' : 'Accepter'}</Text></TouchableOpacity></View>
            {rideRequests.length > 1 && <Text style={styles.queueText}>{'+' + (rideRequests.length - 1) + ' autre' + (rideRequests.length > 2 ? 's' : '') + ' en attente'}</Text>}
          </View>
        ) : (
          <View style={styles.emptyState}><Text style={styles.emptyIcon}>{"\uD83D\uDE97"}</Text><Text style={styles.emptyTitle}>En attente de courses</Text><Text style={styles.emptySubtitle}>Vous recevrez des offres bas\u00e9es sur votre position</Text></View>
        )}
      </Animated.View>

      {blockedForPayment && (
        <View style={styles.blockedOverlay}>
          <View style={styles.blockedCard}>
            <Text style={styles.blockedIcon}>{'\u26A0\uFE0F'}</Text>
            <Text style={styles.blockedTitle}>Commission impay\u00e9e</Text>
            <Text style={styles.blockedAmount}>{blockedForPayment.balance.toLocaleString() + ' FCFA'}</Text>
            <Text style={styles.blockedSub}>{'Veuillez payer votre solde pour continuer Ã  recevoir des courses.'}</Text>
            <View style={styles.blockedPayInfo}>
              <Text style={styles.blockedPayTitle}>Payer via Wave ou Orange Money :</Text>
              <Text style={styles.blockedPayNumber}>+221 77 807 91 03</Text>
              <Text style={styles.blockedPayNote}>{'Envoyez ' + blockedForPayment.balance.toLocaleString() + ' FCFA puis contactez le support pour d\u00e9bloquer votre compte.'}</Text>
            </View>
            <TouchableOpacity style={styles.blockedSupportBtn} onPress={() => { Linking.openURL('https://wa.me/17047263959'); }}><Text style={styles.blockedSupportText}>Contacter Support WhatsApp</Text></TouchableOpacity>
            <TouchableOpacity style={styles.blockedCloseBtn} onPress={() => { navigation.replace('Home'); }}><Text style={styles.blockedCloseText}>Retour</Text></TouchableOpacity>
          </View>
        </View>
      )}
      <ConfirmModal visible={showOfflineModal} title="Passer hors ligne?" message="Vous arrÃªterez de recevoir des courses" cancelText="Rester en ligne" confirmText="Hors ligne" onCancel={() => setShowOfflineModal(false)} onConfirm={handleGoOffline} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { ...StyleSheet.absoluteFillObject },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: COLORS.textDarkSub , fontFamily: 'LexendDeca_400Regular' },
  driverMarkerOuter: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  driverMarkerShadow: { position: 'absolute', bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.25)' },
  driverMarkerArrow: { width: 56, height: 56, alignItems: 'center' },
  driverArrowTop: { width: 0, height: 0, borderLeftWidth: 22, borderRightWidth: 22, borderBottomWidth: 40, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#D4AF37' },
  driverArrowBottom: { width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#D4A900', marginTop: -6 },
  driverMarkerDot: { position: 'absolute', top: 24, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#D4AF37' },
  topBar: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  earningsCard: { backgroundColor: COLORS.yellowGlow25, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, elevation: 4, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.4)' },
  earningsValue: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow, marginBottom: 2 },
  earningsLabel: { fontSize: 11, color: COLORS.textLightSub , fontFamily: 'LexendDeca_400Regular' },
  offlineButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.darkCard, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, elevation: 4, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green, marginRight: 8 },
  offlineText: { fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLight },
  filterBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.darkCard, borderWidth: 1, borderColor: COLORS.darkCardBorder, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  filterBtnText: { fontSize: 16, color: COLORS.textLight , fontFamily: 'LexendDeca_400Regular' },
  filterBar: { position: 'absolute', top: 110, left: 12, right: 12, flexDirection: 'row', gap: 8, zIndex: 10, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: COLORS.darkCard, borderRadius: 16, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  filterChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', gap: 4 },
  filterChipActive: { backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: COLORS.yellow },
  filterChipIcon: { fontSize: 14 , fontFamily: 'LexendDeca_400Regular' },
  filterChipLabel: { fontSize: 11, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightMuted },
  filterChipLabelActive: { color: COLORS.yellow, fontFamily: 'LexendDeca_700Bold' },
  scanningBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: COLORS.darkCard, overflow: 'hidden', justifyContent: 'center', borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  scanningLine: { position: 'absolute', width: 80, height: 4, backgroundColor: COLORS.yellow, borderRadius: 2 },
  menuBarWhenRequest: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: COLORS.darkCard, justifyContent: 'center', borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  menuButton: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  menuIcon: { fontSize: 28, color: COLORS.darkBg, fontFamily: 'LexendDeca_700Bold' },
  requestCard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.darkCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, elevation: 12, borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  requestContent: { padding: 24 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  requestTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 4 },
  requestSubtitle: { fontSize: 14, color: COLORS.textLightSub , fontFamily: 'LexendDeca_400Regular' },
  fareText: { fontSize: 24, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },
  fareBreakdown: { fontSize: 11, fontFamily: 'LexendDeca_400Regular', color: COLORS.textLightSub, marginTop: 2 },
  rideTypeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  rideTypeImage: { width: 70, height: 45, marginRight: 12 },
  rideTypeInfo: { flex: 1 },
  rideTypeName: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 2 },
  rideTypeDesc: { fontSize: 12, color: COLORS.textLightMuted , fontFamily: 'LexendDeca_400Regular' },
  rideTypeBadge: { backgroundColor: COLORS.yellow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rideTypeBadgeText: { fontSize: 11, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  addressesContainer: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green, marginRight: 12 },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red, marginRight: 12 },
  dashedLine: { height: 20, marginLeft: 6, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.15)', borderStyle: 'dashed', marginVertical: 4 },
  addressText: { flex: 1, fontSize: 14, color: COLORS.textLightSub, fontFamily: 'LexendDeca_500Medium' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  rejectButton: { flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  rejectButtonText: { fontSize: 16, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightSub },
  acceptButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.yellow, alignItems: 'center', elevation: 8 },
  acceptButtonDisabled: { opacity: 0.6 },
  acceptButtonText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  queueText: { textAlign: 'center', marginTop: 16, fontSize: 12, color: COLORS.textLightMuted , fontFamily: 'LexendDeca_400Regular' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 16 , fontFamily: 'LexendDeca_400Regular' },
  emptyTitle: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.textLightMuted, textAlign: 'center' , fontFamily: 'LexendDeca_400Regular' },
  blockedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 999 },
  blockedCard: { backgroundColor: COLORS.darkCard, borderRadius: 24, padding: 32, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: COLORS.darkCardBorder },
  blockedIcon: { fontSize: 48, marginBottom: 16 , fontFamily: 'LexendDeca_400Regular' },
  blockedTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: '#FF3B30', marginBottom: 8 },
  blockedAmount: { fontSize: 36, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow, marginBottom: 12 },
  blockedSub: { fontSize: 14, color: COLORS.textLightSub, textAlign: 'center', marginBottom: 24 , fontFamily: 'LexendDeca_400Regular' },
  blockedPayInfo: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 20, width: '100%', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  blockedPayTitle: { fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLight, marginBottom: 8 },
  blockedPayNumber: { fontSize: 24, fontFamily: 'LexendDeca_700Bold', color: COLORS.green, textAlign: 'center', marginBottom: 8 },
  blockedPayNote: { fontSize: 12, color: COLORS.textLightMuted, textAlign: 'center' , fontFamily: 'LexendDeca_400Regular' },
  blockedSupportBtn: { backgroundColor: '#25D366', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 12 },
  blockedSupportText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#fff' },
  blockedCloseBtn: { paddingVertical: 12 },
  blockedCloseText: { fontSize: 14, color: COLORS.textLightMuted , fontFamily: 'LexendDeca_400Regular' },
});

export default RideRequestsScreen;














