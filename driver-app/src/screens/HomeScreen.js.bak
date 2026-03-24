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
} from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

const TERANGO_STYLE = require('../constants/terangoMapStyle.json');
import * as Location from 'expo-location';
import { createAuthSocket } from '../services/socket';
import COLORS from '../constants/colors';
import FeedbackButton from '../components/FeedbackButton';
import { driverService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';

const HomeScreen = ({ navigation }) => {
  const { driver } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [socket, setSocket] = useState(null);
  const pendingGoOnline = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const locationRef = useRef(null);

  useEffect(() => {
    initializeLocation();

    createAuthSocket().then(function(newSocket) {
      setSocket(newSocket);
      newSocket.on('connect', () => { console.log('Socket connected:', newSocket.id); });
      newSocket.on('disconnect', () => { console.log('Socket disconnected'); });
    });

    return () => { if (socket) { socket.disconnect(); } };
  }, []);

  // Reconnect socket when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', function(nextAppState) {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('App returned to foreground - reconnecting');
        if (socket && !socket.connected) {
          socket.connect();
          // Re-emit driver-online if was online
          if (isOnline && location) {
            setTimeout(function() {
              socket.emit('driver-online', { driverId: driver._id, latitude: location.latitude, longitude: location.longitude, vehicle: driver.vehicle, rating: driver.userId?.rating || 5.0 });
              console.log('Re-emitted driver-online after foreground return');
            }, 1000);
          }
        }
      }
      appStateRef.current = nextAppState;
    });
    return () => { subscription.remove(); };
  }, [socket, isOnline, location]);

  useEffect(() => { locationRef.current = location; }, [location]);

  useEffect(() => {
    if (location && pendingGoOnline.current) {
      pendingGoOnline.current = false;
      goOnlineWithLocation();
    }
  }, [location]);

  const initializeLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Nous avons besoin de votre localisation pour vous mettre en ligne.', [{ text: 'Réessayer', onPress: initializeLocation }]);
        setGettingLocation(false);
        return;
      }
      const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeout: 15000 });
      setLocation({ latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude });
    } catch (error) {
      console.error('Location error:', error);
      try {
        const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setLocation({ latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude });
      } catch (retryError) {
        console.error('Location retry error:', retryError);
        Alert.alert('GPS non disponible', "Impossible d'obtenir votre position. Vérifiez que le GPS est activé.", [{ text: 'Réessayer', onPress: initializeLocation }]);
      }
    } finally {
      setGettingLocation(false);
    }
  };

  const goOnlineWithLocation = async () => {
    if (!driver || !driver._id) { Alert.alert('Erreur', 'Profil chauffeur introuvable'); setLoading(false); return; }
    try {
      await driverService.toggleOnlineStatus(true, location.latitude, location.longitude);
      setIsOnline(true);
      if (socket) {
        socket.emit('driver-online', { driverId: driver._id, latitude: location.latitude, longitude: location.longitude, vehicle: driver.vehicle, rating: driver.userId?.rating || 5.0 });
      }
      navigation.replace("RideRequests", { driverId: driver._id, location: location });
    } catch (error) {
      console.error('Toggle online error:', error);
      Alert.alert('Erreur', error.response?.data?.message || 'Impossible de passer en ligne');
    } finally {
      setLoading(false);
    }
  };

  const handleGoOnline = async () => {
    if (!driver || !driver._id) { Alert.alert('Erreur', 'Profil chauffeur introuvable'); return; }
    setLoading(true);
    if (!location) { pendingGoOnline.current = true; await initializeLocation(); if (!location && !pendingGoOnline.current) { setLoading(false); } return; }
    await goOnlineWithLocation();
  };

  const getButtonText = () => {
    if (loading && !location) return 'Obtention GPS...';
    if (loading) return 'Connexion...';
    if (gettingLocation) return 'Localisation...';
    return 'Passer en ligne';
  };

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
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Menu')}>
          <Text style={styles.menuIcon}>{'\u2630'}</Text>
        </TouchableOpacity>
      </View>

      {!isOnline && (
        <View style={styles.offlineContainer}>
          <View style={styles.offlineCard}>
            <View style={styles.iconContainer}>
              <Image source={require('../../assets/images/logo.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={styles.offlineTitle}>Vous êtes hors ligne</Text>
            <Text style={styles.offlineSubtitle}>{location ? 'Prêt à accepter des courses?' : 'En attente du GPS...'}</Text>
            <View style={styles.locationStatus}>
              <View style={[styles.statusDot, location ? styles.statusDotGreen : styles.statusDotOrange]} />
              <Text style={styles.statusText}>{location ? 'GPS actif' : gettingLocation ? 'Recherche GPS...' : 'GPS non disponible'}</Text>
            </View>
            <TouchableOpacity style={[styles.goCircle, (loading || gettingLocation) && styles.buttonDisabled]} onPress={handleGoOnline} disabled={loading || gettingLocation}>
              {(loading || gettingLocation) ? <ActivityIndicator size="small" color={COLORS.darkBg} /> : null}
              {!(loading || gettingLocation) && <Text style={styles.goCircleText}>GO</Text>}
            </TouchableOpacity>
            {!location && !gettingLocation && (
              <TouchableOpacity style={styles.retryButton} onPress={initializeLocation}>
                <Text style={styles.retryText}>Réessayer GPS</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { ...StyleSheet.absoluteFillObject },
  mapPlaceholder: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textDarkSub, fontSize: 16, marginTop: 16 , fontFamily: 'LexendDeca_400Regular' },
  driverMarkerOuter: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  driverMarkerShadow: { position: 'absolute', bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.25)' },
  driverMarkerArrow: { width: 56, height: 56, alignItems: 'center' },
  driverArrowTop: { width: 0, height: 0, borderLeftWidth: 22, borderRightWidth: 22, borderBottomWidth: 40, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#D4AF37' },
  driverArrowBottom: { width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#B8962E', marginTop: -6 },
  driverMarkerDot: { position: 'absolute', top: 24, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#D4AF37' },
  markerText: { fontSize: 18, color: '#fff', fontFamily: 'LexendDeca_700Bold' },
  topBar: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', justifyContent: 'flex-start' },
  menuButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', elevation: 8, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  menuIcon: { fontSize: 28, color: COLORS.textLight , fontFamily: 'LexendDeca_400Regular' },
  offlineContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 60 },
  offlineCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 32, marginHorizontal: 20, alignItems: 'center', elevation: 12, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  iconContainer: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', marginBottom: 20, overflow: 'hidden', elevation: 8 },
  logoImage: { width: 80, height: 80 },
  offlineTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 8, textAlign: 'center' },
  offlineSubtitle: { fontSize: 15, color: COLORS.textLightSub, marginBottom: 16, textAlign: 'center' , fontFamily: 'LexendDeca_400Regular' },
  locationStatus: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusDotGreen: { backgroundColor: COLORS.green },
  statusDotOrange: { backgroundColor: '#FFA500' },
  statusText: { fontSize: 13, color: COLORS.textLightSub, fontFamily: 'LexendDeca_500Medium' },
  goCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', elevation: 15, borderWidth: 0, borderColor: 'transparent', borderBottomWidth: 0, borderBottomColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 8 },
  buttonDisabled: { opacity: 0.6 },
  goCircleText: { fontSize: 24, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', letterSpacing: 2, textShadowColor: 'rgba(255,255,255,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  retryButton: { marginTop: 12, padding: 12 },
  retryText: { fontSize: 14, color: COLORS.textLightSub, fontFamily: 'LexendDeca_500Medium' },
});

export default HomeScreen;


















