import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, Dimensions, Image } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { createAuthSocket } from '../services/socket';
import COLORS from '../constants/colors';
import CAR_IMAGES from '../constants/carImages';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { driverService, deliveryService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const { width, height } = Dimensions.get('window');

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
  const [activeServices, setActiveServices] = useState({ rides: true, colis: false, commande: false, resto: false });
  const activeServicesRef = useRef({ rides: true, colis: false, commande: false, resto: false });
  const [showFilters, setShowFilters] = useState(false);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);

  useEffect(() => { getLocation(); connectSocket(); fetchEarnings(); return () => { if (socket) { if (driverId) socket.emit('driver-offline', driverId); socket.disconnect(); } if (offerTimeout) clearTimeout(offerTimeout); }; }, []);
  useEffect(() => { if (currentRequest) showRequestCard(); else hideRequestCard(); }, [currentRequest]);
  useEffect(() => { if (!currentRequest) { Animated.loop(Animated.sequence([Animated.timing(scanAnim, { toValue: 1, duration: 1500, useNativeDriver: true }), Animated.timing(scanAnim, { toValue: 0, duration: 1500, useNativeDriver: true })])).start(); } else { scanAnim.setValue(0); } }, [currentRequest]);
  useEffect(() => { activeServicesRef.current = activeServices; }, [activeServices]);

  const fetchEarnings = async () => { try { const r = await driverService.getEarnings(); setEarnings({ today: r.earnings.today || 0, ridesCompleted: r.earnings.totalRides || 0 }); } catch (e) {} };
  const toggleService = async (key) => { const updated = { ...activeServices, [key]: !activeServices[key] }; if (!Object.values(updated).some(v => v)) { Alert.alert('Attention', 'Gardez au moins un service actif.'); return; } setActiveServices(updated); try { await driverService.updateServicePreferences(updated); } catch (e) { setActiveServices(activeServices); } };

  const getLocation = async () => {
    try { const { status } = await Location.requestForegroundPermissionsAsync(); if (status !== 'granted') { Alert.alert('Permission refus\u00e9e', 'Localisation requise'); return; }
      const cur = await Location.getCurrentPositionAsync({}); setLocation({ latitude: cur.coords.latitude, longitude: cur.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 });
      setInterval(async () => { const loc = await Location.getCurrentPositionAsync({}); setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }); await driverService.updateLocation(loc.coords.latitude, loc.coords.longitude); }, 10000);
    } catch (e) { console.error('Location error:', e); }
  };

  const connectSocket = () => {
    if (!driverId) return;
    createAuthSocket().then(function(newSocket) { setSocket(newSocket);
      newSocket.on('connect', () => { newSocket.emit('driver-online', { driverId, latitude: location?.latitude, longitude: location?.longitude }); });
      newSocket.on('new-ride-offer', (rideData) => { rideData._offerType = 'ride'; if (!activeServicesRef.current.rides) return; setRideRequests(prev => [...prev, rideData]); if (!currentRequest) { setCurrentRequest(rideData); const t = setTimeout(() => { handleReject(); }, rideData.offerExpiresIn || 15000); setOfferTimeout(t); } });
      newSocket.on('ride-taken', () => { Alert.alert('Course prise', 'Un autre chauffeur a accept\u00e9 cette course'); if (currentRequest) { setRideRequests(prev => prev.filter(r => r.rideId !== currentRequest.rideId)); const next = rideRequests.find(r => r.rideId !== currentRequest.rideId); setCurrentRequest(next || null); } });
      newSocket.on('new-delivery', (d) => { var sType = d.serviceType || 'colis'; if (sType === 'colis' && !activeServicesRef.current.colis) return; if (sType === 'commande' && !activeServicesRef.current.commande) return; if ((sType === 'resto' || sType === 'restaurant') && !activeServicesRef.current.resto) return; var offerData = { rideId: d.deliveryId, _offerType: d.serviceType || 'colis', _isDelivery: true, pickup: d.pickup, dropoff: d.dropoff, fare: d.fare, packageDetails: d.packageDetails, restaurantName: d.restaurantName, serviceType: d.serviceType, offerExpiresIn: 60000 }; setRideRequests(prev => [...prev, offerData]); if (!currentRequest) { setCurrentRequest(offerData); const t = setTimeout(() => { handleReject(); }, 60000); setOfferTimeout(t); } });
      newSocket.on('delivery-taken', () => { Alert.alert('Livraison prise', 'Un autre livreur a accept\u00e9.'); if (currentRequest && currentRequest._isDelivery) setCurrentRequest(null); });
      newSocket.on('disconnect', () => {});
    });
  };

  const showRequestCard = () => { Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start(); if (mapRef.current && currentRequest) { mapRef.current.fitToCoordinates([{ latitude: currentRequest.pickup.coordinates.latitude, longitude: currentRequest.pickup.coordinates.longitude }, { latitude: currentRequest.dropoff.coordinates.latitude, longitude: currentRequest.dropoff.coordinates.longitude }], { edgePadding: { top: 100, right: 50, bottom: 400, left: 50 }, animated: true }); } };
  const hideRequestCard = () => { Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(); };
  const handleGoOffline = async () => { setShowOfflineModal(false); try { await driverService.toggleOnlineStatus(false); if (socket && driverId) socket.emit('driver-offline', driverId); navigation.replace('Home'); } catch (e) { Alert.alert('Erreur', 'Impossible de passer hors ligne'); } };

  const handleAccept = async () => {
    if (!currentRequest) return; if (offerTimeout) { clearTimeout(offerTimeout); setOfferTimeout(null); } setLoading(true);
    try { if (currentRequest._isDelivery) { await deliveryService.acceptDelivery(currentRequest.rideId); setRideRequests(prev => prev.filter(r => r.rideId !== currentRequest.rideId)); navigation.replace('ActiveRide', { rideId: currentRequest.rideId, ride: currentRequest, deliveryMode: true, deliveryData: currentRequest }); } else { await driverService.acceptRide(currentRequest.rideId); setRideRequests(prev => prev.filter(r => r.rideId !== currentRequest.rideId)); navigation.replace('ActiveRide', { rideId: currentRequest.rideId, ride: currentRequest }); } setCurrentRequest(null); } catch (e) { Alert.alert('Erreur', e.response?.data?.message || "Impossible d'accepter"); } finally { setLoading(false); }
  };

  const handleReject = async () => { if (!currentRequest) return; if (offerTimeout) { clearTimeout(offerTimeout); setOfferTimeout(null); } try { if (!currentRequest._isDelivery) await driverService.rejectRide(currentRequest.rideId, 'Trop loin'); setRideRequests(prev => prev.filter(r => r.rideId !== currentRequest.rideId)); const next = rideRequests.find(r => r.rideId !== currentRequest.rideId); setCurrentRequest(next || null); } catch (e) {} };

  return (
    <View style={styles.container}>
      {location ? (
        <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE} customMapStyle={WAZE_DARK_STYLE} initialRegion={location} showsUserLocation={false} showsMyLocationButton={false} showsTraffic={true}>
          {location && <Marker coordinate={location} title="Votre position"><View style={styles.driverMarker}><Text style={styles.driverMarkerText}>{"\u25B2"}</Text></View></Marker>}
          {currentRequest && (<><Marker coordinate={{ latitude: currentRequest.pickup.coordinates.latitude, longitude: currentRequest.pickup.coordinates.longitude }} pinColor={COLORS.green} title="D\u00e9part" /><Marker coordinate={{ latitude: currentRequest.dropoff.coordinates.latitude, longitude: currentRequest.dropoff.coordinates.longitude }} pinColor={COLORS.red} title="Arriv\u00e9e" /><Circle center={{ latitude: currentRequest.pickup.coordinates.latitude, longitude: currentRequest.pickup.coordinates.longitude }} radius={500} strokeColor="rgba(0,133,63,0.3)" fillColor="rgba(0,133,63,0.1)" /></>)}
        </MapView>
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

      <Animated.View style={[styles.requestCard, { transform: [{ translateY: slideAnim }] }]}>
        {currentRequest ? (
          <View style={styles.requestContent}>
            <View style={styles.requestHeader}>
              <View><Text style={styles.requestTitle}>{currentRequest._isDelivery ? (currentRequest.serviceType === "colis" ? "\uD83D\uDCE6 Nouveau colis" : currentRequest.serviceType === "commande" ? "\uD83D\uDED2 Nouvelle commande" : "\uD83C\uDF7D\uFE0F Commande restaurant") : "Nouvelle course \uD83D\uDCCD"}</Text><Text style={styles.requestSubtitle}>{(currentRequest.distance || 0).toFixed(1)+' km \u2022 '+Math.round(currentRequest.distance * 2)+' min'+(currentRequest.distanceToPickup ? ' \u2022 '+currentRequest.distanceToPickup.toFixed(1)+'km de vous' : '')}</Text></View>
              <Text style={styles.fareText}>{currentRequest.fare.toLocaleString()+' FCFA'}</Text>
            </View>
            {currentRequest._isDelivery ? (
              <View style={styles.rideTypeRow}><View style={{width:40,height:40,borderRadius:20,backgroundColor:currentRequest.serviceType==='colis'?'rgba(255,149,0,0.15)':currentRequest.serviceType==='commande'?'rgba(175,82,222,0.15)':'rgba(255,59,48,0.15)',alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:22}}>{currentRequest.serviceType==='colis'?'\uD83D\uDCE6':currentRequest.serviceType==='commande'?'\uD83D\uDED2':'\uD83C\uDF7D\uFE0F'}</Text></View><View style={styles.rideTypeInfo}><Text style={styles.rideTypeName}>{currentRequest.serviceType==='colis'?'Livraison Colis':currentRequest.serviceType==='commande'?'Commande':'Restaurant'}</Text><Text style={styles.rideTypeDesc}>{currentRequest.restaurantName||(currentRequest.packageDetails?'Taille: '+currentRequest.packageDetails.size:'Livraison rapide')}</Text></View><View style={[styles.rideTypeBadge,{backgroundColor:'rgba(255,149,0,0.15)'}]}><Text style={[styles.rideTypeBadgeText,{color:'#FF9500'}]}>{(currentRequest.serviceType||'LIVRAISON').toUpperCase()}</Text></View></View>
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

      <ConfirmModal visible={showOfflineModal} title="Passer hors ligne?" message="Vous arr\u00eaterez de recevoir des courses" cancelText="Rester en ligne" confirmText="Hors ligne" onCancel={() => setShowOfflineModal(false)} onConfirm={handleGoOffline} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { ...StyleSheet.absoluteFillObject },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: COLORS.textDarkSub },
  driverMarker: { width: 40, height: 40, backgroundColor: COLORS.green, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
  driverMarkerText: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
  topBar: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  earningsCard: { backgroundColor: COLORS.darkCard, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, elevation: 4, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  earningsValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.yellow, marginBottom: 2 },
  earningsLabel: { fontSize: 11, color: COLORS.textLightSub },
  offlineButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.darkCard, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, elevation: 4, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green, marginRight: 8 },
  offlineText: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },
  filterBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.darkCard, borderWidth: 1, borderColor: COLORS.darkCardBorder, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  filterBtnText: { fontSize: 16, color: COLORS.textLight },
  filterBar: { position: 'absolute', top: 110, left: 12, right: 12, flexDirection: 'row', gap: 8, zIndex: 10, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: COLORS.darkCard, borderRadius: 16, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  filterChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', gap: 4 },
  filterChipActive: { backgroundColor: 'rgba(252,209,22,0.15)', borderWidth: 1, borderColor: COLORS.yellow },
  filterChipIcon: { fontSize: 14 },
  filterChipLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textLightMuted },
  filterChipLabelActive: { color: COLORS.yellow, fontWeight: '700' },
  scanningBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: COLORS.darkCard, overflow: 'hidden', justifyContent: 'center', borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  scanningLine: { position: 'absolute', width: 80, height: 4, backgroundColor: COLORS.yellow, borderRadius: 2 },
  menuBarWhenRequest: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, backgroundColor: COLORS.darkCard, justifyContent: 'center', borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  menuButton: { position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', elevation: 8 },
  menuIcon: { fontSize: 28, color: COLORS.darkBg, fontWeight: 'bold' },
  requestCard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.darkCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, elevation: 12, borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  requestContent: { padding: 24 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  requestTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 4 },
  requestSubtitle: { fontSize: 14, color: COLORS.textLightSub },
  fareText: { fontSize: 24, fontWeight: 'bold', color: COLORS.yellow },
  rideTypeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  rideTypeImage: { width: 70, height: 45, marginRight: 12 },
  rideTypeInfo: { flex: 1 },
  rideTypeName: { fontSize: 15, fontWeight: '700', color: COLORS.textLight, marginBottom: 2 },
  rideTypeDesc: { fontSize: 12, color: COLORS.textLightMuted },
  rideTypeBadge: { backgroundColor: COLORS.yellow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rideTypeBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.darkBg },
  addressesContainer: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green, marginRight: 12 },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red, marginRight: 12 },
  dashedLine: { height: 20, marginLeft: 6, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.15)', borderStyle: 'dashed', marginVertical: 4 },
  addressText: { flex: 1, fontSize: 14, color: COLORS.textLightSub, fontWeight: '500' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  rejectButton: { flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  rejectButtonText: { fontSize: 16, fontWeight: '600', color: COLORS.textLightSub },
  acceptButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.yellow, alignItems: 'center', elevation: 8 },
  acceptButtonDisabled: { opacity: 0.6 },
  acceptButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.darkBg },
  queueText: { textAlign: 'center', marginTop: 16, fontSize: 12, color: COLORS.textLightMuted },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: COLORS.textLightMuted, textAlign: 'center' },
});

export default RideRequestsScreen;
