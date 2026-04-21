import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Dimensions, Image, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
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
  const [stop, setStop] = useState(null);
  const [showStopModal, setShowStopModal] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  useEffect(() => { getDirections(stop); fetchNearbyDrivers(); }, []);
  useEffect(() => { if (routeCoordinates.length > 0) fitMapToRoute(); }, [routeCoordinates]);
  useEffect(() => { if (stop !== null) getDirections(stop); }, [stop]);

  const fetchNearbyDrivers = async () => { try { const r = await driverService.getNearbyDrivers(pickup.coordinates.latitude, pickup.coordinates.longitude, 10); if (r.success) setNearbyDrivers(r.drivers); } catch (e) {} };

  const GOOGLE_MAPS_KEY = 'AIzaSyCwm1J7ULt8EnKX-0Gyj6Y_AxISDkbRSkw';

  const getDirections = async (currentStop) => {
    setCalculatingFare(true);
    try {
      // Try Google first
      try {
        var waypointParam = '';
        if (currentStop) waypointParam = `&waypoints=${currentStop.coordinates.latitude},${currentStop.coordinates.longitude}`;
        const gUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.coordinates.latitude},${pickup.coordinates.longitude}&destination=${dropoff.coordinates.latitude},${dropoff.coordinates.longitude}${waypointParam}&key=${GOOGLE_MAPS_KEY}`;
        const gR = await fetch(gUrl);
        const gData = await gR.json();
        if (gData.status === 'OK' && gData.routes.length > 0) {
          var totalDist = 0, totalDur = 0;
          gData.routes[0].legs.forEach(function(leg) { totalDist += leg.distance.value; totalDur += leg.duration.value; });
          const km = totalDist / 1000;
          const mins = Math.round(totalDur / 60);
          const coords = PolylineUtil.decode(gData.routes[0].overview_polyline.points).map(p => ({ latitude: p[0], longitude: p[1] }));
          setRealDistance(km);
          setRealDuration(mins);
          setRouteCoordinates(coords);
          calculateFares(km, mins);
          return;
        }
      } catch (e) { console.log('Google Directions error:', e); }

      // Fallback to OSRM
      var osrmWaypoints = `${pickup.coordinates.longitude},${pickup.coordinates.latitude}`;
      if (currentStop) osrmWaypoints += `;${currentStop.coordinates.longitude},${currentStop.coordinates.latitude}`;
      osrmWaypoints += `;${dropoff.coordinates.longitude},${dropoff.coordinates.latitude}`;
      const url = `https://osrm.terango.sn/route/v1/driving/${osrmWaypoints}?overview=full&geometries=polyline&steps=true`;
      const r = await fetch(url);
      const data = await r.json();
      if (data.code === 'Ok' && data.routes.length > 0) {
        const route = data.routes[0];
        var totalDist2 = 0, totalDur2 = 0;
        route.legs.forEach(function(l) { totalDist2 += l.distance; totalDur2 += l.duration; });
        const km = totalDist2 / 1000;
        setRealDistance(km);
        setRealDuration(Math.round(totalDur2 / 60));
        setRouteCoordinates(PolylineUtil.decode(route.geometry).map(p => ({ latitude: p[0], longitude: p[1] })));
        calculateFares(km, Math.round(totalDur2 / 60));
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

  const formatScheduledTime = (date) => {
    if (!date) return '';
    var d = new Date(date);
    var now = new Date();
    var isToday = d.toDateString() === now.toDateString();
    var tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    var isTomorrow = d.toDateString() === tomorrow.toDateString();
    var timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return "Aujourd'hui " + timeStr;
    if (isTomorrow) return 'Demain ' + timeStr;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + timeStr;
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (!selectedDate || event.type === 'dismissed') return;
    var d = new Date(selectedDate);
    setTempDate(d);
    setTimeout(function() { setShowTimePicker(true); }, 300);
  };

  const handleTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (!selectedTime || event.type === 'dismissed') return;
    var d = new Date(tempDate);
    d.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    if (d.getTime() < Date.now() + 30 * 60 * 1000) {
      Alert.alert('Erreur', 'La course doit etre programmee au moins 30 minutes a l\'avance');
      return;
    }
    setScheduledTime(d);
    console.log('Scheduled time set:', d.toISOString());
  };

  const handleBookRide = async () => {
    if (!selectedType || !fareEstimates) return Alert.alert('Erreur', 'Selectionnez un type');
    setLoading(true);
    try {
      var rideData = { pickup: { address: pickup.address, coordinates: pickup.coordinates }, dropoff: { address: dropoff.address, coordinates: dropoff.coordinates }, rideType: selectedType, paymentMethod: paymentMethod, distance: realDistance, estimatedDuration: realDuration };
      if (stop) rideData.stops = [{ address: stop.address, coordinates: stop.coordinates }];
      if (scheduledTime) {
        rideData.scheduledTime = scheduledTime.toISOString();
        console.log('Booking scheduled ride for:', rideData.scheduledTime);
      }
      const r = await rideService.createRide(rideData);
      if (r.success) {
        if (scheduledTime) {
          Alert.alert('Course programmee!', r.message || 'Votre course a ete programmee pour ' + formatScheduledTime(scheduledTime), [{ text: 'OK', onPress: function() { navigation.replace('Home'); } }]);
        } else {
          navigation.replace('ActiveRide', { rideId: r.ride?.id || r.ride?._id });
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
            <View style={{width:26,height:26,borderRadius:13,backgroundColor:COLORS.darkCard,alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#FF9500'}}><View style={{width:10,height:10,backgroundColor:'#FF9500',transform:[{rotate:'45deg'}]}} /></View>
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
          {!stop ? (
            <TouchableOpacity style={{flexDirection:'row',alignItems:'center',justifyContent:'center',paddingVertical:10,borderRadius:12,borderWidth:1.5,borderColor:'rgba(255,149,0,0.3)',borderStyle:'dashed',marginBottom:6,gap:6}} onPress={function(){setShowStopModal(true);}} activeOpacity={0.7}>
              <Text style={{fontSize:14,color:'#FF9500'}}>+</Text>
              <Text style={{fontSize:13,fontFamily:'LexendDeca_500Medium',color:'#FF9500'}}>Ajouter un arret</Text>
            </TouchableOpacity>
          ) : (
            <View style={{flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,149,0,0.08)',borderRadius:12,padding:10,marginBottom:6,borderWidth:1,borderColor:'rgba(255,149,0,0.2)'}}>
              <View style={{width:8,height:8,backgroundColor:'#FF9500',transform:[{rotate:'45deg'}],marginRight:8}} />
              <Text style={{flex:1,fontSize:12,fontFamily:'LexendDeca_500Medium',color:COLORS.textLight}} numberOfLines={1}>{stop.address}</Text>
              <TouchableOpacity onPress={function(){setStop(null);getDirections(null);}} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                <Text style={{fontSize:14,color:COLORS.textLightMuted}}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={{flexDirection:'row',gap:8,marginBottom:6}}>
            <TouchableOpacity style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionSelected]} onPress={() => setPaymentMethod('cash')} activeOpacity={0.7}>
              <Text style={{fontSize:16}}>{'\uD83D\uDCB5'}</Text>
              <Text style={[styles.paymentOptionText, paymentMethod === 'cash' && {color:COLORS.yellow}]}>Especes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.paymentOption, paymentMethod === 'wave' && {borderColor:'#1DC3E1',backgroundColor:'rgba(29,195,225,0.12)'}]} onPress={() => setPaymentMethod('wave')} activeOpacity={0.7}>
              <Text style={{fontSize:16}}>{'\uD83C\uDF0A'}</Text>
              <Text style={[styles.paymentOptionText, paymentMethod === 'wave' && {color:'#1DC3E1'}]}>Wave</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.paymentOption, scheduledTime && {borderColor:COLORS.yellow,backgroundColor:'rgba(212,175,55,0.08)'}]} onPress={function(){setShowDatePicker(true);}} activeOpacity={0.7}>
              <Text style={{fontSize:16}}>{'\uD83D\uDD52'}</Text>
              <Text style={[styles.paymentOptionText, scheduledTime && {color:COLORS.yellow}]}>{scheduledTime ? formatScheduledTime(scheduledTime) : 'Programmer'}</Text>
              {scheduledTime && <TouchableOpacity onPress={function(){setScheduledTime(null);}} hitSlop={{top:10,bottom:10,left:10,right:10}}><Text style={{fontSize:12,color:COLORS.textLightMuted}}>{'\u2715'}</Text></TouchableOpacity>}
            </TouchableOpacity>
          </View>
          <View style={{ height: 8 }} />
        </ScrollView>
        <View style={styles.confirmSection}><GlassButton title={loading ? 'Confirmation...' : (scheduledTime ? 'Programmer \u2022 ' : 'Confirmer \u2022 ')+(fareEstimates[selectedType]?.fare.toLocaleString())+' FCFA'} onPress={handleBookRide} loading={loading} /></View>
        {showDatePicker && (
          <DateTimePicker value={tempDate} mode="date" display="default" minimumDate={new Date()} onChange={handleDateChange} />
        )}
        {showTimePicker && (
          <DateTimePicker value={tempDate} mode="time" display="default" is24Hour={true} onChange={handleTimeChange} />
        )}
      </View>
      <Modal visible={showStopModal} animationType="fade" transparent>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.7)',justifyContent:'center',paddingHorizontal:20}}>
          <View style={{backgroundColor:COLORS.darkCard,borderRadius:20,padding:20,maxHeight:'60%',borderWidth:1,borderColor:COLORS.darkCardBorder}}>
            <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <Text style={{fontSize:18,fontFamily:'LexendDeca_700Bold',color:COLORS.textLight}}>Ajouter un arret</Text>
              <TouchableOpacity onPress={function(){setShowStopModal(false);}}><Text style={{fontSize:22,color:COLORS.textLightMuted}}>{'\u2715'}</Text></TouchableOpacity>
            </View>
            <NominatimAutocomplete placeholder="Rechercher une adresse..." onSelect={function(place) { var lat = place.geometry && place.geometry.location ? place.geometry.location.lat : (place.lat ? parseFloat(place.lat) : 0); var lng = place.geometry && place.geometry.location ? place.geometry.location.lng : (place.lon ? parseFloat(place.lon) : 0); setStop({ address: place.description || place.address || 'Arret', coordinates: { latitude: lat, longitude: lng } }); setShowStopModal(false); }} />
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
  map: { width, height: height * 0.35 },
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
  rideCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 6, borderWidth: 2, borderColor: 'transparent' },
  rideCardSelected: { borderColor: COLORS.yellow, backgroundColor: 'rgba(212,175,55,0.08)' },
  rideLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  rideImage: { width: 110, height: 75, marginRight: 12 },
  rideInfo: { flex: 1 },
  rideName: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 2 },
  rideCapacity: { fontSize: 11, color: COLORS.textLightMuted, marginBottom: 2, fontFamily: 'LexendDeca_400Regular' },
  rideTime: { fontSize: 11, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular' },
  rideFare: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },
  paymentCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, marginTop: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  paymentLabel: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightMuted, marginBottom: 10 },
  paymentRow: { flexDirection: 'row', alignItems: 'center' },
  paymentIconBg: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  paymentIcon: { fontSize: 18, fontFamily: 'LexendDeca_400Regular' },
  paymentText: { flex: 1, fontSize: 15, fontFamily: 'LexendDeca_500Medium', color: COLORS.textLight },
  paymentArrow: { fontSize: 22, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular' },
  paymentOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: 'transparent', gap: 4 },
  paymentOptionSelected: { borderColor: COLORS.yellow, backgroundColor: 'rgba(212,175,55,0.08)' },
  paymentOptionText: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightMuted },
  paymentHint: { fontSize: 11, fontFamily: 'LexendDeca_400Regular', color: COLORS.textLightMuted, marginTop: 10, textAlign: 'center' },
  confirmSection: { padding: 16, paddingBottom: 28, backgroundColor: COLORS.darkCard },
});

export default RideSelectionScreen;








