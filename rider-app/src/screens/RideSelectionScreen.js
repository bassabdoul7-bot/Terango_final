import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Image } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as PolylineUtil from '@mapbox/polyline';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { rideService, driverService } from '../services/api.service';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const RideSelectionScreen = ({ route, navigation }) => {
  const { pickup, dropoff } = route.params;
  const mapRef = useRef(null);
  const [selectedType, setSelectedType] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [fareEstimates, setFareEstimates] = useState(null);
  const [calculatingFare, setCalculatingFare] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [realDistance, setRealDistance] = useState(0);
  const [realDuration, setRealDuration] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);

  useEffect(() => { getDirections(); fetchNearbyDrivers(); }, []);
  useEffect(() => { if (routeCoordinates.length > 0) fitMapToRoute(); }, [routeCoordinates]);

  const fetchNearbyDrivers = async () => { try { const r = await driverService.getNearbyDrivers(pickup.coordinates.latitude, pickup.coordinates.longitude, 10); if (r.success) setNearbyDrivers(r.drivers); } catch (e) {} };

  const getDirections = async () => {
    setCalculatingFare(true);
    try { const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.coordinates.latitude},${pickup.coordinates.longitude}&destination=${dropoff.coordinates.latitude},${dropoff.coordinates.longitude}&key=${GOOGLE_MAPS_KEY}&mode=driving&language=fr`; const r = await fetch(url); const data = await r.json();
      if (data.status === 'OK' && data.routes.length > 0) { const leg = data.routes[0].legs[0]; const km = leg.distance.value / 1000; setRealDistance(km); setRealDuration(Math.round(leg.duration.value / 60)); setRouteCoordinates(PolylineUtil.decode(data.routes[0].overview_polyline.points).map(p => ({ latitude: p[0], longitude: p[1] }))); calculateFares(km, Math.round(leg.duration.value / 60)); } else { Alert.alert('Erreur', "Impossible de calculer l'itin\u00e9raire"); navigation.goBack(); }
    } catch (e) { Alert.alert('Erreur', 'Erreur lors du calcul'); navigation.goBack(); }
  };

  const calculateFares = (distance, duration) => {
    setFareEstimates({
      standard: { type: 'standard', name: 'TeranGO Standard', description: 'Trajet \u00e9conomique', imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberX_v1.png', fare: Math.round(500 + (distance * 300)), estimatedTime: duration, distance: distance.toFixed(1), capacity: '4' },
      comfort: { type: 'comfort', name: 'TeranGO Comfort', description: 'V\u00e9hicule confortable', imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/Black_v1.png', fare: Math.round(800 + (distance * 400)), estimatedTime: duration, distance: distance.toFixed(1), capacity: '4' },
      xl: { type: 'xl', name: 'TeranGO XL', description: 'V\u00e9hicule spacieux', imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberXL_v1.png', fare: Math.round(1200 + (distance * 550)), estimatedTime: duration, distance: distance.toFixed(1), capacity: '7' }
    });
    setCalculatingFare(false);
  };

  const fitMapToRoute = () => { if (mapRef.current && routeCoordinates.length > 0) setTimeout(() => mapRef.current.fitToCoordinates(routeCoordinates, { edgePadding: { top: 100, right: 50, bottom: 380, left: 50 }, animated: true }), 500); };

  const handleBookRide = async () => {
    if (!selectedType || !fareEstimates) return Alert.alert('Erreur', 'S\u00e9lectionnez un type');
    setLoading(true);
    try { const r = await rideService.createRide({ pickup: { address: pickup.address, coordinates: pickup.coordinates }, dropoff: { address: dropoff.address, coordinates: dropoff.coordinates }, rideType: selectedType, paymentMethod: 'cash' }); if (r.success) navigation.replace('ActiveRide', { rideId: r.ride?.id || r.ride?._id }); } catch (e) { Alert.alert('Erreur', e.response?.data?.message || 'Impossible de cr\u00e9er la course'); } finally { setLoading(false); }
  };

  if (calculatingFare) return (<View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.green} /><Text style={styles.loadingText}>{"Calcul de l'itin\u00e9raire..."}</Text></View>);

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE} customMapStyle={WAZE_DARK_STYLE} initialRegion={{ latitude: (pickup.coordinates.latitude + dropoff.coordinates.latitude) / 2, longitude: (pickup.coordinates.longitude + dropoff.coordinates.longitude) / 2, latitudeDelta: 0.1, longitudeDelta: 0.1 }}>
        <Marker coordinate={pickup.coordinates} title="D\u00e9part"><View style={styles.pickupMarker}><View style={styles.pickupDot} /></View></Marker>
        <Marker coordinate={dropoff.coordinates} title="Arriv\u00e9e"><View style={styles.dropoffMarker}><View style={styles.dropoffSquare} /></View></Marker>
        {nearbyDrivers.map((d) => (<Marker key={d._id} coordinate={d.location} anchor={{ x: 0.5, y: 0.5 }}><View style={styles.driverMarker}><Text style={styles.driverIcon}>{"\uD83D\uDE97"}</Text></View></Marker>))}
        {routeCoordinates.length > 0 && <Polyline coordinates={routeCoordinates} strokeColor="#4285F4" strokeWidth={5} />}
      </MapView>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}><Text style={styles.backIcon}>{"\u2190"}</Text></TouchableOpacity>
      <View style={styles.tripInfoCard}><Text style={styles.tripTime}>{realDuration} min</Text><Text style={styles.tripAddress} numberOfLines={1}>{dropoff.address.split(',')[0]}</Text><Text style={styles.tripDistance}>{realDistance.toFixed(1)} km</Text>{nearbyDrivers.length > 0 && <View style={styles.driversBadge}><Text style={styles.driversBadgeText}>{nearbyDrivers.length+' \uD83D\uDE97'}</Text></View>}</View>
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
          <View style={styles.paymentCard}><Text style={styles.paymentLabel}>Paiement</Text><View style={styles.paymentRow}><View style={styles.paymentIconBg}><Text style={styles.paymentIcon}>{"\uD83D\uDCB5"}</Text></View><Text style={styles.paymentText}>{"Esp\u00e8ces"}</Text><Text style={styles.paymentArrow}>{"\u203A"}</Text></View></View>
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
  loadingText: { marginTop: 16, fontSize: 16, color: COLORS.textDarkSub },
  map: { width, height: height * 0.48 },
  pickupMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.green },
  pickupDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  dropoffMarker: { width: 26, height: 26, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.red },
  dropoffSquare: { width: 10, height: 10, backgroundColor: COLORS.red },
  driverMarker: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.green, elevation: 4 },
  driverIcon: { fontSize: 16 },
  backButton: { position: 'absolute', top: 60, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', elevation: 4, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  backIcon: { fontSize: 22, color: COLORS.textLight, fontWeight: 'bold' },
  tripInfoCard: { position: 'absolute', top: 60, right: 20, backgroundColor: COLORS.darkCard, borderRadius: 14, padding: 12, elevation: 4, maxWidth: width * 0.4, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  tripTime: { fontSize: 22, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 2 },
  tripAddress: { fontSize: 12, color: COLORS.textLightMuted, marginBottom: 2 },
  tripDistance: { fontSize: 12, color: COLORS.green, fontWeight: '600' },
  driversBadge: { marginTop: 6, backgroundColor: 'rgba(0,133,63,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  driversBadgeText: { fontSize: 11, fontWeight: '600', color: COLORS.green },
  bottomSheet: { flex: 1, backgroundColor: COLORS.darkCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, elevation: 12, borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  sheetHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  rideCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  rideCardSelected: { borderColor: COLORS.yellow, backgroundColor: 'rgba(252,209,22,0.08)' },
  rideLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  rideImage: { width: 70, height: 50, marginRight: 10 },
  rideInfo: { flex: 1 },
  rideName: { fontSize: 14, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 2 },
  rideCapacity: { fontSize: 11, color: COLORS.textLightMuted, marginBottom: 2 },
  rideTime: { fontSize: 11, color: COLORS.textLightMuted },
  rideFare: { fontSize: 16, fontWeight: 'bold', color: COLORS.yellow },
  paymentCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  paymentLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textLightMuted, marginBottom: 10 },
  paymentRow: { flexDirection: 'row', alignItems: 'center' },
  paymentIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  paymentIcon: { fontSize: 18 },
  paymentText: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.textLight },
  paymentArrow: { fontSize: 22, color: COLORS.textLightMuted },
  confirmSection: { padding: 16, paddingBottom: 28, backgroundColor: COLORS.darkCard },
});

export default RideSelectionScreen;
