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
  Animated,
  Dimensions,
  Vibration,
} from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';
const TERANGO_STYLE = require('../constants/terangoMapStyle.json');
import * as Location from 'expo-location';
import * as IntentLauncher from 'expo-intent-launcher';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createAuthSocket } from '../services/socket';
import COLORS from '../constants/colors';
import CAR_IMAGES from '../constants/carImages';
import { COMMISSION_WAVE_NUMBER } from '../constants/commission';
import { driverService, deliveryService } from '../services/api.service';
import { startBackgroundOnline, stopBackgroundOnline } from '../services/backgroundOnline';
import { useAuth } from '../context/AuthContext';
import ConfirmModal from '../components/ConfirmModal';

const { width, height } = Dimensions.get('window');

const SteeringWheel = ({ size = 24, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
    <Circle cx="12" cy="12" r="2.6" fill={color} />
    <Line x1="12" y1="4.5" x2="12" y2="9.4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="4.5" y1="13" x2="9.4" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Line x1="14.6" y1="13" x2="19.5" y2="13" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const HomeScreen = ({ navigation }) => {
  const { driver } = useAuth();
  const user = driver && driver.userId ? driver.userId : {};
  const driverId = driver && driver._id;

  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(false);

  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  const [currentRequest, setCurrentRequest] = useState(null);
  const [rideRequests, setRideRequests] = useState([]);
  const currentRequestRef = useRef(null);
  const offerTimeoutRef = useRef(null);

  const [activeServices, setActiveServices] = useState({ rides: true, colis: true, commande: true, resto: true });
  const activeServicesRef = useRef({ rides: true, colis: true, commande: true, resto: true });
  const [showFilters, setShowFilters] = useState(false);

  const [earnings, setEarnings] = useState({ today: 0, ridesCompleted: 0 });
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [blockedForPayment, setBlockedForPayment] = useState(null);
  const [isBlockedForPayment, setIsBlockedForPayment] = useState(false);
  const [commissionAmount, setCommissionAmount] = useState(0);

  const isOnlineRef = useRef(false);
  const pendingGoOnline = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const locationWatcherRef = useRef(null);
  const locationIntervalRef = useRef(null);

  const slideAnim = useRef(new Animated.Value(height)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef(null);
  const cameraRef = useRef(null);
  const soundRef = useRef(null);
  const vibrationInterval = useRef(null);

  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  useEffect(() => { activeServicesRef.current = activeServices; }, [activeServices]);
  useEffect(() => { currentRequestRef.current = currentRequest; }, [currentRequest]);

  useEffect(() => {
    initializeLocation();

    driverService.getProfile().then((res) => {
      if (res && res.driver) {
        const d = res.driver;
        if (d.isBlockedForPayment) {
          setIsBlockedForPayment(true);
          setCommissionAmount(d.commissionBalance || 0);
        }
        if (d.acceptedServices) {
          const moto = d.vehicleType === 'moto';
          const svc = {
            rides: moto ? false : (d.acceptedServices.rides !== false),
            colis: d.acceptedServices.colis !== false,
            commande: d.acceptedServices.commande !== false,
            resto: d.acceptedServices.resto !== false,
          };
          setActiveServices(svc);
          activeServicesRef.current = svc;
        }
        if (d.isOnline) {
          setIsOnline(true);
          isOnlineRef.current = true;
          fetchEarnings();
          startLocationPolling();
          startBackgroundOnline().catch(() => {});
        }
      }
    }).catch((err) => console.error('getProfile error:', err));

    driverService.getActiveRide().then((res) => {
      if (res && res.success && res.ride) {
        const r = res.ride;
        if (['accepted', 'arrived', 'in_progress'].indexOf(r.status) !== -1) {
          navigation.replace('ActiveRide', { rideId: r._id, ride: r, deliveryMode: !!r.deliveryId });
        }
      }
    }).catch((err) => console.error('getActiveRide error:', err));

    createAuthSocket().then((newSocket) => {
      socketRef.current = newSocket;
      setSocket(newSocket);
      attachSocketListeners(newSocket);
    });

    return () => {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      if (locationWatcherRef.current) { locationWatcherRef.current.remove(); locationWatcherRef.current = null; }
      if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null; }
      if (offerTimeoutRef.current) { clearTimeout(offerTimeoutRef.current); offerTimeoutRef.current = null; }
      stopRideAlert();
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (socketRef.current && !socketRef.current.connected) socketRef.current.connect();
        if (isOnlineRef.current && socketRef.current && driverId) {
          socketRef.current.emit('driver-online', { driverId, latitude: location && location.latitude, longitude: location && location.longitude });
          if (location) driverService.toggleOnlineStatus(true, location.latitude, location.longitude).catch(() => {});
          driverService.getCurrentOffer().then((r) => {
            if (r && r.success && r.offer && !currentRequestRef.current && activeServicesRef.current.rides) {
              const rd = r.offer; rd._offerType = 'ride';
              if (offerTimeoutRef.current) clearTimeout(offerTimeoutRef.current);
              setCurrentRequest(rd);
              setRideRequests((p) => [...p, rd]);
              const t = setTimeout(() => handleReject(), rd.offerExpiresIn || 15000);
              offerTimeoutRef.current = t;
            }
          }).catch(() => {});
        }
      }
      appStateRef.current = nextAppState;
    });
    return () => sub.remove();
  }, [location, driverId]);

  useEffect(() => {
    if (location && pendingGoOnline.current) {
      pendingGoOnline.current = false;
      goOnlineWithLocation();
    }
  }, [location]);

  // Re-register the driver in their socket room exactly once per online
  // session (not on every GPS poll). Fires when isOnline transitions to
  // true with socket + location + driverId all ready, so a freshly-mounted
  // Home (e.g. after returning from ActiveRide) re-joins driver-<id>.
  const registeredOnlineRef = useRef(false);
  useEffect(() => {
    if (!isOnline) { registeredOnlineRef.current = false; return; }
    if (registeredOnlineRef.current) return;
    if (!(location && socket && socket.connected && driverId)) return;
    registeredOnlineRef.current = true;
    socket.emit('driver-online', { driverId, latitude: location.latitude, longitude: location.longitude, vehicle: driver && driver.vehicle, rating: user.rating || 5.0 });
  }, [isOnline, location, socket, driverId]);

  useEffect(() => {
    if (currentRequest) { showRequestCard(); playRideAlert(); } else { hideRequestCard(); stopRideAlert(); }
    return () => { stopRideAlert(); };
  }, [currentRequest]);

  useEffect(() => {
    if (isOnline && !currentRequest) {
      Animated.loop(Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])).start();
    } else {
      scanAnim.setValue(0);
    }
  }, [isOnline, currentRequest]);

  const attachSocketListeners = (s) => {
    s.on('connect', () => {
      if (isOnlineRef.current && driverId) {
        s.emit('driver-online', { driverId, latitude: location && location.latitude, longitude: location && location.longitude });
      }
    });
    s.on('new-ride-offer', (rideData) => {
      if (!isOnlineRef.current) return;
      rideData._offerType = 'ride';
      if (!activeServicesRef.current.rides) return;
      if (currentRequestRef.current) { setRideRequests((prev) => [...prev, rideData]); return; }
      if (offerTimeoutRef.current) clearTimeout(offerTimeoutRef.current);
      setCurrentRequest(rideData);
      setRideRequests((prev) => [...prev, rideData]);
      const t = setTimeout(() => handleReject(), rideData.offerExpiresIn || 15000);
      offerTimeoutRef.current = t;
    });
    s.on('ride-taken', () => {
      if (!isOnlineRef.current) return;
      Alert.alert('Course prise', 'Un autre chauffeur a accepté cette course');
      stopRideAlert();
      if (offerTimeoutRef.current) { clearTimeout(offerTimeoutRef.current); offerTimeoutRef.current = null; }
      const req = currentRequestRef.current;
      if (req) {
        setRideRequests((prev) => {
          const remaining = prev.filter((r) => r.rideId !== req.rideId);
          setCurrentRequest(remaining.length > 0 ? remaining[0] : null);
          return remaining;
        });
      }
    });
    s.on('ride-cancelled', () => {
      stopRideAlert();
      if (offerTimeoutRef.current) { clearTimeout(offerTimeoutRef.current); offerTimeoutRef.current = null; }
      setCurrentRequest(null);
      setRideRequests([]);
    });
    s.on('new-delivery', (d) => {
      if (!isOnlineRef.current) return;
      const sType = d.serviceType || 'colis';
      if (sType === 'colis' && !activeServicesRef.current.colis) return;
      if (sType === 'commande' && !activeServicesRef.current.commande) return;
      if ((sType === 'resto' || sType === 'restaurant') && !activeServicesRef.current.resto) return;
      const offerData = {
        rideId: d.deliveryId, _offerType: d.serviceType || 'colis', _isDelivery: true,
        pickup: d.pickup, dropoff: d.dropoff, fare: d.fare,
        packageDetails: d.packageDetails, restaurantName: d.restaurantName,
        serviceType: d.serviceType, offerExpiresIn: 60000,
      };
      setRideRequests((prev) => [...prev, offerData]);
      if (!currentRequestRef.current) {
        setCurrentRequest(offerData);
        const t = setTimeout(() => handleReject(), 60000);
        offerTimeoutRef.current = t;
      }
    });
    s.on('delivery-taken', () => {
      if (currentRequestRef.current && currentRequestRef.current._isDelivery) setCurrentRequest(null);
    });
    s.on('blocked-for-payment', (data) => { setBlockedForPayment(data); });
    s.on('ride-completed-earnings', () => { fetchEarnings(); });
    s.on('disconnect', (reason) => { console.log('Socket disconnected:', reason); });
  };

  const initializeLocation = () => {
    setGettingLocation(true);
    setPermissionDenied(false);
    Location.requestForegroundPermissionsAsync().then((result) => {
      if (result.status !== 'granted') {
        setPermissionDenied(true);
        Alert.alert('Permission requise', 'Localisation necessaire pour passer en ligne.', [
          { text: 'Reessayer', onPress: initializeLocation },
          { text: 'Ouvrir Parametres', onPress: () => Linking.openSettings() },
        ]);
        setGettingLocation(false);
        return;
      }
      return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeout: 15000 });
    }).then((cur) => {
      if (cur) setLocation({ latitude: cur.coords.latitude, longitude: cur.coords.longitude });
    }).catch(() => {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((loc) => {
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }).catch(() => {
        Alert.alert('GPS non disponible', 'Verifiez que le GPS est active.', [{ text: 'Reessayer', onPress: initializeLocation }]);
      });
    }).finally(() => setGettingLocation(false));
  };

  const startLocationPolling = () => {
    if (locationIntervalRef.current) return;
    locationIntervalRef.current = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        await driverService.updateLocation(loc.coords.latitude, loc.coords.longitude).catch(() => {});
        if (socketRef.current && socketRef.current.connected && driverId) {
          socketRef.current.emit('driver-location-update', { driverId, latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch (e) {}
    }, 5000);
  };

  const stopLocationPolling = () => {
    if (locationIntervalRef.current) { clearInterval(locationIntervalRef.current); locationIntervalRef.current = null; }
  };

  const fetchEarnings = async () => {
    try {
      const r = await driverService.getEarnings();
      setEarnings({ today: r.earnings.today || 0, ridesCompleted: r.earnings.totalRides || 0 });
    } catch (e) {}
  };

  const maybePromptBatteryWhitelist = async () => {
    if (Platform.OS !== 'android') return;
    try {
      const seen = await AsyncStorage.getItem('batteryWhitelistShown');
      if (seen === '1') return;
      Alert.alert(
        'Rester en ligne en arrière-plan',
        "Pour ne pas manquer de courses, autorisez TeranGO a fonctionner sans restriction de batterie.",
        [
          { text: 'Plus tard', style: 'cancel', onPress: () => AsyncStorage.setItem('batteryWhitelistShown', '1') },
          { text: 'Ouvrir les parametres', onPress: () => {
            IntentLauncher.startActivityAsync('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() => {
              IntentLauncher.startActivityAsync('android.settings.APPLICATION_DETAILS_SETTINGS', { data: 'package:com.terango.driver' }).catch(() => {});
            });
            AsyncStorage.setItem('batteryWhitelistShown', '1');
          }},
        ]
      );
    } catch (e) {}
  };

  const playGoOnlineCue = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/go-online.mp3'),
        { shouldPlay: true, volume: 0.9 }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) { sound.unloadAsync().catch(() => {}); }
      });
    } catch (e) {}
  };

  const goOnlineWithLocation = () => {
    if (!driverId) { Alert.alert('Erreur', 'Profil chauffeur introuvable'); setLoading(false); return; }
    driverService.toggleOnlineStatus(true, location.latitude, location.longitude).then(() => {
      if (socketRef.current) {
        socketRef.current.emit('driver-online', { driverId, latitude: location.latitude, longitude: location.longitude, vehicle: driver.vehicle, rating: user.rating || 5.0 });
      }
      startBackgroundOnline().catch(() => {});
      maybePromptBatteryWhitelist();
      setIsOnline(true);
      isOnlineRef.current = true;
      fetchEarnings();
      startLocationPolling();
      playGoOnlineCue();
    }).catch((error) => {
      Alert.alert('Erreur', error.response && error.response.data ? error.response.data.message : 'Impossible de passer en ligne');
    }).finally(() => setLoading(false));
  };

  const handleGoOnline = () => {
    if (!driverId) { Alert.alert('Erreur', 'Profil chauffeur introuvable'); return; }
    setLoading(true);
    if (!location) { pendingGoOnline.current = true; initializeLocation(); return; }
    goOnlineWithLocation();
  };

  const handleGoOffline = async () => {
    setShowOfflineModal(false);
    try {
      await driverService.toggleOnlineStatus(false);
      if (socketRef.current && driverId) socketRef.current.emit('driver-offline', driverId);
      stopBackgroundOnline().catch(() => {});
      stopLocationPolling();
      setIsOnline(false);
      isOnlineRef.current = false;
      setCurrentRequest(null);
      setRideRequests([]);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de passer hors ligne');
    }
  };

  const toggleService = async (key) => {
    if (driver && driver.vehicleType === 'moto' && key === 'rides') {
      Alert.alert('Indisponible', 'Les motos ne peuvent pas accepter de courses passager');
      return;
    }
    const updated = { ...activeServices, [key]: !activeServices[key] };
    if (!Object.values(updated).some((v) => v)) { Alert.alert('Attention', 'Gardez au moins un service actif.'); return; }
    setActiveServices(updated);
    try { await driverService.updateServicePreferences(updated); } catch (e) { setActiveServices(activeServices); }
  };

  const playRideAlert = async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: false });
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      vibrationInterval.current = setInterval(() => {
        Vibration.vibrate([0, 400, 200, 400]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 1500);
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])).start();
    } catch (e) {}
  };

  const stopRideAlert = async () => {
    try {
      if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; }
      if (vibrationInterval.current) { clearInterval(vibrationInterval.current); vibrationInterval.current = null; }
      Vibration.cancel();
      pulseAnim.setValue(1);
    } catch (e) {}
  };

  const showRequestCard = () => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8 }).start();
    if (cameraRef.current && currentRequest) {
      const pLat = currentRequest.pickup.coordinates.latitude;
      const pLon = currentRequest.pickup.coordinates.longitude;
      const dLat = currentRequest.dropoff.coordinates.latitude;
      const dLon = currentRequest.dropoff.coordinates.longitude;
      cameraRef.current.fitBounds(
        [Math.min(pLon, dLon), Math.min(pLat, dLat), Math.max(pLon, dLon), Math.max(pLat, dLat)],
        { top: 100, right: 50, bottom: 400, left: 50 }, 500
      );
    }
  };
  const hideRequestCard = () => { Animated.timing(slideAnim, { toValue: height, duration: 300, useNativeDriver: true }).start(); };

  const handleAccept = async () => {
    if (!currentRequest) return;
    stopRideAlert();
    if (offerTimeoutRef.current) { clearTimeout(offerTimeoutRef.current); offerTimeoutRef.current = null; }
    setLoading(true);
    try {
      if (currentRequest._isDelivery) {
        await deliveryService.acceptDelivery(currentRequest.rideId);
        setRideRequests((prev) => prev.filter((r) => r.rideId !== currentRequest.rideId));
        navigation.replace('ActiveRide', { rideId: currentRequest.rideId, ride: currentRequest, deliveryMode: true, deliveryData: currentRequest });
      } else {
        await driverService.acceptRide(currentRequest.rideId);
        setRideRequests((prev) => prev.filter((r) => r.rideId !== currentRequest.rideId));
        navigation.replace('ActiveRide', { rideId: currentRequest.rideId, ride: currentRequest });
      }
      setCurrentRequest(null);
    } catch (e) {
      Alert.alert('Erreur', e.response && e.response.data ? e.response.data.message : "Impossible d'accepter");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    const req = currentRequestRef.current;
    if (!req) return;
    stopRideAlert();
    if (offerTimeoutRef.current) { clearTimeout(offerTimeoutRef.current); offerTimeoutRef.current = null; }
    try {
      if (!req._isDelivery) await driverService.rejectRide(req.rideId, 'Trop loin').catch(() => {});
    } catch (e) {}
    setRideRequests((prev) => {
      const remaining = prev.filter((r) => r.rideId !== req.rideId);
      const next = remaining.length > 0 ? remaining[0] : null;
      setCurrentRequest(next);
      if (next) {
        const t = setTimeout(() => handleReject(), next.offerExpiresIn || 15000);
        offerTimeoutRef.current = t;
      }
      return remaining;
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {location ? (
        <Map ref={mapRef} style={styles.map} mapStyle={TERANGO_STYLE} logo={false} attribution={false}>
          <Camera ref={cameraRef} center={[location.longitude, location.latitude]} zoom={14} />
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
          {currentRequest && (
            <>
              <Marker id="reqPickup" lngLat={[currentRequest.pickup.coordinates.longitude, currentRequest.pickup.coordinates.latitude]}>
                <View style={styles.pickupMarker}><View style={styles.pickupDot} /></View>
              </Marker>
              <Marker id="reqDropoff" lngLat={[currentRequest.dropoff.coordinates.longitude, currentRequest.dropoff.coordinates.latitude]}>
                <View style={styles.dropoffMarker}><View style={styles.dropoffDot} /></View>
              </Marker>
              <GeoJSONSource id="circleSource" data={{ type: 'Feature', geometry: { type: 'Point', coordinates: [currentRequest.pickup.coordinates.longitude, currentRequest.pickup.coordinates.latitude] } }}>
                <Layer type="circle" id="circleLayer" paint={{ 'circle-radius': 50, 'circle-color': 'rgba(0,133,63,0.1)', 'circle-stroke-color': 'rgba(0,133,63,0.3)', 'circle-stroke-width': 1 }} />
              </GeoJSONSource>
            </>
          )}
        </Map>
      ) : (
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.loadingText}>Obtention de votre position...</Text>
        </View>
      )}

      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topMenuBtn} onPress={() => navigation.navigate('Menu')}>
          <Text style={styles.topMenuIcon}>{'☰'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.earningsBadge} onPress={() => navigation.navigate('Gains')} activeOpacity={0.7}>
          {/* Stroke layer — 4 offset copies fake a 1px outline since RN Text has no real stroke */}
          <Text style={[styles.earningsBadgeText, styles.earningsBadgeStroke, { top: -1 }]} numberOfLines={1}>{earnings.today.toLocaleString() + ' FCFA'}</Text>
          <Text style={[styles.earningsBadgeText, styles.earningsBadgeStroke, { top: 1 }]} numberOfLines={1}>{earnings.today.toLocaleString() + ' FCFA'}</Text>
          <Text style={[styles.earningsBadgeText, styles.earningsBadgeStroke, { left: -1 }]} numberOfLines={1}>{earnings.today.toLocaleString() + ' FCFA'}</Text>
          <Text style={[styles.earningsBadgeText, styles.earningsBadgeStroke, { left: 1 }]} numberOfLines={1}>{earnings.today.toLocaleString() + ' FCFA'}</Text>
          <Text style={styles.earningsBadgeText} numberOfLines={1}>{earnings.today.toLocaleString() + ' FCFA'}</Text>
        </TouchableOpacity>
        <View style={styles.topRightSpacer} />
      </View>

      {showFilters && (
        <View style={styles.filterBar}>
          {(driver && driver.vehicleType === 'moto'
            ? [{ key: 'colis', label: 'Colis', icon: '📦' }, { key: 'commande', label: 'Commandes', icon: '🛒' }, { key: 'resto', label: 'Resto', icon: '🍽️' }]
            : [{ key: 'rides', label: 'Courses', icon: '🚗' }, { key: 'colis', label: 'Colis', icon: '📦' }, { key: 'commande', label: 'Commandes', icon: '🛒' }, { key: 'resto', label: 'Resto', icon: '🍽️' }]
          ).map((svc) => (
            <TouchableOpacity key={svc.key} style={[styles.filterChip, activeServices[svc.key] && styles.filterChipActive]} onPress={() => toggleService(svc.key)}>
              <Text style={styles.filterChipIcon}>{svc.icon}</Text>
              <Text style={[styles.filterChipLabel, activeServices[svc.key] && styles.filterChipLabelActive]}>{svc.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isBlockedForPayment && (
        <View style={styles.commissionBanner}>
          <View style={styles.commissionBannerInner}>
            <Text style={styles.commissionBannerTitle}>{'Commission due : ' + commissionAmount.toLocaleString() + ' FCFA'}</Text>
            <Text style={styles.commissionBannerSub}>{'Envoyez par Wave au ' + COMMISSION_WAVE_NUMBER + ' pour continuer'}</Text>
          </View>
        </View>
      )}

      <View style={styles.bottomCard}>
        <View style={styles.offlineHandle} />

        {!isOnline && (
          <>
            <Text style={styles.offlineTitle}>Vous etes hors ligne</Text>
            <Text style={styles.offlineSub}>Vous ne recevrez aucune demande</Text>
          </>
        )}

        {isOnline && !currentRequest && (
          <View style={styles.scanningRow}>
            <Animated.View style={[styles.scanningLine, { transform: [{ translateX: scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-width / 2, width / 2] }) }] }]} />
            <Text style={styles.scanningText}>En attente de courses...</Text>
          </View>
        )}

        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, location ? styles.dotGreen : styles.dotOrange]} />
            <Text style={styles.statusText}>{location ? 'GPS actif' : gettingLocation ? 'Recherche...' : 'GPS inactif'}</Text>
          </View>
        </View>

        <View style={styles.pillRow}>
          <TouchableOpacity
            style={[isOnline ? styles.goOfflinePill : styles.goOnlinePill, (loading || gettingLocation) && styles.pillDisabled]}
            onPress={isOnline ? () => setShowOfflineModal(true) : handleGoOnline}
            disabled={loading || gettingLocation}
            activeOpacity={0.85}
          >
            <View style={styles.pillLogoWrap}>
              <SteeringWheel size={22} color={COLORS.white} />
            </View>
            {(loading || gettingLocation) ? (
              <ActivityIndicator size="small" color={isOnline ? '#FFFFFF' : COLORS.darkBg} style={{ marginLeft: 8 }} />
            ) : (
              <Text style={isOnline ? styles.goOfflinePillText : styles.goOnlinePillText}>{isOnline ? 'Hors ligne' : 'Passer en ligne'}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowFilters(!showFilters)} activeOpacity={0.85}>
            <LinearGradient colors={['#000000', '#003322', '#00853F']} locations={[0, 0.55, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={[styles.pillSettingsBtn, showFilters && styles.pillSettingsBtnActive]}>
              <Text style={styles.pillSettingsIcon}>{showFilters ? '✕' : '⚙'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {!isOnline && !location && !gettingLocation && (
          <View style={styles.retryRow}>
            <TouchableOpacity style={styles.retryBtn} onPress={initializeLocation}>
              <Text style={styles.retryText}>Reessayer GPS</Text>
            </TouchableOpacity>
            {permissionDenied && (
              <TouchableOpacity style={styles.settingsBtn} onPress={() => Linking.openSettings()}>
                <Text style={styles.settingsBtnText}>Ouvrir Parametres</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <Animated.View style={[styles.requestCard, { transform: [{ translateY: slideAnim }, { scale: pulseAnim }] }]} pointerEvents={currentRequest ? 'auto' : 'none'}>
        {currentRequest && (
          <View style={styles.requestContent}>
            {currentRequest.riderPhone && (
              <TouchableOpacity onPress={() => Linking.openURL('tel:' + currentRequest.riderPhone)} activeOpacity={0.7}>
                <Text style={styles.offerTypeBadge}>{currentRequest._isDelivery ? (currentRequest.serviceType === 'colis' ? '📦 Nouveau colis' : currentRequest.serviceType === 'commande' ? '🛒 Nouvelle commande' : '🍽️ Commande resto') : 'Nouvelle course 📍'}</Text>
                <Text style={styles.riderPhoneText}>{currentRequest.riderPhone}</Text>
                {currentRequest.riderName ? <Text style={styles.riderNameText}>{currentRequest.riderName}  •  Toucher pour appeler</Text> : <Text style={styles.riderNameText}>Toucher pour appeler</Text>}
              </TouchableOpacity>
            )}
            <View style={styles.requestHeader}>
              <View style={{ flex: 1 }}>
                {!currentRequest.riderPhone && (
                  <Text style={styles.requestTitle}>{currentRequest._isDelivery ? (currentRequest.serviceType === 'colis' ? '📦 Nouveau colis' : currentRequest.serviceType === 'commande' ? '🛒 Nouvelle commande' : '🍽️ Commande resto') : 'Nouvelle course 📍'}</Text>
                )}
                <Text style={styles.requestSubtitle}>{(currentRequest.distance || 0).toFixed(1) + ' km • ' + Math.round((currentRequest.distance || 0) * 2) + ' min' + (currentRequest.distanceToPickup ? ' • ' + currentRequest.distanceToPickup.toFixed(1) + 'km de vous' : '')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.fareText}>{(currentRequest.driverEarnings || currentRequest.fare || 0).toLocaleString() + ' FCFA'}</Text>
                <Text style={styles.fareBreakdown}>{'Commission: ' + (currentRequest.platformCommission || 0).toLocaleString() + ' F'}</Text>
                <Text style={[styles.fareBreakdown, currentRequest.paymentMethod === 'wave' && { color: '#1DC3E1' }]}>{currentRequest.paymentMethod === 'wave' ? '🌊 Wave' : '💵 Especes'}</Text>
              </View>
            </View>
            {currentRequest._isDelivery ? (
              <View style={styles.rideTypeRow}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,149,0,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 22 }}>{currentRequest.serviceType === 'colis' ? '📦' : currentRequest.serviceType === 'commande' ? '🛒' : '🍽️'}</Text>
                </View>
                <View style={styles.rideTypeInfo}>
                  <Text style={styles.rideTypeName}>{currentRequest.serviceType === 'colis' ? 'Livraison Colis' : currentRequest.serviceType === 'commande' ? 'Commande' : 'Restaurant'}</Text>
                  <Text style={styles.rideTypeDesc}>{currentRequest.restaurantName || (currentRequest.packageDetails ? 'Taille: ' + currentRequest.packageDetails.size : 'Livraison rapide')}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.rideTypeRow}>
                <Image source={{ uri: (CAR_IMAGES[currentRequest.rideType] || CAR_IMAGES.standard).uri }} style={styles.rideTypeImage} resizeMode="contain" />
                <View style={styles.rideTypeInfo}>
                  <Text style={styles.rideTypeName}>{(CAR_IMAGES[currentRequest.rideType] || CAR_IMAGES.standard).name}</Text>
                  <Text style={styles.rideTypeDesc}>{(CAR_IMAGES[currentRequest.rideType] || CAR_IMAGES.standard).description}</Text>
                </View>
              </View>
            )}
            <View style={styles.addressesContainer}>
              <View style={styles.addressRow}><View style={styles.greenDot} /><Text style={styles.addressText} numberOfLines={1}>{currentRequest.pickup.address}</Text></View>
              <View style={styles.dashedLine} />
              <View style={styles.addressRow}><View style={styles.redSquare} /><Text style={styles.addressText} numberOfLines={1}>{currentRequest.dropoff.address}</Text></View>
            </View>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.rejectButton} onPress={handleReject} disabled={loading}><Text style={styles.rejectButtonText}>Rejeter</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.acceptButton, loading && styles.acceptButtonDisabled]} onPress={handleAccept} disabled={loading}><Text style={styles.acceptButtonText}>{loading ? 'Acceptation...' : 'Accepter'}</Text></TouchableOpacity>
            </View>
            {rideRequests.length > 1 && <Text style={styles.queueText}>{'+' + (rideRequests.length - 1) + ' autre' + (rideRequests.length > 2 ? 's' : '') + ' en attente'}</Text>}
          </View>
        )}
      </Animated.View>

      {blockedForPayment && (
        <View style={styles.blockedOverlay}>
          <View style={styles.blockedCard}>
            <Text style={styles.blockedIcon}>{'⚠️'}</Text>
            <Text style={styles.blockedTitle}>Commission impayee</Text>
            <Text style={styles.blockedAmount}>{blockedForPayment.balance.toLocaleString() + ' FCFA'}</Text>
            <Text style={styles.blockedSub}>{'Veuillez payer votre solde pour continuer.'}</Text>
            <TouchableOpacity style={styles.blockedSupportBtn} onPress={() => Linking.openURL('https://wa.me/17047263959')}>
              <Text style={styles.blockedSupportText}>Contacter Support</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.blockedCloseBtn} onPress={() => setBlockedForPayment(null)}>
              <Text style={styles.blockedCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ConfirmModal visible={showOfflineModal} title="Passer hors ligne?" message="Vous arreterez de recevoir des courses" cancelText="Rester en ligne" confirmText="Hors ligne" onCancel={() => setShowOfflineModal(false)} onConfirm={handleGoOffline} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { ...StyleSheet.absoluteFillObject },
  mapPlaceholder: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textDarkSub, fontSize: 16, marginTop: 16, fontFamily: 'LexendDeca_400Regular' },

  driverMarkerOuter: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  driverMarkerShadow: { position: 'absolute', bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.25)' },
  driverMarkerArrow: { width: 56, height: 56, alignItems: 'center' },
  driverArrowTop: { width: 0, height: 0, borderLeftWidth: 22, borderRightWidth: 22, borderBottomWidth: 40, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: COLORS.yellow },
  driverArrowBottom: { width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: COLORS.yellowDark, marginTop: -6 },
  driverMarkerDot: { position: 'absolute', top: 24, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.white, borderWidth: 3, borderColor: COLORS.yellow },

  pickupMarker: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,133,63,0.25)', alignItems: 'center', justifyContent: 'center' },
  pickupDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green },
  dropoffMarker: { width: 24, height: 24, borderRadius: 4, backgroundColor: 'rgba(227,27,35,0.25)', alignItems: 'center', justifyContent: 'center' },
  dropoffDot: { width: 12, height: 12, backgroundColor: COLORS.red },

  topBar: { position: 'absolute', top: 60, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topMenuBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  topMenuIcon: { fontSize: 20, color: '#1A1A1A', fontFamily: 'LexendDeca_700Bold' },
  earningsBadge: { paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  earningsBadgeText: {
    fontFamily: 'Anton_400Regular',
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: 1.2,
    fontStyle: 'italic',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 4,
  },
  earningsBadgeStroke: { position: 'absolute', color: '#000000', textShadowRadius: 0 },
  topRightSpacer: { width: 44, height: 44 },

  filterBar: { position: 'absolute', bottom: 290, left: 12, right: 12, flexDirection: 'row', gap: 8, zIndex: 10, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#EEF0F3', elevation: 8 },
  filterChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: '#F2F4F7', gap: 4 },
  filterChipActive: { backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: COLORS.yellow },
  filterChipIcon: { fontSize: 14 },
  filterChipLabel: { fontSize: 11, fontFamily: 'LexendDeca_600SemiBold', color: '#757575' },
  filterChipLabelActive: { color: COLORS.yellow, fontFamily: 'LexendDeca_700Bold' },

  bottomCard: { position: 'absolute', bottom: 80, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 18, borderTopWidth: 1, borderTopColor: '#EEF0F3', elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  offlineHandle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: '#D7DBE0', marginBottom: 16 },
  offlineTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 4 },
  offlineSub: { fontSize: 13, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular', marginBottom: 16 },
  scanningRow: { height: 36, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 14, borderRadius: 12, backgroundColor: '#F2F4F7' },
  scanningLine: { position: 'absolute', width: 80, height: 3, backgroundColor: COLORS.yellow, borderRadius: 2 },
  scanningText: { fontSize: 13, fontFamily: 'LexendDeca_500Medium', color: '#5a5a5a' },

  statusRow: { flexDirection: 'row', gap: 24, marginBottom: 18 },
  statusItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: COLORS.green },
  dotOrange: { backgroundColor: COLORS.orange },
  dotRed: { backgroundColor: COLORS.red },
  statusText: { fontSize: 12, color: '#5a5a5a', fontFamily: 'LexendDeca_500Medium' },

  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  goOnlinePill: { flex: 1, height: 61, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.yellow, borderRadius: 31, paddingHorizontal: 18, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  goOfflinePill: { flex: 1, height: 61, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.red, borderRadius: 31, paddingHorizontal: 18, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  pillDisabled: { opacity: 0.6 },
  pillLogoWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.darkBg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  goOnlinePillText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg, marginLeft: 10 },
  goOfflinePillText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF', marginLeft: 10 },
  pillSettingsBtn: { width: 61, height: 61, borderRadius: 31, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6 },
  pillSettingsBtnActive: { borderWidth: 2, borderColor: COLORS.yellow },
  pillSettingsIcon: { fontSize: 24, color: '#FFFFFF', fontFamily: 'LexendDeca_700Bold' },

  retryRow: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'center', justifyContent: 'center' },
  retryBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  retryText: { fontSize: 14, color: '#5a5a5a', fontFamily: 'LexendDeca_500Medium' },
  settingsBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: 'rgba(212,175,55,0.2)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
  settingsBtnText: { fontSize: 14, color: COLORS.yellow, fontFamily: 'LexendDeca_500Medium' },

  commissionBanner: { position: 'absolute', top: 120, left: 16, right: 16, zIndex: 100 },
  commissionBannerInner: { backgroundColor: 'rgba(227, 27, 35, 0.92)', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', elevation: 10 },
  commissionBannerTitle: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.white, marginBottom: 6, textAlign: 'center' },
  commissionBannerSub: { fontSize: 13, fontFamily: 'LexendDeca_400Regular', color: 'rgba(255, 255, 255, 0.85)', textAlign: 'center' },

  requestCard: { position: 'absolute', bottom: 80, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, elevation: 12, borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  requestContent: { padding: 24 },
  offerTypeBadge: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold', color: '#5a5a5a', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  riderPhoneText: { fontSize: 32, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow, letterSpacing: 1, marginBottom: 4 },
  riderNameText: { fontSize: 13, fontFamily: 'LexendDeca_500Medium', color: '#5a5a5a', marginBottom: 16 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  requestTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 4 },
  requestSubtitle: { fontSize: 14, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular' },
  fareText: { fontSize: 24, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },
  fareBreakdown: { fontSize: 11, fontFamily: 'LexendDeca_400Regular', color: '#5a5a5a', marginTop: 2 },
  rideTypeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FB', borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#EEF0F3' },
  rideTypeImage: { width: 70, height: 45, marginRight: 12 },
  rideTypeInfo: { flex: 1 },
  rideTypeName: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 2 },
  rideTypeDesc: { fontSize: 12, color: '#757575', fontFamily: 'LexendDeca_400Regular' },
  addressesContainer: { backgroundColor: '#F8F9FB', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#EEF0F3' },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green, marginRight: 12 },
  redSquare: { width: 12, height: 12, backgroundColor: COLORS.red, marginRight: 12 },
  dashedLine: { height: 20, marginLeft: 6, borderLeftWidth: 2, borderLeftColor: '#D7DBE0', borderStyle: 'dashed', marginVertical: 4 },
  addressText: { flex: 1, fontSize: 14, color: '#5a5a5a', fontFamily: 'LexendDeca_500Medium' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  rejectButton: { flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: '#EEF0F3', alignItems: 'center', backgroundColor: '#F8F9FB' },
  rejectButtonText: { fontSize: 16, fontFamily: 'LexendDeca_600SemiBold', color: '#5a5a5a' },
  acceptButton: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: COLORS.yellow, alignItems: 'center', elevation: 8 },
  acceptButtonDisabled: { opacity: 0.6 },
  acceptButtonText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  queueText: { textAlign: 'center', marginTop: 16, fontSize: 12, color: '#757575', fontFamily: 'LexendDeca_400Regular' },

  blockedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 999 },
  blockedCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 32, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#EEF0F3' },
  blockedIcon: { fontSize: 48, marginBottom: 16 },
  blockedTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: '#FF3B30', marginBottom: 8 },
  blockedAmount: { fontSize: 36, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow, marginBottom: 12 },
  blockedSub: { fontSize: 14, color: '#5a5a5a', textAlign: 'center', marginBottom: 24, fontFamily: 'LexendDeca_400Regular' },
  blockedSupportBtn: { backgroundColor: '#25D366', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 12 },
  blockedSupportText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#fff' },
  blockedCloseBtn: { paddingVertical: 12 },
  blockedCloseText: { fontSize: 14, color: '#757575', fontFamily: 'LexendDeca_400Regular' },
});

export default HomeScreen;
