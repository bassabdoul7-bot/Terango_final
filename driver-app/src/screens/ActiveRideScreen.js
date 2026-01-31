import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as PolylineUtil from '@mapbox/polyline';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const ActiveRideScreen = ({ route, navigation }) => {
  const { rideId, ride: passedRide } = route.params;
  
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);
  const hasFetchedRoute = useRef(false);
  
  const [ride, setRide] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [allSteps, setAllSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);
  const [distanceToStep, setDistanceToStep] = useState(null);
  const [totalDistance, setTotalDistance] = useState('--');
  const [totalDuration, setTotalDuration] = useState('--');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [navigationStarted, setNavigationStarted] = useState(false);

  useEffect(() => {
    if (passedRide) {
      console.log('✅ Initializing ride');
      setRide({
        _id: rideId,
        status: 'accepted',
        pickup: passedRide.pickup,
        dropoff: passedRide.dropoff,
        fare: passedRide.fare,
        distance: passedRide.distance
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const startTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'Localisation requise');
          setInitializing(false);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        if (mounted) {
          const newLoc = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          };
          setDriverLocation(newLoc);
          setHeading(currentLocation.coords.heading || 0);
          setInitializing(false);
        }

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000,
            distanceInterval: 5,
          },
          (location) => {
            if (mounted) {
              const newLoc = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              };
              setDriverLocation(newLoc);
              setHeading(location.coords.heading || heading);
              
              driverService.updateLocation(
                location.coords.latitude,
                location.coords.longitude
              ).catch(() => {});
            }
          }
        );
      } catch (error) {
        console.error('Location error:', error);
        setInitializing(false);
      }
    };

    startTracking();

    return () => {
      mounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (!ride || !driverLocation || hasFetchedRoute.current) return;

    const fetchRoute = async () => {
      const destination = ride.status === 'accepted' || ride.status === 'arrived'
        ? ride.pickup.coordinates 
        : ride.dropoff.coordinates;

      if (!destination) return;

      try {
        const originStr = `${driverLocation.latitude},${driverLocation.longitude}`;
        const destStr = `${destination.latitude},${destination.longitude}`;
        
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${GOOGLE_MAPS_KEY}&mode=driving&language=fr`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.routes.length > 0) {
          const routeData = data.routes[0];
          const leg = routeData.legs[0];
          
          setTotalDistance(leg.distance.text);
          setTotalDuration(leg.duration.text);
          
          // Extract all steps for turn-by-turn
          const steps = leg.steps.map((step, index) => ({
            id: index,
            instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
            distance: step.distance.text,
            distanceValue: step.distance.value,
            duration: step.duration.text,
            maneuver: step.maneuver,
            startLocation: {
              latitude: step.start_location.lat,
              longitude: step.start_location.lng,
            },
            endLocation: {
              latitude: step.end_location.lat,
              longitude: step.end_location.lng,
            }
          }));
          
          setAllSteps(steps);
          if (steps.length > 0) {
            setCurrentStep(steps[0]);
          }
          
          const points = PolylineUtil.decode(routeData.overview_polyline.points);
          const coords = points.map(point => ({
            latitude: point[0],
            longitude: point[1],
          }));
          
          setRouteCoordinates(coords);
          hasFetchedRoute.current = true;
          
          setTimeout(() => {
            if (mapRef.current && !navigationStarted) {
              mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 200, right: 50, bottom: 400, left: 50 },
                animated: true,
              });
            }
          }, 1000);
        }
      } catch (error) {
        console.error('Route error:', error);
      }
    };

    fetchRoute();
  }, [ride, driverLocation]);

  // Update current step based on driver location
  useEffect(() => {
    if (!driverLocation || !currentStep || !allSteps.length) return;

    const distance = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      currentStep.endLocation.latitude,
      currentStep.endLocation.longitude
    );

    setDistanceToStep(formatDistance(distance));

    // If within 20 meters of current step, move to next
    if (distance < 20 && currentStep.id < allSteps.length - 1) {
      setCurrentStep(allSteps[currentStep.id + 1]);
    }
  }, [driverLocation, currentStep, allSteps]);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const getManeuverIcon = (maneuver) => {
    if (!maneuver) return '↑';
    if (maneuver.includes('left')) return '↰';
    if (maneuver.includes('right')) return '↱';
    if (maneuver.includes('straight')) return '↑';
    if (maneuver.includes('uturn')) return '↶';
    return '↑';
  };

  const handleStartNavigation = useCallback(() => {
    setNavigationStarted(true);
    
    if (mapRef.current && driverLocation) {
      mapRef.current.animateCamera({
        center: driverLocation,
        zoom: 18,
        pitch: 60,
        heading: heading,
      }, { duration: 1000 });
    }
  }, [driverLocation, heading]);

  const handleArrived = useCallback(async () => {
    Alert.alert(
      'Arrivé',
      'Vous êtes au point de départ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui',
          onPress: async () => {
            setLoading(true);
            try {
              await driverService.updateRideStatus(rideId, 'arrived');
              setRide(prev => ({ ...prev, status: 'arrived' }));
              hasFetchedRoute.current = false;
              setNavigationStarted(false);
            } catch (error) {
              Alert.alert('Erreur', error.response?.data?.message || 'Erreur');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [rideId]);

  const handleStartRide = useCallback(async () => {
    Alert.alert(
      'Démarrer',
      'Le passager est à bord?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          onPress: async () => {
            setLoading(true);
            try {
              await driverService.startRide(rideId);
              setRide(prev => ({ ...prev, status: 'in_progress' }));
              hasFetchedRoute.current = false;
              setNavigationStarted(false);
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de démarrer');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [rideId]);

  const handleCompleteRide = useCallback(async () => {
    Alert.alert(
      'Terminer',
      'Arrivé à destination?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui',
          onPress: async () => {
            setLoading(true);
            try {
              await driverService.completeRide(rideId);
              Alert.alert(
                '🎉 Terminé!',
                `Gains: ${ride.fare?.toLocaleString()} FCFA`,
                [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
              );
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de terminer');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [rideId, ride, navigation]);

  if (initializing || !driverLocation || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  const destination = ride.status === 'accepted' || ride.status === 'arrived'
    ? ride.pickup?.coordinates
    : ride.dropoff?.coordinates;

  const getStatusText = () => {
    switch (ride.status) {
      case 'accepted': return 'En route vers le passager';
      case 'arrived': return 'En attente du passager';
      case 'in_progress': return 'Course en cours';
      default: return '';
    }
  };

  const getActionButton = () => {
    switch (ride.status) {
      case 'accepted':
        return (
          <View>
            {!navigationStarted && (
              <TouchableOpacity 
                style={styles.navButton}
                onPress={handleStartNavigation}
              >
                <Text style={styles.navIcon}>🧭</Text>
                <Text style={styles.navText}>Démarrer navigation</Text>
              </TouchableOpacity>
            )}
            <GlassButton
              title="Je suis arrivé"
              onPress={handleArrived}
              loading={loading}
            />
          </View>
        );
      case 'arrived':
        return (
          <GlassButton
            title="Démarrer la course"
            onPress={handleStartRide}
            loading={loading}
          />
        );
      case 'in_progress':
        return (
          <GlassButton
            title="Terminer la course"
            onPress={handleCompleteRide}
            loading={loading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          ...driverLocation,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={false}
        rotateEnabled={navigationStarted}
        pitchEnabled={navigationStarted}
      >
        <Marker
          coordinate={driverLocation}
          anchor={{ x: 0.5, y: 0.5 }}
          flat={true}
          rotation={heading}
        >
          <View style={styles.driverMarker}>
            <Text style={styles.driverText}>▲</Text>
          </View>
        </Marker>

        {destination && (
          <Marker
            coordinate={destination}
            pinColor={ride.status === 'in_progress' ? COLORS.red : COLORS.green}
          />
        )}

        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#4285F4"
            strokeWidth={6}
          />
        )}
      </MapView>

      {/* Waze-style turn instruction */}
      {navigationStarted && currentStep && (
        <View style={styles.turnInstruction}>
          <View style={styles.turnIconContainer}>
            <Text style={styles.turnIcon}>{getManeuverIcon(currentStep.maneuver)}</Text>
          </View>
          <View style={styles.turnTextContainer}>
            <Text style={styles.turnDistance}>{distanceToStep}</Text>
            <Text style={styles.turnText} numberOfLines={2}>{currentStep.instruction}</Text>
          </View>
        </View>
      )}

      <View style={styles.topBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            Alert.alert(
              'Quitter',
              'Course en cours. Êtes-vous sûr?',
              [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Quitter', onPress: () => navigation.goBack() }
              ]
            );
          }}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        {!navigationStarted && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        )}
      </View>

      {/* Waze-style bottom bar */}
      {navigationStarted && (
        <View style={styles.wazeBottomBar}>
          <View style={styles.etaContainer}>
            <Text style={styles.etaTime}>{totalDuration}</Text>
            <Text style={styles.etaDistance}>{totalDistance}</Text>
          </View>
          <TouchableOpacity 
            style={styles.stopNavButton}
            onPress={() => {
              setNavigationStarted(false);
              if (mapRef.current) {
                mapRef.current.animateCamera({
                  pitch: 0,
                  zoom: 15,
                }, { duration: 500 });
              }
            }}
          >
            <Text style={styles.stopNavText}>■</Text>
          </TouchableOpacity>
        </View>
      )}

      {!navigationStarted && (
        <View style={styles.bottomSheet}>
          <View style={styles.etaCard}>
            <View style={styles.etaRow}>
              <View style={styles.etaItem}>
                <Text style={styles.etaValue}>{totalDuration}</Text>
                <Text style={styles.etaLabel}>Temps</Text>
              </View>
              <View style={styles.etaDivider} />
              <View style={styles.etaItem}>
                <Text style={styles.etaValue}>{totalDistance}</Text>
                <Text style={styles.etaLabel}>Distance</Text>
              </View>
            </View>
          </View>

          <View style={styles.addressCard}>
            <View style={styles.addressRow}>
              <View style={ride.status === 'in_progress' ? styles.redSquare : styles.greenDot} />
              <View style={styles.addressTextContainer}>
                <Text style={styles.addressLabel}>
                  {ride.status === 'in_progress' ? 'Destination' : 'Point de départ'}
                </Text>
                <Text style={styles.addressText} numberOfLines={2}>
                  {ride.status === 'in_progress' 
                    ? ride.dropoff?.address 
                    : ride.pickup?.address}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.actionContainer}>
            {getActionButton()}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.gray,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  driverMarker: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.green,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  driverText: {
    fontSize: 18,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  backIcon: {
    fontSize: 28,
    color: COLORS.black,
    fontWeight: 'bold',
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
  },
  turnInstruction: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  turnIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  turnIcon: {
    fontSize: 32,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  turnTextContainer: {
    flex: 1,
  },
  turnDistance: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 4,
  },
  turnText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  wazeBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  etaContainer: {
    flex: 1,
  },
  etaTime: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 4,
  },
  etaDistance: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  stopNavButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNavText: {
    fontSize: 28,
    color: COLORS.white,
    fontWeight: 'bold',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  etaCard: {
    backgroundColor: 'rgba(0, 133, 63, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  etaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  etaItem: {
    flex: 1,
    alignItems: 'center',
  },
  etaValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.green,
    marginBottom: 4,
  },
  etaLabel: {
    fontSize: 12,
    color: COLORS.gray,
    textTransform: 'uppercase',
  },
  etaDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.grayLight,
  },
  addressCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.green,
    marginRight: 12,
  },
  redSquare: {
    width: 14,
    height: 14,
    backgroundColor: COLORS.red,
    marginRight: 12,
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 15,
    color: COLORS.black,
    fontWeight: '500',
  },
  actionContainer: {
    marginTop: 8,
  },
  navButton: {
    backgroundColor: COLORS.green,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  navIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  navText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
});

export default ActiveRideScreen;