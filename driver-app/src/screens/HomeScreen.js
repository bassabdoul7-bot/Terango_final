import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
  AppState,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Map, Camera, Marker } from '@maplibre/maplibre-react-native';
const TERANGO_STYLE = require('../constants/terangoMapStyle.json');
import * as Location from 'expo-location';
import { createAuthSocket } from '../services/socket';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';

var { width } = Dimensions.get('window');
var DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

var HomeScreen = function(props) {
  var navigation = props.navigation;
  var auth = useAuth();
  var driver = auth.driver;
  var user = driver && driver.userId ? driver.userId : {};

  var locationState = useState(null);
  var location = locationState[0];
  var setLocation = locationState[1];

  var loadingState = useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var gettingLocState = useState(true);
  var gettingLocation = gettingLocState[0];
  var setGettingLocation = gettingLocState[1];

  var socketState = useState(null);
  var socket = socketState[0];
  var setSocket = socketState[1];

  var earningsState = useState({ today: 0, todayRides: 0, totalRides: 0, weekTotal: 0, weeklyBreakdown: [0,0,0,0,0,0,0] });
  var earnings = earningsState[0];
  var setEarnings = earningsState[1];

  var pendingGoOnline = useRef(false);
  var appStateRef = useRef(AppState.currentState);
  var locationRef = useRef(null);

  useEffect(function() {
    initializeLocation();
    fetchEarnings();
    createAuthSocket().then(function(newSocket) {
      setSocket(newSocket);
      newSocket.on('connect', function() { console.log('Socket connected:', newSocket.id); });
      newSocket.on('disconnect', function() { console.log('Socket disconnected'); });
    });
    return function() { if (socket) { socket.disconnect(); } };
  }, []);

  useEffect(function() {
    var subscription = AppState.addEventListener('change', function(nextAppState) {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchEarnings();
        if (socket && !socket.connected) { socket.connect(); }
      }
      appStateRef.current = nextAppState;
    });
    return function() { subscription.remove(); };
  }, [socket]);

  useEffect(function() { locationRef.current = location; }, [location]);

  useEffect(function() {
    if (location && pendingGoOnline.current) {
      pendingGoOnline.current = false;
      goOnlineWithLocation();
    }
  }, [location]);

  var fetchEarnings = function() {
    driverService.getEarnings().then(function(r) {
      if (r.success) {
        setEarnings({
          today: r.earnings.today || 0,
          todayRides: r.earnings.todayRides || 0,
          totalRides: r.earnings.totalRides || 0,
          weekTotal: r.earnings.weekTotal || 0,
          weeklyBreakdown: r.earnings.weeklyBreakdown || [0,0,0,0,0,0,0]
        });
      }
    }).catch(function(e) { console.log('Earnings fetch error:', e); });
  };

  var initializeLocation = function() {
    setGettingLocation(true);
    Location.requestForegroundPermissionsAsync().then(function(result) {
      if (result.status !== 'granted') {
        Alert.alert('Permission requise', 'Localisation necessaire pour passer en ligne.', [{ text: 'Reessayer', onPress: initializeLocation }]);
        setGettingLocation(false);
        return;
      }
      return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeout: 15000 });
    }).then(function(currentLocation) {
      if (currentLocation) {
        setLocation({ latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude });
      }
    }).catch(function(error) {
      console.error('Location error:', error);
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(function(loc) {
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }).catch(function() {
        Alert.alert('GPS non disponible', 'Verifiez que le GPS est active.', [{ text: 'Reessayer', onPress: initializeLocation }]);
      });
    }).finally(function() {
      setGettingLocation(false);
    });
  };

  var goOnlineWithLocation = function() {
    if (!driver || !driver._id) { Alert.alert('Erreur', 'Profil chauffeur introuvable'); setLoading(false); return; }
    driverService.toggleOnlineStatus(true, location.latitude, location.longitude).then(function() {
      if (socket) {
        socket.emit('driver-online', { driverId: driver._id, latitude: location.latitude, longitude: location.longitude, vehicle: driver.vehicle, rating: user.rating || 5.0 });
      }
      navigation.replace('RideRequests', { driverId: driver._id, location: location });
    }).catch(function(error) {
      console.error('Toggle online error:', error);
      Alert.alert('Erreur', error.response && error.response.data ? error.response.data.message : 'Impossible de passer en ligne');
    }).finally(function() {
      setLoading(false);
    });
  };

  var handleGoOnline = function() {
    if (!driver || !driver._id) { Alert.alert('Erreur', 'Profil chauffeur introuvable'); return; }
    setLoading(true);
    if (!location) { pendingGoOnline.current = true; initializeLocation(); return; }
    goOnlineWithLocation();
  };

  var tierName = (driver && driver.tier) ? driver.tier.charAt(0).toUpperCase() + driver.tier.slice(1) : 'Goorgoorlu';
  var rating = user.rating ? user.rating.toFixed(1) : '5.0';
  var acceptRate = driver ? (driver.acceptanceRate || 100) : 100;
  var userName = user.name || 'Chauffeur';
  var maxWeek = Math.max.apply(null, earnings.weeklyBreakdown.concat([1]));
  var todayIndex = (new Date().getDay() + 6) % 7;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <View style={styles.logoWrap}>
                <Image source={require('../../assets/images/logo.png')} style={styles.logoImg} resizeMode="contain" />
              </View>
              <View>
                <Text style={styles.greetSub}>Bonjour,</Text>
                <Text style={styles.greetName}>{userName}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.menuBtn} onPress={function() { navigation.navigate('Menu'); }}>
              <Text style={styles.menuIcon}>{'\u2630'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.earningsCard}>
            <View style={styles.earningsTop}>
              <View>
                <Text style={styles.earningsLabel}>GAINS AUJOURD'HUI</Text>
                <Text style={styles.earningsAmount}>{earnings.today.toLocaleString()} <Text style={styles.earningsCurrency}>FCFA</Text></Text>
              </View>
              <View style={styles.tierBadge}>
                <Text style={styles.tierText}>{tierName}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{earnings.todayRides}</Text>
                <Text style={styles.statLabel}>Courses</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{rating}</Text>
                <Text style={styles.statLabel}>Note</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{acceptRate}%</Text>
                <Text style={styles.statLabel}>Accept.</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{earnings.totalRides}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
            </View>
          </View>

          <View style={styles.weekCard}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekLabel}>CETTE SEMAINE</Text>
              <Text style={styles.weekTotal}>{earnings.weekTotal.toLocaleString()} FCFA</Text>
            </View>
            <View style={styles.chartRow}>
              {DAYS.map(function(day, i) {
                var h = maxWeek > 0 ? Math.max((earnings.weeklyBreakdown[i] / maxWeek) * 50, 4) : 4;
                var isToday = i === todayIndex;
                return (
                  <View key={i} style={styles.chartCol}>
                    <View style={[styles.chartBar, { height: h, backgroundColor: isToday ? COLORS.yellow : 'rgba(212,175,55,0.25)' }]} />
                    <Text style={[styles.chartDay, isToday && styles.chartDayActive]}>{day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.mapSection}>
          {location ? (
            <Map style={styles.map} mapStyle={TERANGO_STYLE} logo={false} attribution={false}>
              <Camera center={[location.longitude, location.latitude]} zoom={14} />
              <Marker id="driverLocation" lngLat={[location.longitude, location.latitude]}>
                <View style={styles.driverMarker}>
                  <View style={styles.driverArrow} />
                  <View style={styles.driverDot} />
                </View>
              </Marker>
            </Map>
          ) : (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color={COLORS.green} />
              <Text style={styles.mapLoadText}>Obtention de votre position...</Text>
            </View>
          )}
        </View>

        <View style={styles.goSection}>
          <View style={styles.goCard}>
            <View style={styles.goStatusRow}>
              <View style={styles.goStatusItem}>
                <View style={[styles.statusDot, location ? styles.dotGreen : styles.dotOrange]} />
                <Text style={styles.goStatusText}>{location ? 'GPS actif' : gettingLocation ? 'Recherche...' : 'GPS inactif'}</Text>
              </View>
              <View style={styles.goStatusItem}>
                <View style={[styles.statusDot, styles.dotRed]} />
                <Text style={styles.goStatusText}>Hors ligne</Text>
              </View>
            </View>

            <TouchableOpacity style={[styles.goCircle, (loading || gettingLocation) && styles.goDisabled]} onPress={handleGoOnline} disabled={loading || gettingLocation}>
              {(loading || gettingLocation) ? (
                <ActivityIndicator size="small" color={COLORS.darkBg} />
              ) : (
                <Text style={styles.goText}>GO</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.goHint}>Appuyez pour passer en ligne</Text>

            {!location && !gettingLocation && (
              <TouchableOpacity style={styles.retryBtn} onPress={initializeLocation}>
                <Text style={styles.retryText}>Reessayer GPS</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollView: { flex: 1 },

  header: { backgroundColor: COLORS.darkCard, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderWidth: 1, borderColor: COLORS.darkCardBorder, borderTopWidth: 0 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoWrap: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.yellow, backgroundColor: COLORS.darkCard },
  logoImg: { width: 42, height: 42, borderRadius: 21 },
  greetSub: { fontSize: 12, color: COLORS.textLightSub, fontFamily: 'LexendDeca_400Regular' },
  greetName: { fontSize: 17, color: COLORS.textLight, fontFamily: 'LexendDeca_700Bold' },
  menuBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.darkGlass, borderWidth: 1, borderColor: COLORS.darkGlassBorder, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 22, color: COLORS.textLight, fontFamily: 'LexendDeca_400Regular' },

  earningsCard: { backgroundColor: COLORS.darkGlass, borderWidth: 1, borderColor: COLORS.darkCardBorder, borderRadius: 16, padding: 18, marginBottom: 14 },
  earningsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  earningsLabel: { fontSize: 11, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_600SemiBold', letterSpacing: 1, marginBottom: 4 },
  earningsAmount: { fontSize: 32, color: COLORS.yellow, fontFamily: 'LexendDeca_700Bold' },
  earningsCurrency: { fontSize: 14, color: COLORS.textLightSub, fontFamily: 'LexendDeca_400Regular' },
  tierBadge: { backgroundColor: 'rgba(0,133,63,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  tierText: { fontSize: 12, color: COLORS.green, fontFamily: 'LexendDeca_700Bold' },

  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, backgroundColor: COLORS.darkGlass, borderWidth: 1, borderColor: COLORS.darkGlassBorder, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statValue: { fontSize: 18, color: COLORS.textLight, fontFamily: 'LexendDeca_700Bold' },
  statLabel: { fontSize: 10, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular', marginTop: 2 },

  weekCard: { backgroundColor: COLORS.darkGlass, borderWidth: 1, borderColor: COLORS.darkCardBorder, borderRadius: 16, padding: 16 },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  weekLabel: { fontSize: 11, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_600SemiBold', letterSpacing: 1 },
  weekTotal: { fontSize: 14, color: COLORS.yellow, fontFamily: 'LexendDeca_700Bold' },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 70 },
  chartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  chartBar: { width: '100%', borderRadius: 4, minHeight: 4 },
  chartDay: { fontSize: 10, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular', marginTop: 6 },
  chartDayActive: { color: COLORS.yellow, fontFamily: 'LexendDeca_700Bold' },

  mapSection: { height: 180, marginHorizontal: 20, marginTop: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.darkCardBorder },
  map: { flex: 1 },
  mapPlaceholder: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  mapLoadText: { color: COLORS.textDarkSub, fontSize: 13, marginTop: 10, fontFamily: 'LexendDeca_400Regular' },

  driverMarker: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  driverArrow: { width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderBottomWidth: 26, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: COLORS.yellow },
  driverDot: { position: 'absolute', top: 16, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: COLORS.yellow },

  goSection: { marginHorizontal: 20, marginTop: 16 },
  goCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.darkCardBorder },
  goStatusRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 20 },
  goStatusItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: COLORS.green },
  dotOrange: { backgroundColor: '#FFA500' },
  dotRed: { backgroundColor: COLORS.red },
  goStatusText: { fontSize: 12, color: COLORS.textLightSub, fontFamily: 'LexendDeca_500Medium' },

  goCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10 },
  goDisabled: { opacity: 0.5 },
  goText: { fontSize: 28, color: COLORS.darkBg, fontFamily: 'LexendDeca_700Bold', letterSpacing: 3 },
  goHint: { fontSize: 13, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular', marginTop: 12 },

  retryBtn: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { fontSize: 14, color: COLORS.textLightSub, fontFamily: 'LexendDeca_500Medium' },
});

export default HomeScreen;
