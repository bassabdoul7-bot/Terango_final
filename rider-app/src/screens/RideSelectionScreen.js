import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Image } from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import * as PolylineUtil from '@mapbox/polyline';
import GlassButton from '../components/GlassButton';
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

  useEffect(() => { getDirections(); fetchNearbyDrivers(); }, []);
  useEffect(() => { if (routeCoordinates.length > 0) fitMapToRoute(); }, [routeCoordinates]);

  const fetchNearbyDrivers = async () => { try { const r = await driverService.getNearbyDrivers(pickup.coordinates.latitude, pickup.coordinates.longitude, 10); if (r.success) setNearbyDrivers(r.drivers); } catch (e) {} };

  const getDirections = async () => {
    setCalculatingFare(true);
    try {
      const url = `https://osrm.terango.sn/route/v1/driving/${pickup.coordinates.longitude},${pickup.coordinates.latitude};${dropoff.coordinates.longitude},${dropoff.coordinates.latitude}?overview=full&geometries=polyline&steps=true`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.code === 'Ok' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        const km = leg.distance / 1000;
        setRealDistance(km);
        setRealDuration(Math.round(leg.duration / 60));
        setRouteCoordinates(PolylineUtil.decode(route.geometry).map(p => ({ latitude: p[0], longitude: p[1] })));
        calculateFares(km, Math.round(leg.duration / 60));
      } else {
        Alert.alert('Erreur', "Impossible de calculer l'itineraire");
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert('Erreur', 'Erreur lors du calcul');
      navigation.goBack();
    }
  };

  const calculateFares = (distance, duration) => {
    var isSuburb = distance > 10;
    var hour = new Date().getHours();
    var surge = (hour >= 7 && hour < 9) ? 1.2 : (hour >= 17 && hour < 20) ? 1.3 : 1.0;
    function calcFare(base, cityRate, subRate, minRate, minFare) {
      var distFare = isSuburb ? (10 * cityRate) + ((distance - 10) * subRate) : (distance * cityRate);
      var timeFare = duration * minRate;
      var surged = Math.round((base + distFare + timeFare) * surge);
      var total = Math.ceil(surged / 100) * 100;
      return Math.max(total, minFare);
    }
    setFareEstimates({
      standard: { type: 'standard', name: 'TeranGO Standard', description: surge > 1 ? 'Heure de pointe x'+surge : 'Trajet economique', imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberX_v1.png', fare: calcFare(461, 73, 142, 29, 500), estimatedTime: duration, distance: distance.toFixed(1), capacity: '4' },
      comfort: { type: 'comfort', name: 'TeranGO Comfort', description: surge > 1 ? 'Heure de pointe x'+surge : 'Vehicule confortable', imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/Black_v1.png', fare: calcFare(665, 100, 180, 38, 700), estimatedTime: duration, distance: distance.toFixed(1), capacity: '4' },
      xl: { type: 'xl', name: 'TeranGO XL', description: surge > 1 ? 'Heure de pointe x'+surge : 'Vehicule spacieux', imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberXL_v1.png', fare: calcFare(1045, 140, 220, 48, 1000), estimatedTime: duration, distance: distance.toFixed(1), capacity: '7' }
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
      const r = await rideService.createRide({ pickup: { address: pickup.address, coordinates: pickup.coordinates }, dropoff: { address: dropoff.address, coordinates: dropoff.coordinates }, rideType: selectedType, paymentMethod: paymentMethod, distance: realDistance, estimatedDuration: realDuration });
      if (r.success) {
        const newRideId = r.ride?.id || r.ride?._id;
        navigation.replace('ActiveRide', { rideId: newRideId });
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
          <View style={{ height: 16 }} />
        </ScrollView>
        <View style={styles.confirmSection}><GlassButton title={loading ? 'Confirmation...' : 'Confirmer \u2022 '+(fareEstimates[selectedType]?.fare.toLocaleString())+' FCFA'} onPress={handleBookRide} loading={loading} /></View>
      </View>
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
  confirmSection: { padding: 16, paddingBottom: 28, backgroundColor: COLORS.darkCard },
});

export default RideSelectionScreen;








