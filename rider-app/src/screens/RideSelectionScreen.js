import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Image, Modal } from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import * as PolylineUtil from '@mapbox/polyline';
import GlassButton from '../components/GlassButton';
import NominatimAutocomplete from '../components/NominatimAutocomplete';
import COLORS from '../constants/colors';
import { rideService, driverService } from '../services/api.service';

const { width, height } = Dimensions.get('window');
const TERANGO_STYLE = require('../constants/terangoMapStyle.json');

const RideSelectionScreen = ({ route, navigation }) => {
  const { pickup, dropoff } = route.params;
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const [selectedType, setSelectedType] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [fareEstimates, setFareEstimates] = useState(null);
  const [calculatingFare, setCalculatingFare] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [realDistance, setRealDistance] = useState(0);
  const [realDuration, setRealDuration] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [scheduledTime, setScheduledTime] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [stop, setStop] = useState(null);
  const [showStopModal, setShowStopModal] = useState(false);

  const getScheduleOptions = () => {
    var now = new Date();
    var tomorrow7 = new Date(now);
    tomorrow7.setDate(tomorrow7.getDate() + 1);
    tomorrow7.setHours(7, 0, 0, 0);
    var tomorrow18 = new Date(now);
    tomorrow18.setDate(tomorrow18.getDate() + 1);
    tomorrow18.setHours(18, 0, 0, 0);
    return [
      { label: 'Dans 30 min', time: new Date(now.getTime() + 30 * 60 * 1000) },
      { label: 'Dans 1 heure', time: new Date(now.getTime() + 60 * 60 * 1000) },
      { label: 'Dans 2 heures', time: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
      { label: 'Demain matin (7h)', time: tomorrow7 },
      { label: 'Demain soir (18h)', time: tomorrow18 },
    ];
  };

  const formatScheduledTime = (date) => {
    if (!date) return '';
    var d = new Date(date);
    var now = new Date();
    var isToday = d.toDateString() === now.toDateString();
    var tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var isTomorrow = d.toDateString() === tomorrow.toDateString();
    var timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return "Aujourd'hui " + timeStr;
    if (isTomorrow) return 'Demain ' + timeStr;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + timeStr;
  };

  useEffect(() => { getDirections(); fetchNearbyDrivers(); }, []);
  useEffect(() => { if (routeCoordinates.length > 0) fitMapToRoute(); }, [routeCoordinates]);

  const fetchNearbyDrivers = async () => { try { const r = await driverService.getNearbyDrivers(pickup.coordinates.latitude, pickup.coordinates.longitude, 10); if (r.success) setNearbyDrivers(r.drivers); } catch (e) {} };

  const GOOGLE_MAPS_KEY = 'AIzaSyCwm1J7ULt8EnKX-0Gyj6Y_AxISDkbRSkw';

  const getGoogleRoute = async (currentStop) => {
    try {
      var waypointParam = '';
      if (currentStop) {
        waypointParam = `&waypoints=${currentStop.coordinates.latitude},${currentStop.coordinates.longitude}`;
      }
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.coordinates.latitude},${pickup.coordinates.longitude}&destination=${dropoff.coordinates.latitude},${dropoff.coordinates.longitude}${waypointParam}&key=${GOOGLE_MAPS_KEY}`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.status === 'OK' && data.routes.length > 0) {
        const legs = data.routes[0].legs;
        var totalDistance = 0;
        var totalDuration = 0;
        for (var i = 0; i < legs.length; i++) {
          totalDistance += legs[i].distance.value;
          totalDuration += legs[i].duration.value;
        }
        const coordinates = PolylineUtil.decode(data.routes[0].overview_polyline.points).map(p => ({ latitude: p[0], longitude: p[1] }));
        return { distance: totalDistance / 1000, duration: Math.round(totalDuration / 60), coordinates };
      }
    } catch (e) { console.log('Google Directions error:', e); }
    return null;
  };

  const getOSRMRoute = async (currentStop) => {
    try {
      var waypoints = `${pickup.coordinates.longitude},${pickup.coordinates.latitude}`;
      if (currentStop) {
        waypoints += `;${currentStop.coordinates.longitude},${currentStop.coordinates.latitude}`;
      }
      waypoints += `;${dropoff.coordinates.longitude},${dropoff.coordinates.latitude}`;
      const url = `https://osrm.terango.sn/route/v1/driving/${waypoints}?overview=full&geometries=polyline&steps=true`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.code === 'Ok' && data.routes.length > 0) {
        const route = data.routes[0];
        var totalDistance = 0;
        var totalDuration = 0;
        for (var i = 0; i < route.legs.length; i++) {
          totalDistance += route.legs[i].distance;
          totalDuration += route.legs[i].duration;
        }
        return { distance: totalDistance / 1000, duration: Math.round(totalDuration / 60), coordinates: PolylineUtil.decode(route.geometry).map(p => ({ latitude: p[0], longitude: p[1] })) };
      }
    } catch (e) { console.log('OSRM error:', e); }
    return null;
  };

  const getDirections = async (currentStop) => {
    setCalculatingFare(true);
    try {
      // Try Google first (accurate distance + route line in one call)
      const googleResult = await getGoogleRoute(currentStop || null);
      if (googleResult) {
        setRouteCoordinates(googleResult.coordinates);
        setRealDistance(googleResult.distance);
        setRealDuration(googleResult.duration);
        calculateFares(googleResult.distance, googleResult.duration);
        return;
      }

      // Fallback to OSRM if Google fails
      const osrmResult = await getOSRMRoute(currentStop || null);
      if (osrmResult) {
        setRouteCoordinates(osrmResult.coordinates);
        setRealDistance(osrmResult.distance);
        setRealDuration(osrmResult.duration);
        calculateFares(osrmResult.distance, osrmResult.duration);
        return;
      }

      Alert.alert('Erreur', "Impossible de calculer l'itineraire");
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erreur', 'Erreur lors du calcul');
      navigation.goBack();
    }
  };

  const calculateFares = (distance, duration) => {
    var hour = new Date().getHours();
    var surge = (hour >= 7 && hour < 9) ? 1.2 : (hour >= 17 && hour < 20) ? 1.3 : 1.0;
    function calcFare(base, cityRate, subRate, intercityRate, longDistRate, minRate, minFare) {
      var distFare;
      if (distance > 70) {
        distFare = (10 * cityRate) + (20 * subRate) + (40 * intercityRate) + ((distance - 70) * longDistRate);
      } else if (distance > 30) {
        distFare = (10 * cityRate) + (20 * subRate) + ((distance - 30) * intercityRate);
      } else if (distance > 10) {
        distFare = (10 * cityRate) + ((distance - 10) * subRate);
      } else {
        distFare = distance * cityRate;
      }
      var timeFare = duration * minRate;
      var surged = Math.round((base + distFare + timeFare) * surge);
      var total = Math.ceil(surged / 100) * 100;
      return Math.max(total, minFare);
    }
    setFareEstimates({
      standard: { type: 'standard', name: 'TeranGO Eco', description: surge > 1 ? 'Heure de pointe x'+surge : 'Trajet economique', imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberX_v1.png', fare: calcFare(515, 86, 171, 200, 260, 28, 500), estimatedTime: duration, distance: distance.toFixed(1), capacity: '4' },
      comfort: { type: 'comfort', name: 'TeranGO Comfort', description: surge > 1 ? 'Heure de pointe x'+surge : 'Vehicule confortable', imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/Black_v1.png', fare: calcFare(740, 115, 215, 250, 325, 37, 700), estimatedTime: duration, distance: distance.toFixed(1), capacity: '4' },
      xl: { type: 'xl', name: 'TeranGO XL', description: surge > 1 ? 'Heure de pointe x'+surge : 'Vehicule spacieux', imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberXL_v1.png', fare: calcFare(1150, 160, 265, 310, 400, 46, 1000), estimatedTime: duration, distance: distance.toFixed(1), capacity: '7' }
    });
    setCalculatingFare(false);
  };


  const fitMapToRoute = () => {
    if (cameraRef.current && routeCoordinates.length > 0) {
      const lats = routeCoordinates.map(c => c.latitude);
      const lons = routeCoordinates.map(c => c.longitude);
      const ne = [Math.max(...lons), Math.max(...lats)];
      const sw = [Math.min(...lons), Math.min(...lats)];
      setTimeout(() => { cameraRef.current.fitBounds([sw[0], sw[1], ne[0], ne[1]], {top: 100, right: 50, bottom: 380, left: 50}, 500); }, 500);
    }
  };

  const routeGeoJSON = routeCoordinates.length > 0 ? {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: routeCoordinates.map(c => [c.longitude, c.latitude]) }
  } : null;

  const paymentOptions = [
    { key: 'cash', label: 'Especes', icon: '\uD83D\uDCB5', color: COLORS.yellow },
    { key: 'wave', label: 'Wave', icon: '\uD83C\uDF0A', color: COLORS.wave },
  ];
  const selectedPaymentOption = paymentOptions.find(p => p.key === paymentMethod) || paymentOptions[0];

  const handleBookRide = async () => {
    if (!selectedType || !fareEstimates) return Alert.alert('Erreur', 'Selectionnez un type');
    setLoading(true);
    try {
      var rideData = { pickup: { address: pickup.address, coordinates: pickup.coordinates }, dropoff: { address: dropoff.address, coordinates: dropoff.coordinates }, rideType: selectedType, paymentMethod: paymentMethod, distance: realDistance, estimatedDuration: realDuration };
      if (stop) {
        rideData.stops = [{ address: stop.address, coordinates: stop.coordinates }];
      }
      if (scheduledTime) {
        rideData.scheduledTime = scheduledTime.toISOString();
      }
      const r = await rideService.createRide(rideData);
      if (r.success) {
        if (scheduledTime) {
          Alert.alert('Course programmee!', r.message || 'Votre course a ete programmee.', [{ text: 'OK', onPress: function() { navigation.replace('Home'); } }]);
        } else {
          const newRideId = r.ride?.id || r.ride?._id;
          navigation.replace('ActiveRide', { rideId: newRideId });
        }
      }
    } catch (e) {
      Alert.alert('Erreur', e.response?.data?.message || 'Impossible de creer la course');
    } finally { setLoading(false); }
  };

  if (calculatingFare) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.green} /><Text style={styles.loadingText}>{"Calcul de l'itineraire..."}</Text></View>);

  const centerLat = (pickup.coordinates.latitude + dropoff.coordinates.latitude) / 2;
  const centerLon = (pickup.coordinates.longitude + dropoff.coordinates.longitude) / 2;

  return (
    <View style={styles.container}>
      <Map ref={mapRef} style={styles.map} mapStyle={TERANGO_STYLE} logo={false} attribution={false}>
        <Camera ref={cameraRef} center={[centerLon, centerLat]} zoom={12} />
        <Marker id="pickup" lngLat={[pickup.coordinates.longitude, pickup.coordinates.latitude]}>
          <View style={styles.pickupMarker}><View style={styles.pickupDot} /></View>
        </Marker>
        <Marker id="dropoff" lngLat={[dropoff.coordinates.longitude, dropoff.coordinates.latitude]}>
          <View style={styles.dropoffMarker}><View style={styles.dropoffSquare} /></View>
        </Marker>
        {stop && (
          <Marker id="stop" lngLat={[stop.coordinates.longitude, stop.coordinates.latitude]}>
            <View style={styles.stopMarker}><View style={styles.stopDiamond} /></View>
          </Marker>
        )}
        {nearbyDrivers.map((d) => (
          <Marker key={d._id} id={`driver_${d._id}`} lngLat={[d.location.longitude, d.location.latitude]}>
            <View style={styles.driverMarker}><Text style={styles.driverIcon}>{"\uD83D\uDE97"}</Text></View>
          </Marker>
        ))}
        {routeGeoJSON && (
          <GeoJSONSource id="routeSource" data={routeGeoJSON}>
            <Layer type="line" id="routeShadow" paint={{ "line-color": "#4285F4", "line-width": 12, "line-opacity": 0.3  }} layout={{ "line-cap": "round", "line-join": "round" }} />
            <Layer type="line" id="routeLine" paint={{ "line-color": "#4285F4", "line-width": 5  }} layout={{ "line-cap": "round", "line-join": "round" }} />
          </GeoJSONSource>
        )}
      </Map>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backIcon}>{"\u2190"}</Text></TouchableOpacity>
      <View style={styles.tripInfoCard}>
        <Text style={styles.tripTime}>{realDuration} min</Text>
        <Text style={styles.tripAddress} numberOfLines={1}>{dropoff.address.split(',')[0]}</Text>
        <Text style={styles.tripDistance}>{realDistance.toFixed(1)} km</Text>
        {nearbyDrivers.length > 0 && <View style={styles.driversBadge}><Text style={styles.driversBadgeText}>{nearbyDrivers.length+' \uD83D\uDE97'}</Text></View>}
      </View>
      <View style={styles.bottomSheet}>
        <View style={styles.sheetHandle} />
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {fareEstimates && Object.values(fareEstimates).map((ride) => (
            <TouchableOpacity key={ride.type} onPress={() => setSelectedType(ride.type)} activeOpacity={0.8}>
              <View style={[styles.rideCard, selectedType === ride.type && styles.rideCardSelected]}>
                <View style={styles.rideLeft}><Image source={{ uri: ride.imageUri }} style={styles.rideImage} resizeMode="contain" /><View style={styles.rideInfo}><Text style={styles.rideName}>{ride.name}</Text><Text style={styles.rideCapacity}>{'\uD83D\uDC64 '+ride.capacity+' places'}</Text><Text style={styles.rideTime}>{ride.estimatedTime+' min \u2022 '+ride.distance+' km'}</Text></View></View>
                <Text style={styles.rideFare}>{ride.fare.toLocaleString()+' F'}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {stop ? (
            <View style={styles.stopCard}>
              <View style={styles.stopCardLeft}>
                <View style={styles.stopCardDot} />
                <View style={styles.stopCardTextWrap}>
                  <Text style={styles.stopCardLabel}>Arret</Text>
                  <Text style={styles.stopCardAddress} numberOfLines={1}>{stop.address}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => { setStop(null); getDirections(null); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.stopCardRemove}>{"\u2715"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addStopButton} onPress={() => setShowStopModal(true)} activeOpacity={0.7}>
              <Text style={styles.addStopIcon}>+</Text>
              <Text style={styles.addStopText}>Ajouter un arret</Text>
            </TouchableOpacity>
          )}
          <View style={styles.paymentSection}>
            <Text style={styles.paymentLabel}>Mode de paiement</Text>
            <View style={styles.paymentOptionsRow}>
              <TouchableOpacity style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionSelected]} onPress={() => setPaymentMethod('cash')} activeOpacity={0.7}>
                <Text style={styles.paymentOptionIcon}>{'\uD83D\uDCB5'}</Text>
                <Text style={[styles.paymentOptionText, paymentMethod === 'cash' && styles.paymentOptionTextSelected]}>Especes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.paymentOption, paymentMethod === 'wave' && { borderColor: COLORS.wave, backgroundColor: 'rgba(29,195,225,0.12)' }]} onPress={() => setPaymentMethod('wave')} activeOpacity={0.7}>
                <Text style={styles.paymentOptionIcon}>{'\uD83C\uDF0A'}</Text>
                <Text style={[styles.paymentOptionText, paymentMethod === 'wave' && { color: COLORS.wave }]}>Wave</Text>
              </TouchableOpacity>
            </View>
            {paymentMethod === 'cash' && <Text style={styles.paymentHint}>Payez en especes au chauffeur a l'arrivee</Text>}
            {paymentMethod === 'wave' && <Text style={[styles.paymentHint, { color: COLORS.wave }]}>Payez par Wave au chauffeur</Text>}
          </View>
          <View style={styles.scheduleSection}>
            <TouchableOpacity style={[styles.scheduleToggle, scheduledTime && styles.scheduleToggleActive]} onPress={() => { if (scheduledTime) { setScheduledTime(null); } else { setShowScheduleModal(true); } }} activeOpacity={0.7}>
              <Text style={styles.scheduleIcon}>{"\uD83D\uDD52"}</Text>
              <Text style={[styles.scheduleToggleText, scheduledTime && styles.scheduleToggleTextActive]}>{scheduledTime ? formatScheduledTime(scheduledTime) : 'Programmer'}</Text>
              {scheduledTime && <TouchableOpacity onPress={() => setScheduledTime(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={styles.scheduleClear}>{"\u2715"}</Text></TouchableOpacity>}
            </TouchableOpacity>
          </View>
          <View style={{ height: 16 }} />
        </ScrollView>
        <View style={styles.confirmSection}><GlassButton title={loading ? 'Confirmation...' : (scheduledTime ? 'Programmer \u2022 ' : 'Confirmer \u2022 ')+(fareEstimates[selectedType]?.fare.toLocaleString())+' FCFA'} onPress={handleBookRide} loading={loading} /></View>
      </View>
      <Modal visible={showStopModal} transparent animationType="slide">
        <View style={styles.stopModalOverlay}>
          <View style={styles.stopModalCard}>
            <Text style={styles.stopModalTitle}>Ajouter un arret</Text>
            <Text style={styles.stopModalSub}>Le chauffeur s'arretera a cette adresse</Text>
            <NominatimAutocomplete
              placeholder="Chercher une adresse..."
              autoFocus={true}
              onSelect={(data, details) => {
                var selectedStop = {
                  address: data.description,
                  coordinates: {
                    latitude: details.geometry.location.lat,
                    longitude: details.geometry.location.lng
                  }
                };
                setStop(selectedStop);
                setShowStopModal(false);
                getDirections(selectedStop);
              }}
            />
            <TouchableOpacity style={styles.stopModalCancel} onPress={() => setShowStopModal(false)}>
              <Text style={styles.stopModalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={showScheduleModal} transparent animationType="fade">
        <View style={styles.scheduleModalOverlay}>
          <View style={styles.scheduleModalCard}>
            <Text style={styles.scheduleModalTitle}>Programmer la course</Text>
            <Text style={styles.scheduleModalSub}>Choisissez quand partir</Text>
            {getScheduleOptions().map((opt, idx) => (
              <TouchableOpacity key={idx} style={styles.scheduleOptionBtn} onPress={() => { setScheduledTime(opt.time); setShowScheduleModal(false); }} activeOpacity={0.7}>
                <Text style={styles.scheduleOptionText}>{opt.label}</Text>
                <Text style={styles.scheduleOptionTime}>{opt.time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.scheduleModalCancel} onPress={() => setShowScheduleModal(false)}>
              <Text style={styles.scheduleModalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 16, fontSize: 16, color: COLORS.textDarkSub, fontFamily: 'LexendDeca_400Regular' },
  map: { width, height: height * 0.48 },
  pickupMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.green },
  pickupDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  dropoffMarker: { width: 26, height: 26, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.red },
  dropoffSquare: { width: 10, height: 10, backgroundColor: COLORS.red },
  driverMarker: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.green, elevation: 4 },
  driverIcon: { fontSize: 16, fontFamily: 'LexendDeca_400Regular' },
  backButton: { position: 'absolute', top: 60, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', elevation: 4, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  backIcon: { fontSize: 22, color: COLORS.textLight, fontFamily: 'LexendDeca_700Bold' },
  tripInfoCard: { position: 'absolute', top: 60, right: 20, backgroundColor: COLORS.darkCard, borderRadius: 14, padding: 12, elevation: 4, maxWidth: width * 0.4, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  tripTime: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 2 },
  tripAddress: { fontSize: 12, color: COLORS.textLightMuted, marginBottom: 2, fontFamily: 'LexendDeca_400Regular' },
  tripDistance: { fontSize: 12, color: COLORS.green, fontFamily: 'LexendDeca_600SemiBold' },
  driversBadge: { marginTop: 6, backgroundColor: 'rgba(0,133,63,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  driversBadgeText: { fontSize: 11, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.green },
  bottomSheet: { flex: 1, backgroundColor: COLORS.darkCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, elevation: 12, borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  sheetHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  rideCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  rideCardSelected: { borderColor: COLORS.yellow, backgroundColor: 'rgba(212,175,55,0.08)' },
  rideLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  rideImage: { width: 70, height: 50, marginRight: 10 },
  rideInfo: { flex: 1 },
  rideName: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 2 },
  rideCapacity: { fontSize: 11, color: COLORS.textLightMuted, marginBottom: 2, fontFamily: 'LexendDeca_400Regular' },
  rideTime: { fontSize: 11, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular' },
  rideFare: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },
  paymentSection: { marginTop: 4 },
  paymentLabel: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightMuted, marginBottom: 10 },
  paymentOptionsRow: { flexDirection: 'row', gap: 10 },
  paymentOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: 'transparent', gap: 8 },
  paymentOptionSelected: { borderColor: COLORS.yellow, backgroundColor: 'rgba(212,175,55,0.08)' },
  paymentOptionIcon: { fontSize: 20 },
  paymentOptionText: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightMuted },
  paymentOptionTextSelected: { color: COLORS.yellow },
  paymentHint: { fontSize: 11, fontFamily: 'LexendDeca_400Regular', color: COLORS.textLightMuted, marginTop: 10, textAlign: 'center' },
  scheduleSection: { marginTop: 10 },
  scheduleToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: 'transparent', gap: 8 },
  scheduleToggleActive: { borderColor: COLORS.green, backgroundColor: 'rgba(0,133,63,0.12)' },
  scheduleIcon: { fontSize: 18 },
  scheduleToggleText: { fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightMuted },
  scheduleToggleTextActive: { color: COLORS.green },
  scheduleClear: { fontSize: 14, color: COLORS.textLightMuted, marginLeft: 8, fontFamily: 'LexendDeca_700Bold' },
  scheduleModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  scheduleModalCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  scheduleModalTitle: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, textAlign: 'center', marginBottom: 4 },
  scheduleModalSub: { fontSize: 13, fontFamily: 'LexendDeca_400Regular', color: COLORS.textLightMuted, textAlign: 'center', marginBottom: 20 },
  scheduleOptionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 8 },
  scheduleOptionText: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLight },
  scheduleOptionTime: { fontSize: 14, fontFamily: 'LexendDeca_400Regular', color: COLORS.textLightMuted },
  scheduleModalCancel: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
  scheduleModalCancelText: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightMuted },
  stopMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FF9500' },
  stopDiamond: { width: 10, height: 10, backgroundColor: '#FF9500', transform: [{ rotate: '45deg' }] },
  addStopButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', borderStyle: 'dashed', marginBottom: 10, gap: 8 },
  addStopIcon: { fontSize: 18, color: '#FF9500', fontFamily: 'LexendDeca_700Bold' },
  addStopText: { fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', color: '#FF9500' },
  stopCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,149,0,0.1)', borderWidth: 1.5, borderColor: 'rgba(255,149,0,0.3)', marginBottom: 10 },
  stopCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  stopCardDot: { width: 12, height: 12, backgroundColor: '#FF9500', transform: [{ rotate: '45deg' }], marginRight: 12 },
  stopCardTextWrap: { flex: 1 },
  stopCardLabel: { fontSize: 11, color: '#FF9500', fontFamily: 'LexendDeca_600SemiBold', marginBottom: 2 },
  stopCardAddress: { fontSize: 13, color: COLORS.textLight, fontFamily: 'LexendDeca_400Regular' },
  stopCardRemove: { fontSize: 16, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_700Bold', padding: 4 },
  stopModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-start', paddingTop: 80 },
  stopModalCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 24, marginHorizontal: 16, maxHeight: '80%', borderWidth: 1, borderColor: COLORS.darkCardBorder },
  stopModalTitle: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, textAlign: 'center', marginBottom: 4 },
  stopModalSub: { fontSize: 13, fontFamily: 'LexendDeca_400Regular', color: COLORS.textLightMuted, textAlign: 'center', marginBottom: 16 },
  stopModalCancel: { marginTop: 16, paddingVertical: 14, alignItems: 'center' },
  stopModalCancelText: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightMuted },
  confirmSection: { padding: 16, paddingBottom: 28, backgroundColor: COLORS.darkCard },
});

export default RideSelectionScreen;








