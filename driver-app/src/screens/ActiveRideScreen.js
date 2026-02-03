import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as PolylineUtil from '@mapbox/polyline';
import GlassButton from '../components/GlassButton';
import SuccessModal from '../components/SuccessModal';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';
import * as Speech from 'expo-speech';
import { simplifyPolyline } from '../utils/polylineSimplifier';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const ARRIVAL_THRESHOLD = 50;

const CancelReasonModal = ({ visible, onClose, onConfirm, onSupport }) => {
  const [selectedReason, setSelectedReason] = useState(null);

  const reasons = [
    { id: 1, label: 'Ma voiture est en panne' },
    { id: 2, label: 'Impossible de rejoindre le client' },
    { id: 3, label: 'Client ne répond pas' },
    { id: 4, label: 'Urgence personnelle' },
    { id: 5, label: 'Embouteillage majeur' },
    { id: 6, label: 'Autre raison' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={cancelStyles.overlay}>
        <View style={cancelStyles.modal}>
          <Text style={cancelStyles.title}>Raison de l'annulation</Text>
          <Text style={cancelStyles.subtitle}>Sélectionnez une raison</Text>

          <ScrollView style={cancelStyles.reasonsList}>
            {reasons.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  cancelStyles.reasonItem,
                  selectedReason === reason.id && cancelStyles.reasonItemSelected
                ]}
                onPress={() => setSelectedReason(reason.id)}
              >
                <View style={cancelStyles.radio}>
                  {selectedReason === reason.id && (
                    <View style={cancelStyles.radioInner} />
                  )}
                </View>
                <Text style={cancelStyles.reasonText}>{reason.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={cancelStyles.actions}>
            <TouchableOpacity
              style={cancelStyles.supportButton}
              onPress={onSupport}
            >
              <Text style={cancelStyles.supportIcon}>📞</Text>
              <Text style={cancelStyles.supportText}>Contacter Support</Text>
            </TouchableOpacity>

            <View style={cancelStyles.mainActions}>
              <TouchableOpacity
                style={cancelStyles.backButton}
                onPress={onClose}
              >
                <Text style={cancelStyles.backButtonText}>Retour</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  cancelStyles.confirmButton,
                  !selectedReason && cancelStyles.confirmButtonDisabled
                ]}
                onPress={() => {
                  if (selectedReason) {
                    const reason = reasons.find(r => r.id === selectedReason);
                    onConfirm(reason.label);
                  }
                }}
                disabled={!selectedReason}
              >
                <Text style={cancelStyles.confirmButtonText}>
                  Confirmer l'annulation
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

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
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastAnnouncedStep, setLastAnnouncedStep] = useState(null);
  const [isNearDestination, setIsNearDestination] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const announcementDistances = useRef(new Set());

  useEffect(() => {
    if (passedRide) {
      console.log('Initializing ride');
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
          Alert.alert('Permission refusee', 'Localisation requise');
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
          
          const simplifiedCoords = simplifyPolyline(coords, 0.00015);
          setRouteCoordinates(simplifiedCoords);
          hasFetchedRoute.current = true;
          
          setTimeout(() => {
            if (mapRef.current && !navigationStarted) {
              mapRef.current.fitToCoordinates(simplifiedCoords, {
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

  const announceInstruction = useCallback((instruction) => {
    if (!voiceEnabled) return;
    
    Speech.speak(instruction, {
      language: 'fr-FR',
      pitch: 1.0,
      rate: 0.9,
    });
  }, [voiceEnabled]);

  const handleRecenter = useCallback(() => {
    if (mapRef.current && driverLocation) {
      mapRef.current.animateCamera({
        center: driverLocation,
        zoom: 18,
        pitch: navigationStarted ? 30 : 0,
        heading: navigationStarted ? heading : 0,
      }, { duration: 500 });
    }
  }, [driverLocation, heading, navigationStarted]);

  useEffect(() => {
    if (!driverLocation || !currentStep || !allSteps.length || !voiceEnabled) return;

    const distance = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      currentStep.endLocation.latitude,
      currentStep.endLocation.longitude
    );

    const stepKey = `step_${currentStep.id}`;
    
    if (distance <= 300 && distance > 250 && !announcementDistances.current.has(`${stepKey}_300`)) {
      announceInstruction(`Dans 300 metres, ${currentStep.instruction}`);
      announcementDistances.current.add(`${stepKey}_300`);
    } else if (distance <= 100 && distance > 75 && !announcementDistances.current.has(`${stepKey}_100`)) {
      announceInstruction(`Dans 100 metres, ${currentStep.instruction}`);
      announcementDistances.current.add(`${stepKey}_100`);
    } else if (distance <= 50 && distance > 30 && !announcementDistances.current.has(`${stepKey}_50`)) {
      announceInstruction(currentStep.instruction);
      announcementDistances.current.add(`${stepKey}_50`);
    }

    if (currentStep.id !== lastAnnouncedStep) {
      setLastAnnouncedStep(currentStep.id);
      const toDelete = [];
      announcementDistances.current.forEach(key => {
        if (!key.startsWith(`step_${currentStep.id}_`)) {
          toDelete.push(key);
        }
      });
      toDelete.forEach(key => announcementDistances.current.delete(key));
    }
  }, [driverLocation, currentStep, allSteps, voiceEnabled, announceInstruction, lastAnnouncedStep]);

  const toggleVoice = useCallback(() => {
    const newState = !voiceEnabled;
    setVoiceEnabled(newState);
    if (newState) {
      Speech.speak("Navigation vocale activee", { language: 'fr-FR' });
    } else {
      Speech.stop();
    }
  }, [voiceEnabled]);

  useEffect(() => {
    if (!driverLocation || !currentStep || !allSteps.length) return;

    const distance = calculateDistance(
      driverLocation.latitude,
      driverLocation.longitude,
      currentStep.endLocation.latitude,
      currentStep.endLocation.longitude
    );

    setDistanceToStep(formatDistance(distance));

    if (distance < 50 && currentStep.id < allSteps.length - 1) {
      setCurrentStep(allSteps[currentStep.id + 1]);
    }
    
    const destination = ride.status === 'accepted' || ride.status === 'arrived'
      ? ride.pickup.coordinates 
      : ride.dropoff.coordinates;
    
    if (destination) {
      const distanceToDestination = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        destination.latitude,
        destination.longitude
      );
      setIsNearDestination(distanceToDestination <= ARRIVAL_THRESHOLD);
    }
  }, [driverLocation, currentStep, allSteps, ride]);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
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
        pitch: 30,
        heading: heading,
      }, { duration: 1000 });
    }
  }, [driverLocation, heading]);

  const handleCancelRide = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async (reason) => {
    setShowCancelModal(false);
    setLoading(true);
    
    try {
      await driverService.cancelRide(rideId, reason);
      setShowSuccessModal(true);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible d\'annuler la course');
    } finally {
      setLoading(false);
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contacter le Support',
      'Choisissez un moyen',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: '📞 Appeler',
          onPress: () => Linking.openURL('tel:+221338234567')
        },
        {
          text: '💬 WhatsApp',
          onPress: () => Linking.openURL('https://wa.me/221778234567')
        }
      ]
    );
  };

  const handleArrived = useCallback(async () => {
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
  }, [rideId]);

  const handleStartRide = useCallback(async () => {
    setLoading(true);
    try {
      await driverService.startRide(rideId);
      setRide(prev => ({ ...prev, status: 'in_progress' }));
      hasFetchedRoute.current = false;
      setNavigationStarted(false);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de demarrer');
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  const handleCompleteRide = useCallback(async () => {
    setLoading(true);
    try {
      await driverService.completeRide(rideId);
      Alert.alert(
        'Termine!',
        `Gains: ${ride.fare?.toLocaleString()} FCFA`,
        [{ text: 'OK', onPress: () => navigation.navigate('RideRequests') }]
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de terminer');
    } finally {
      setLoading(false);
    }
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
                <Text style={styles.navText}>Demarrer navigation</Text>
              </TouchableOpacity>
            )}
            {isNearDestination ? (
              <GlassButton
                title="Je suis arrive"
                onPress={handleArrived}
                loading={loading}
              />
            ) : (
              <View style={styles.proximityHint}>
                <Text style={styles.proximityText}>
                  Le bouton "Je suis arrive" apparaitra a 50m du client
                </Text>
              </View>
            )}
          </View>
        );
      case 'arrived':
        return (
          <GlassButton
            title="Demarrer la course"
            onPress={handleStartRide}
            loading={loading}
          />
        );
      case 'in_progress':
        return (
          <View>
            {isNearDestination ? (
              <GlassButton
                title="Terminer la course"
                onPress={handleCompleteRide}
                loading={loading}
              />
            ) : (
              <View style={styles.proximityHint}>
                <Text style={styles.proximityText}>
                  Le bouton "Terminer" apparaitra a 50m de la destination
                </Text>
              </View>
            )}
          </View>
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
        customMapStyle={WAZE_DARK_STYLE}
        initialRegion={{
          ...driverLocation,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={false}
        showsBuildings={false}
        showsPointsOfInterest={false}
        showsTraffic={true}
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
            strokeColor="#00D9FF"
            strokeWidth={10}
          />
        )}
      </MapView>

      <TouchableOpacity
        style={styles.recenterButton}
        onPress={handleRecenter}
      >
        <Text style={styles.recenterIcon}>⊙</Text>
      </TouchableOpacity>

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
          style={styles.cancelButton}
          onPress={handleCancelRide}
        >
          <Text style={styles.cancelIcon}>✕</Text>
        </TouchableOpacity>

        {navigationStarted && (
          <TouchableOpacity 
            style={styles.voiceButton}
            onPress={toggleVoice}
          >
            <Text style={styles.voiceIcon}>{voiceEnabled ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>
        )}

        {!navigationStarted && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        )}
      </View>

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
                  {ride.status === 'in_progress' ? 'Destination' : 'Point de depart'}
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

      <CancelReasonModal
        visible={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
        onSupport={handleContactSupport}
      />

      <SuccessModal
        visible={showSuccessModal}
        title="Course annulée"
        message="La course a été annulée avec succès"
        onClose={() => {
          setShowSuccessModal(false);
          navigation.navigate('RideRequests');
        }}
      />
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
  cancelButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 59, 48, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  cancelIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  voiceButton: {
    position: 'absolute',
    top: 60,
    right: 20,
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
  voiceIcon: {
    fontSize: 24,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 300,
    right: 20,
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
  recenterIcon: {
    fontSize: 28,
    color: COLORS.green,
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
    backgroundColor: 'rgba(179, 229, 206, 0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  etaCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
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
    color: '#000',
    marginBottom: 4,
  },
  etaLabel: {
    fontSize: 12,
    color: '#333',
    textTransform: 'uppercase',
  },
  etaDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  addressCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
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
    color: '#333',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500',
  },
  actionContainer: {
    marginTop: 8,
  },
  navButton: {
    backgroundColor: '#FCD116',
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
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
    color: '#000',
  },
  proximityHint: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  proximityText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
});

const cancelStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: 'rgba(179, 229, 206, 0.95)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 20,
  },
  reasonsList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  reasonItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderColor: '#FCD116',
    borderWidth: 3,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FCD116',
  },
  reasonText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  actions: {
    gap: 12,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  supportIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  supportText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  mainActions: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    flex: 2,
    padding: 16,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default ActiveRideScreen;