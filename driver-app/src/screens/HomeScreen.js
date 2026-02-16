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
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { createAuthSocket } from '../services/socket';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { useAuth } from '../context/AuthContext';

const HomeScreen = ({ navigation }) => {
  const { driver } = useAuth();
  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [socket, setSocket] = useState(null);
  const pendingGoOnline = useRef(false);

  useEffect(() => {
    initializeLocation();

    createAuthSocket().then(function(newSocket) {
      setSocket(newSocket);
      newSocket.on('connect', () => { console.log('Socket connected:', newSocket.id); });
      newSocket.on('disconnect', () => { console.log('Socket disconnected'); });
    });

    return () => { if (socket) { socket.disconnect(); } };
  }, []);

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
        Alert.alert('GPS non disponible', 'Impossible d\'obtenir votre position. Vérifiez que le GPS est activé.', [{ text: 'Réessayer', onPress: initializeLocation }]);
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
      navigation.replace("RideRequests", { driverId: driver._id });
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
        <MapView style={styles.map} provider={PROVIDER_GOOGLE} customMapStyle={WAZE_DARK_STYLE}
          initialRegion={{ ...location, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          showsUserLocation={false} showsMyLocationButton={false} showsTraffic={true}>
          <Marker coordinate={location}>
            <View style={styles.driverMarker}><Text style={styles.markerText}>▲</Text></View>
          </Marker>
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.loadingText}>Obtention de votre position...</Text>
        </View>
      )}

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Menu')}>
          <Text style={styles.menuIcon}>☰</Text>
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
            <TouchableOpacity style={[styles.goOnlineButton, (loading || gettingLocation) && styles.buttonDisabled]} onPress={handleGoOnline} disabled={loading || gettingLocation}>
              {(loading || gettingLocation) && <ActivityIndicator size="small" color={COLORS.darkBg} style={{ marginRight: 8 }} />}
              <Text style={styles.goOnlineText}>{getButtonText()}</Text>
            </TouchableOpacity>
            {!location && !gettingLocation && (
              <TouchableOpacity style={styles.retryButton} onPress={initializeLocation}>
                <Text style={styles.retryText}>🔄 Réessayer GPS</Text>
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
  loadingText: { color: COLORS.textDarkSub, fontSize: 16, marginTop: 16 },
  driverMarker: { width: 44, height: 44, backgroundColor: COLORS.green, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff', elevation: 8 },
  markerText: { fontSize: 18, color: '#fff', fontWeight: 'bold' },
  topBar: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', justifyContent: 'flex-start' },
  menuButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', elevation: 8, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  menuIcon: { fontSize: 28, color: COLORS.textLight },
  offlineContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 60 },
  offlineCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 32, marginHorizontal: 20, alignItems: 'center', elevation: 12, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  iconContainer: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center', marginBottom: 20, overflow: 'hidden', elevation: 8 },
  logoImage: { width: 80, height: 80 },
  offlineTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 8, textAlign: 'center' },
  offlineSubtitle: { fontSize: 15, color: COLORS.textLightSub, marginBottom: 16, textAlign: 'center' },
  locationStatus: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusDotGreen: { backgroundColor: COLORS.green },
  statusDotOrange: { backgroundColor: '#FFA500' },
  statusText: { fontSize: 13, color: COLORS.textLightSub, fontWeight: '500' },
  goOnlineButton: { backgroundColor: COLORS.yellow, paddingHorizontal: 48, paddingVertical: 18, borderRadius: 16, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', elevation: 8 },
  buttonDisabled: { opacity: 0.6 },
  goOnlineText: { fontSize: 18, fontWeight: 'bold', color: COLORS.darkBg },
  retryButton: { marginTop: 12, padding: 12 },
  retryText: { fontSize: 14, color: COLORS.textLightSub, fontWeight: '500' },
});

export default HomeScreen;
