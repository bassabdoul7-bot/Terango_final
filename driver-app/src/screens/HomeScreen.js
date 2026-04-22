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
  Linking,
} from 'react-native';
import { Map, Camera, Marker } from '@maplibre/maplibre-react-native';
const TERANGO_STYLE = require('../constants/terangoMapStyle.json');
import * as Location from 'expo-location';
import { createAuthSocket } from '../services/socket';
import COLORS from '../constants/colors';
import { COMMISSION_WAVE_NUMBER } from '../constants/commission';
import { driverService } from '../services/api.service';
import { startBackgroundOnline } from '../services/backgroundOnline';
import { useAuth } from '../context/AuthContext';

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

  var blockedState = useState(false);
  var isBlockedForPayment = blockedState[0];
  var setIsBlockedForPayment = blockedState[1];

  var commissionState = useState(0);
  var commissionAmount = commissionState[0];
  var setCommissionAmount = commissionState[1];

  var permDeniedState = useState(false);
  var permissionDenied = permDeniedState[0];
  var setPermissionDenied = permDeniedState[1];

  var pendingGoOnline = useRef(false);
  var appStateRef = useRef(AppState.currentState);
  var locationRef = useRef(null);
  var locationWatcherRef = useRef(null);

  useEffect(function() {
    initializeLocation();
    driverService.getProfile().then(function(res) {
      if (res && res.driver) {
        var d = res.driver;
        if (d.isBlockedForPayment) {
          setIsBlockedForPayment(true);
          setCommissionAmount(d.commissionBalance || 0);
        }
      }
    }).catch(function(err) { console.error('getProfile error:', err); });
    driverService.getActiveRide().then(function(res) {
      if (res && res.success && res.ride) {
        var r = res.ride;
        if (['accepted', 'arrived', 'in_progress'].indexOf(r.status) !== -1) {
          navigation.replace('ActiveRide', { rideId: r._id, ride: r, deliveryMode: !!r.deliveryId });
        }
      }
    }).catch(function(err) { console.error('getActiveRide error:', err); });
    createAuthSocket().then(function(newSocket) {
      setSocket(newSocket);
      newSocket.on('connect', function() { console.log('Socket connected:', newSocket.id); });
      newSocket.on('disconnect', function() { console.log('Socket disconnected'); });
    });
    return function() { if (socket) { socket.disconnect(); } if (locationWatcherRef.current) { locationWatcherRef.current.remove(); locationWatcherRef.current = null; } };
  }, []);

  useEffect(function() {
    var subscription = AppState.addEventListener('change', function(nextAppState) {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
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

  var initializeLocation = function() {
    setGettingLocation(true);
    setPermissionDenied(false);
    Location.requestForegroundPermissionsAsync().then(function(result) {
      if (result.status !== 'granted') {
        setPermissionDenied(true);
        Alert.alert('Permission requise', 'Localisation necessaire pour passer en ligne.', [{ text: 'Reessayer', onPress: initializeLocation }, { text: 'Ouvrir Parametres', onPress: function() { Linking.openSettings(); } }]);
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
      // Start foreground service heartbeat so driver stays online across long backgrounding
      startBackgroundOnline().catch(function() {});
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

  var handlePaidPress = function() {
    Alert.alert('Paiement signal\u00e9', 'Un administrateur v\u00e9rifiera votre paiement sous peu.');
  };

  var userName = user.name || 'Chauffeur';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {location ? (
        <Map style={styles.map} mapStyle={TERANGO_STYLE} logo={false} attribution={false}>
          <Camera center={[location.longitude, location.latitude]} zoom={14} />
          <Marker id="driverLocation" lngLat={[location.longitude, location.latitude]}>
            <View style={styles.driverMarkerOuter}>
              <View style={styles.driverMarkerShadow} />
              <View style={styles.driverMarkerArrow}>
                <View style={styles.driverArrowTop} />
                <View style={styles.driverArrowBottom} />
              </View>
              <View style={styles.driverMarkerDot} />
            </View>
          </Marker>
        </Map>
      ) : (
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.loadingText}>Obtention de votre position...</Text>
        </View>
      )}

      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <View style={styles.logoWrap}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logoImg} resizeMode="contain" />
          </View>
          <View style={styles.greetingCard}>
            <Text style={styles.greetSub}>Bonjour,</Text>
            <Text style={styles.greetName}>{userName}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.menuBtn} onPress={function() { navigation.navigate('Menu'); }}>
          <Text style={styles.menuIcon}>{'\u2630'}</Text>
        </TouchableOpacity>
      </View>

      {isBlockedForPayment && (
        <View style={styles.commissionBanner}>
          <View style={styles.commissionBannerInner}>
            <Text style={styles.commissionBannerTitle}>{'Commission due : ' + commissionAmount.toLocaleString() + ' FCFA'}</Text>
            <Text style={styles.commissionBannerSub}>{'Envoyez par Wave au ' + COMMISSION_WAVE_NUMBER + ' pour continuer'}</Text>
            <TouchableOpacity style={styles.commissionPaidBtn} onPress={handlePaidPress}>
              <Text style={styles.commissionPaidBtnText}>{"J\u0027ai pay\u00e9"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.bottomCard}>
        <View style={styles.quickAccessRow}>
          <TouchableOpacity style={styles.quickAccessBtn} onPress={function() { navigation.navigate('Mechanics'); }}>
            <Text style={styles.quickAccessIcon}>{'\uD83D\uDD27'}</Text>
            <Text style={styles.quickAccessLabel}>Mecaniciens</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.welcomeTitle}>Pret a rouler?</Text>
        <Text style={styles.welcomeSub}>Vos passagers vous attendent</Text>

        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, location ? styles.dotGreen : styles.dotOrange]} />
            <Text style={styles.statusText}>{location ? 'GPS actif' : gettingLocation ? 'Recherche...' : 'GPS inactif'}</Text>
          </View>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, styles.dotRed]} />
            <Text style={styles.statusText}>Hors ligne</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.goCircle, (loading || gettingLocation) && styles.goDisabled]} onPress={handleGoOnline} disabled={loading || gettingLocation}>
          {(loading || gettingLocation) ? (
            <ActivityIndicator size="small" color={COLORS.textLight} />
          ) : (
            <Text style={styles.goText}>GO</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.goHint}>Appuyez pour passer en ligne</Text>

        {!location && !gettingLocation && (
          <View style={styles.retryRow}>
            <TouchableOpacity style={styles.retryBtn} onPress={initializeLocation}>
              <Text style={styles.retryText}>Reessayer GPS</Text>
            </TouchableOpacity>
            {permissionDenied && (
              <TouchableOpacity style={styles.settingsBtn} onPress={function() { Linking.openSettings(); }}>
                <Text style={styles.settingsBtnText}>Ouvrir Parametres</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  mapPlaceholder: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textDarkSub, fontSize: 16, marginTop: 16, fontFamily: 'LexendDeca_400Regular' },

  driverMarkerOuter: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  driverMarkerShadow: { position: 'absolute', bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.25)' },
  driverMarkerArrow: { width: 56, height: 56, alignItems: 'center' },
  driverArrowTop: { width: 0, height: 0, borderLeftWidth: 22, borderRightWidth: 22, borderBottomWidth: 40, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: COLORS.yellow },
  driverArrowBottom: { width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: COLORS.yellowDark, marginTop: -6 },
  driverMarkerDot: { position: 'absolute', top: 24, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.yellow },

  topBar: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrap: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.yellow, backgroundColor: 'rgba(0,36,24,0.85)' },
  logoImg: { width: 42, height: 42, borderRadius: 21 },
  greetingCard: { backgroundColor: 'rgba(212,175,55,0.7)', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 },
  greetSub: { fontSize: 11, color: COLORS.darkBg2, fontFamily: 'LexendDeca_400Regular' },
  greetName: { fontSize: 15, color: COLORS.darkBg, fontFamily: 'LexendDeca_700Bold' },
  menuBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(0,36,24,0.85)', borderWidth: 1, borderColor: COLORS.darkCardBorder, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 22, color: COLORS.textLight, fontFamily: 'LexendDeca_400Regular' },

  quickAccessRow: { flexDirection: 'row', justifyContent: 'flex-end', width: '100%', marginBottom: 12 },
  quickAccessBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  quickAccessIcon: { fontSize: 14 },
  quickAccessLabel: { fontSize: 12, fontFamily: 'LexendDeca_500Medium', color: COLORS.yellow },
  bottomCard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,36,24,0.92)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(0,133,63,0.35)', elevation: 12 },
  welcomeTitle: { fontSize: 20, color: COLORS.textLight, fontFamily: 'LexendDeca_700Bold', marginBottom: 4 },
  welcomeSub: { fontSize: 13, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular', marginBottom: 20 },

  statusRow: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: COLORS.green },
  dotOrange: { backgroundColor: COLORS.orange },
  dotRed: { backgroundColor: COLORS.red },
  statusText: { fontSize: 12, color: COLORS.textLightSub, fontFamily: 'LexendDeca_500Medium' },

  goCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(212,175,55,0.4)', alignItems: 'center', justifyContent: 'center', elevation: 15, borderWidth: 2, borderColor: 'rgba(212,175,55,0.6)', borderBottomWidth: 5, borderBottomColor: 'rgba(212,175,55,0.5)', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 8 },
  goDisabled: { opacity: 0.5 },
  goText: { fontSize: 24, color: COLORS.textLight, fontFamily: 'LexendDeca_700Bold', letterSpacing: 3 },
  goHint: { fontSize: 12, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular', marginTop: 12 },

  retryRow: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'center' },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { fontSize: 14, color: COLORS.textLightSub, fontFamily: 'LexendDeca_500Medium' },
  settingsBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: 'rgba(212,175,55,0.2)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
  settingsBtnText: { fontSize: 14, color: COLORS.yellow, fontFamily: 'LexendDeca_500Medium' },

  commissionBanner: { position: 'absolute', top: 120, left: 16, right: 16, zIndex: 100 },
  commissionBannerInner: { backgroundColor: 'rgba(227, 27, 35, 0.92)', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  commissionBannerTitle: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.white, marginBottom: 6, textAlign: 'center' },
  commissionBannerSub: { fontSize: 13, fontFamily: 'LexendDeca_400Regular', color: 'rgba(255, 255, 255, 0.85)', marginBottom: 14, textAlign: 'center' },
  commissionPaidBtn: { backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' },
  commissionPaidBtnText: { fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.white },
});

export default HomeScreen;



