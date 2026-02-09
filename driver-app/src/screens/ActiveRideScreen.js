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
import { createAuthSocket } from '../services/socket';
import GlassButton from '../components/GlassButton';
import SuccessModal from '../components/SuccessModal';
import COLORS from '../constants/colors';
import { driverService, deliveryService } from '../services/api.service';
import * as Speech from 'expo-speech';
import { speak, speakNavigation, speakAnnouncement, stopSpeaking } from '../utils/voice';
import { simplifyPolyline } from '../utils/polylineSimplifier';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { useAuth } from '../context/AuthContext';
import ChatScreen from './ChatScreen';

var screenWidth = Dimensions.get('window').width;
var screenHeight = Dimensions.get('window').height;
var GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
var ARRIVAL_THRESHOLD = 50;



      <Modal visible={showChat} animationType="slide" onRequestClose={function() { setShowChat(false); }}>
        <ChatScreen
          socket={socketRef.current}
          rideId={deliveryMode ? null : rideId}
          deliveryId={deliveryMode ? deliveryId : null}
          myRole="driver"
          myUserId={auth.user ? auth.user._id : null}
          otherName={ride && ride.rider && ride.rider.userId ? ride.rider.userId.name : 'Passager'}
          onClose={function() { setShowChat(false); }}
        />
      </Modal>

function CancelReasonModal(props) {
  var visible = props.visible;
  var onClose = props.onClose;
  var onConfirm = props.onConfirm;
  var onSupport = props.onSupport;

  var reasonState = useState(null);
  var selectedReason = reasonState[0];
  var setSelectedReason = reasonState[1];

  var reasons = [
    { id: 1, label: 'Ma voiture est en panne' },
    { id: 2, label: 'Impossible de rejoindre le client' },
    { id: 3, label: 'Client ne repond pas' },
    { id: 4, label: 'Urgence personnelle' },
    { id: 5, label: 'Embouteillage majeur' },
    { id: 6, label: 'Autre raison' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cancelStyles.overlay}>
        <View style={cancelStyles.modal}>
          <Text style={cancelStyles.title}>{"Raison de l'annulation"}</Text>
          <Text style={cancelStyles.subtitle}>{"Selectionnez une raison"}</Text>
          <ScrollView style={cancelStyles.reasonsList}>
            {reasons.map(function(reason) {
              return (
                <TouchableOpacity
                  key={reason.id}
                  style={[cancelStyles.reasonItem, selectedReason === reason.id && cancelStyles.reasonItemSelected]}
                  onPress={function() { setSelectedReason(reason.id); }}
                >
                  <View style={cancelStyles.radio}>
                    {selectedReason === reason.id && <View style={cancelStyles.radioInner} />}
                  </View>
                  <Text style={cancelStyles.reasonText}>{reason.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={cancelStyles.actions}>
            <TouchableOpacity style={cancelStyles.supportButton} onPress={onSupport}>
          <Text style={cancelStyles.supportIcon}>{"📞"}</Text>
              <Text style={cancelStyles.supportText}>Contacter Support</Text>
            </TouchableOpacity>
            <View style={cancelStyles.mainActions}>
              <TouchableOpacity style={cancelStyles.backButton} onPress={onClose}>
                <Text style={cancelStyles.backButtonText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[cancelStyles.confirmButton, !selectedReason && cancelStyles.confirmButtonDisabled]}
                onPress={function() {
                  if (selectedReason) {
                    var found = reasons.find(function(r) { return r.id === selectedReason; });
                    onConfirm(found.label);
                  }
                }}
                disabled={!selectedReason}
              >
                <Text style={cancelStyles.confirmButtonText}>{"Confirmer l'annulation"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function QueuedRideBanner(props) {
  var queuedRide = props.queuedRide;
  var onView = props.onView;
  if (!queuedRide) return null;

  return (
    <TouchableOpacity style={queueStyles.banner} onPress={onView}>
      <View style={queueStyles.iconContainer}>
        <Text style={queueStyles.icon}>{"🚗"}</Text>
      </View>
      <View style={queueStyles.textContainer}>
        <Text style={queueStyles.title}>Course en attente</Text>
        <Text style={queueStyles.subtitle}>
          {(queuedRide.fare ? queuedRide.fare.toLocaleString() : '0') + ' FCFA - ' + (queuedRide.distance ? queuedRide.distance.toFixed(1) : '0') + ' km'}
        </Text>
      </View>
      <Text style={queueStyles.arrow}>{'>'}</Text>
    </TouchableOpacity>
  );
}

function ActiveRideScreen(props) {
  var navigation = props.navigation;
  var route = props.route;
  var rideId = route.params.rideId;
  var passedRide = route.params.ride;
  var deliveryMode = route.params.deliveryMode || false;
  var deliveryData = route.params.deliveryData || null;
  var deliveryId = deliveryMode ? (rideId || (deliveryData ? (deliveryData._id || deliveryData.rideId) : null)) : null;
  var auth = useAuth();
  var driver = auth.driver;
  var mapRef = useRef(null);
  var locationSubscription = useRef(null);
  var hasFetchedRoute = useRef(false);
  var socketRef = useRef(null);
  var chatState = useState(false);
  var showChat = chatState[0];
  var setShowChat = chatState[1];
  var announcementDistances = useRef(new Set());
  var cancelledRef = useRef(false);

  var rideState = useState(null);
  var ride = rideState[0];
  var setRide = rideState[1];

  var driverLocState = useState(null);
  var driverLocation = driverLocState[0];
  var setDriverLocation = driverLocState[1];

  var headingState = useState(0);
  var heading = headingState[0];
  var setHeading = headingState[1];

  var routeState = useState([]);
  var routeCoordinates = routeState[0];
  var setRouteCoordinates = routeState[1];

  var stepsState = useState([]);
  var allSteps = stepsState[0];
  var setAllSteps = stepsState[1];

  var currentStepState = useState(null);
  var currentStep = currentStepState[0];
  var setCurrentStep = currentStepState[1];

  var distStepState = useState(null);
  var distanceToStep = distStepState[0];
  var setDistanceToStep = distStepState[1];

  var totalDistState = useState('--');
  var totalDistance = totalDistState[0];
  var setTotalDistance = totalDistState[1];

  var totalDurState = useState('--');
  var totalDuration = totalDurState[0];
  var setTotalDuration = totalDurState[1];

  var loadingState = useState(false);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var initState = useState(true);
  var initializing = initState[0];
  var setInitializing = initState[1];

  var navStartState = useState(false);
  var navigationStarted = navStartState[0];
  var setNavigationStarted = navStartState[1];

  var voiceState = useState(true);
  var voiceEnabled = voiceState[0];
  var setVoiceEnabled = voiceState[1];

  var lastStepState = useState(null);
  var lastAnnouncedStep = lastStepState[0];
  var setLastAnnouncedStep = lastStepState[1];

  var nearDestState = useState(false);
  var isNearDestination = nearDestState[0];
  var setIsNearDestination = nearDestState[1];

  var cancelModalState = useState(false);
  var showCancelModal = cancelModalState[0];
  var setShowCancelModal = cancelModalState[1];

  var successModalState = useState(false);
  var showSuccessModal = successModalState[0];
  var setShowSuccessModal = successModalState[1];

  var queueState = useState(null);
  var queuedRide = queueState[0];
  var setQueuedRide = queueState[1];

  // ========== SOCKET: queued rides + rider cancellation ==========
  useEffect(function() {
    if (!driver || !driver._id) return;


    createAuthSocket().then(function(sock) { socketRef.current = sock;

    sock.on('connect', function() {
      console.log('ActiveRide socket connected');
      sock.emit('driver-online', {
        driverId: driver._id,
        latitude: driverLocation ? driverLocation.latitude : 0,
        longitude: driverLocation ? driverLocation.longitude : 0
      });
      // Join ride/delivery room for cancellations and status updates
      if (rideId) { sock.emit('join-ride-room', rideId); console.log('Joined ride room: ' + rideId); }
      if (deliveryId) { sock.emit('join-delivery-room', deliveryId); console.log('Joined delivery room: ' + deliveryId); }
    });

    sock.on('new-ride-offer', function(rideData) {
      console.log('Queued ride offer received:', rideData);
      if (ride && ride.status === 'in_progress') {
        setQueuedRide(rideData);
        Alert.alert(
          'Nouvelle course en attente',
          (rideData.fare ? rideData.fare.toLocaleString() : '0') + ' FCFA - ' + (rideData.distance ? rideData.distance.toFixed(1) : '0') + ' km',
          [
            { text: 'Refuser', style: 'cancel', onPress: function() { rejectQueuedRide(rideData); } },
            { text: 'Accepter', onPress: function() { acceptQueuedRide(rideData); } }
          ]
        );
      }
    });

    // ===== RIDER CANCELLATION LISTENER =====
    sock.on('ride-cancelled', function(data) {
      console.log('Ride cancelled by rider:', data);
      if (cancelledRef.current) return;
      cancelledRef.current = true;
      speakAnnouncement('Le passager a annule la course');
      Alert.alert(
        'Course annulee par le passager',
        'Le passager a annule la course.' + (data.reason ? '\nRaison: ' + data.reason : ''),
        [
          {
            text: 'OK',
            onPress: function() {
              navigation.replace('RideRequests');
            }
          }
        ]
      );
    });

    // ===== DELIVERY CANCELLATION LISTENER =====
    if (deliveryMode) {
      sock.on('delivery-cancelled', function(data) {
        console.log('Delivery cancelled by rider:', data);
        if (cancelledRef.current) return;
        cancelledRef.current = true;
        speakAnnouncement('Le client a annule la livraison');
        Alert.alert(
          'Livraison annulee',
          'Le client a annule la livraison.',
          [{ text: 'OK', onPress: function() { navigation.replace('RideRequests'); } }]
        );
      });
    }

    // Also listen via ride-status event as backup
    sock.on('ride-status', function(data) {
      console.log('Ride status update via socket:', data);
      if (data.status === 'cancelled' && !cancelledRef.current) {
        cancelledRef.current = true;
        speakAnnouncement('Le passager a annule la course');
        Alert.alert(
          'Course annulee',
          'Le passager a annule la course.',
          [
            {
              text: 'OK',
              onPress: function() {
                navigation.replace('RideRequests');
              }
            }
          ]
        );
      }
    });
    }).catch(function(err) { console.log("Socket error:", err); });

    return function() {
      if (socketRef.current) { socketRef.current.disconnect(); }
    };
  }, [driver ? driver._id : null, ride ? ride.status : null]);


  function acceptQueuedRide(rideData) {
    driverService.acceptRide(rideData.rideId).then(function() {
      setQueuedRide(Object.assign({}, rideData, { accepted: true }));
      speak('Course en attente acceptee');
    }).catch(function(error) {
      console.error('Accept queued ride error:', error);
      setQueuedRide(null);
    });
  }

  function rejectQueuedRide(rideData) {
    driverService.rejectRide(rideData.rideId, 'Occupe').then(function() {
      setQueuedRide(null);
    }).catch(function(error) {
      console.error('Reject queued ride error:', error);
    });
  }

  // ========== INIT RIDE DATA ==========
  useEffect(function() {
    if (passedRide) {
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

  // ========== LOCATION TRACKING ==========
  useEffect(function() {
    var mounted = true;

    function startTracking() {
      Location.requestForegroundPermissionsAsync().then(function(result) {
        if (result.status !== 'granted') {
          Alert.alert('Permission refusee', 'Localisation requise');
          setInitializing(false);
          return;
        }

        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(function(currentLocation) {
          if (mounted) {
            setDriverLocation({
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
            });
            setHeading(currentLocation.coords.heading || 0);
            setInitializing(false);
          }

          Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
            function(location) {
              if (mounted) {
                setDriverLocation({
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                });
                setHeading(location.coords.heading || heading);
                driverService.updateLocation(location.coords.latitude, location.coords.longitude).catch(function() {});
              }
            }
          ).then(function(sub) {
            locationSubscription.current = sub;
          });
        });
      }).catch(function(error) {
        console.error('Location error:', error);
        setInitializing(false);
      });
    }

    startTracking();

    return function() {
      mounted = false;
      if (locationSubscription.current) locationSubscription.current.remove();
    };
  }, []);

  // ========== ROUTE FETCHING ==========
  useEffect(function() {
    if (!ride || !driverLocation || hasFetchedRoute.current) return;

    var destination = (ride.status === 'accepted' || ride.status === 'arrived')
      ? ride.pickup.coordinates
      : ride.dropoff.coordinates;

    if (!destination) return;

    var url = 'https://maps.googleapis.com/maps/api/directions/json?origin=' +
      driverLocation.latitude + ',' + driverLocation.longitude +
      '&destination=' + destination.latitude + ',' + destination.longitude +
      '&key=' + GOOGLE_MAPS_KEY + '&mode=driving&language=fr';

    fetch(url).then(function(response) {
      return response.json();
    }).then(function(data) {
      if (data.status === 'OK' && data.routes.length > 0) {
        var leg = data.routes[0].legs[0];
        setTotalDistance(leg.distance.text);
        setTotalDuration(leg.duration.text);

        var steps = leg.steps.map(function(step, index) {
          return {
            id: index,
            instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
            distance: step.distance.text,
            distanceValue: step.distance.value,
            maneuver: step.maneuver,
            startLocation: { latitude: step.start_location.lat, longitude: step.start_location.lng },
            endLocation: { latitude: step.end_location.lat, longitude: step.end_location.lng }
          };
        });

        setAllSteps(steps);
        if (steps.length > 0) setCurrentStep(steps[0]);

        var points = PolylineUtil.decode(data.routes[0].overview_polyline.points);
        var coords = points.map(function(p) { return { latitude: p[0], longitude: p[1] }; });
        console.log('Route fetched with', coords.length, 'points');
        setRouteCoordinates(coords);
        hasFetchedRoute.current = true;

        setTimeout(function() {
          if (mapRef.current && !navigationStarted) {
            mapRef.current.fitToCoordinates(coords, {
              edgePadding: { top: 200, right: 50, bottom: 400, left: 50 },
              animated: true,
            });
          }
        }, 1000);
      }
    }).catch(function(error) {
      console.error('Route error:', error);
    });
  }, [ride, driverLocation]);

  // ========== VOICE ANNOUNCEMENTS ==========
  var announceInstruction = useCallback(function(instruction) {
    if (!voiceEnabled) return;
    speakNavigation(instruction);
  }, [voiceEnabled]);

  var handleRecenter = useCallback(function() {
    if (mapRef.current && driverLocation) {
      mapRef.current.animateCamera({
        center: driverLocation,
        zoom: 18,
        pitch: navigationStarted ? 30 : 0,
        heading: navigationStarted ? heading : 0,
      }, { duration: 500 });
    }
  }, [driverLocation, heading, navigationStarted]);

  useEffect(function() {
    if (!driverLocation || !currentStep || !allSteps.length || !voiceEnabled) return;

    var distance = calcDistance(
      driverLocation.latitude, driverLocation.longitude,
      currentStep.endLocation.latitude, currentStep.endLocation.longitude
    );

    var stepKey = 'step_' + currentStep.id;

    if (distance <= 300 && distance > 250 && !announcementDistances.current.has(stepKey + '_300')) {
      announceInstruction('Dans 300 metres, ' + currentStep.instruction);
      announcementDistances.current.add(stepKey + '_300');
    } else if (distance <= 100 && distance > 75 && !announcementDistances.current.has(stepKey + '_100')) {
      announceInstruction('Dans 100 metres, ' + currentStep.instruction);
      announcementDistances.current.add(stepKey + '_100');
    } else if (distance <= 50 && distance > 30 && !announcementDistances.current.has(stepKey + '_50')) {
      announceInstruction(currentStep.instruction);
      announcementDistances.current.add(stepKey + '_50');
    }

    if (currentStep.id !== lastAnnouncedStep) {
      setLastAnnouncedStep(currentStep.id);
      announcementDistances.current.clear();
    }
  }, [driverLocation, currentStep, allSteps, voiceEnabled, announceInstruction, lastAnnouncedStep]);

  var toggleVoice = useCallback(function() {
    var newState = !voiceEnabled;
    setVoiceEnabled(newState);
    speak(newState ? "Navigation vocale activee" : "Navigation vocale desactivee");
  }, [voiceEnabled]);

  // ========== STEP TRACKING + NEAR DESTINATION ==========
  useEffect(function() {
    if (!driverLocation || !currentStep || !allSteps.length) return;

    var distance = calcDistance(
      driverLocation.latitude, driverLocation.longitude,
      currentStep.endLocation.latitude, currentStep.endLocation.longitude
    );

    setDistanceToStep(formatDistance(distance));

    if (distance < 50 && currentStep.id < allSteps.length - 1) {
      setCurrentStep(allSteps[currentStep.id + 1]);
    }

    var destination = (ride.status === 'accepted' || ride.status === 'arrived')
      ? ride.pickup.coordinates
      : ride.dropoff.coordinates;

    if (destination) {
      var distToDest = calcDistance(
        driverLocation.latitude, driverLocation.longitude,
        destination.latitude, destination.longitude
      );
      setIsNearDestination(distToDest <= ARRIVAL_THRESHOLD);
    }
  }, [driverLocation, currentStep, allSteps, ride]);

  // ========== HELPERS ==========
  function calcDistance(lat1, lon1, lat2, lon2) {
    var R = 6371e3;
    var phi1 = lat1 * Math.PI / 180;
    var phi2 = lat2 * Math.PI / 180;
    var deltaPhi = (lat2 - lat1) * Math.PI / 180;
    var deltaLambda = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(meters) {
    if (meters < 1000) return Math.round(meters) + ' m';
    return (meters / 1000).toFixed(1) + ' km';
  }

  function getManeuverIcon(maneuver) {
    if (!maneuver) return '^';
    if (maneuver.indexOf('left') !== -1) return '<';
    if (maneuver.indexOf('right') !== -1) return '>';
    if (maneuver.indexOf('uturn') !== -1) return 'U';
    return '^';
  }

  // ========== ACTIONS ==========
  var handleStartNavigation = useCallback(function() {
    setNavigationStarted(true);
    if (mapRef.current && driverLocation) {
      mapRef.current.animateCamera({ center: driverLocation, zoom: 18, pitch: 30, heading: heading }, { duration: 1000 });
    }
  }, [driverLocation, heading]);

  function handleCancelRide() {
    setShowCancelModal(true);
  }

  function handleConfirmCancel(reason) {
    setShowCancelModal(false);
    setLoading(true);
    var cancelPromise = deliveryMode ? driverService.cancelDelivery(deliveryId, reason) : driverService.cancelRide(rideId, reason);
    cancelPromise.then(function() {
    }).catch(function(error) {
      Alert.alert('Erreur', "Impossible d'annuler la course");
    }).finally(function() {
      setLoading(false);
    });
  }

  function handleContactSupport() {
    Alert.alert('Contacter le Support', 'Choisissez un moyen', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Appeler', onPress: function() { Linking.openURL('tel:+221338234567'); } },
      { text: 'WhatsApp', onPress: function() { Linking.openURL('https://wa.me/221778234567'); } }
    ]);
  }

  var handleArrived = useCallback(function() {
    setLoading(true);
    driverService.updateRideStatus(rideId, 'arrived').then(function() {
      setRide(function(prev) { return Object.assign({}, prev, { status: 'arrived' }); });
      hasFetchedRoute.current = false;
      setNavigationStarted(false);
      speakAnnouncement("Vous etes arrive au point de depart");
    }).catch(function(error) {
      var msg = (error.response && error.response.data && error.response.data.message) || 'Erreur';
      Alert.alert('Erreur', msg);
    }).finally(function() {
      setLoading(false);
    });
  }, [rideId]);

  var handleStartRide = useCallback(function() {
    setLoading(true);
    driverService.startRide(rideId).then(function() {
      setRide(function(prev) { return Object.assign({}, prev, { status: 'in_progress' }); });
      hasFetchedRoute.current = false;
      setNavigationStarted(false);
      speakAnnouncement('Course demarree. Bonne route!');
    }).catch(function(error) {
      Alert.alert('Erreur', "Impossible de demarrer");
    }).finally(function() {
      setLoading(false);
    });
  }, [rideId]);

  var handleCompleteRide = useCallback(function() {
    setLoading(true);
    driverService.completeRide(rideId).then(function(response) {
      speakAnnouncement('Course terminee. Vous avez gagne ' + (ride.fare || 0) + ' francs.');

      if (queuedRide && queuedRide.accepted) {
        Alert.alert(
          'Course terminee!',
          'Gains: ' + (ride.fare ? ride.fare.toLocaleString() : '0') + ' FCFA\n\nVous avez une course en attente.',
          [{
            text: 'Commencer la prochaine course',
            onPress: function() {
              navigation.replace('ActiveRide', {
                rideId: queuedRide.rideId,
                ride: queuedRide
              });
            }
          }]
        );
      } else {
        Alert.alert(
          'Course terminee!',
          'Gains: ' + (ride.fare ? ride.fare.toLocaleString() : '0') + ' FCFA',
          [{ text: 'OK', onPress: function() { navigation.replace('RideRequests'); } }]
        );
      }
    }).catch(function(error) {
      Alert.alert('Erreur', 'Impossible de terminer');
    }).finally(function() {
      setLoading(false);
    });
  }, [rideId, ride, navigation, queuedRide]);

  // ========== LOADING STATE ==========
  if (initializing || !driverLocation || !ride) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  var destination = (ride.status === 'accepted' || ride.status === 'arrived')
    ? (ride.pickup ? ride.pickup.coordinates : null)
    : (ride.dropoff ? ride.dropoff.coordinates : null);

  function getStatusText() {
    switch (ride.status) {
      case 'accepted': return 'En route vers le passager';
      case 'arrived': return 'En attente du passager';
      case 'in_progress': return 'Course en cours';
      default: return '';
    }
  }

  function getActionButton() {
    switch (ride.status) {
      case 'accepted':
        return (
          <View>
            {!navigationStarted && (
              <TouchableOpacity style={styles.navButton} onPress={handleStartNavigation}>
          <Text style={styles.navIcon}>{"🧭"}</Text>
                <Text style={styles.navText}>{"Demarrer navigation"}</Text>
              </TouchableOpacity>
            )}
            {isNearDestination ? (
              <GlassButton title="Je suis arrive" onPress={handleArrived} loading={loading} />
            ) : (
              <View style={styles.proximityHint}>
                <Text style={styles.proximityText}>{"Le bouton \"Je suis arrive\" apparaitra a 50m du client"}</Text>
              </View>
            )}
          </View>
        );
      case 'arrived':
        return <GlassButton title="Demarrer la course" onPress={handleStartRide} loading={loading} />;
      case 'in_progress':
        return (
          <View>
            {isNearDestination ? (
              <GlassButton title="Terminer la course" onPress={handleCompleteRide} loading={loading} />
            ) : (
              <View style={styles.proximityHint}>
                <Text style={styles.proximityText}>{"Le bouton \"Terminer\" apparaitra a 50m de la destination"}</Text>
              </View>
            )}
          </View>
        );
      default:
        return null;
    }
  }

  // ========== RENDER ==========
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={WAZE_DARK_STYLE}
        initialRegion={{
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02
        }}
        showsUserLocation={false}
        showsBuildings={false}
        showsPointsOfInterest={false}
        showsTraffic={true}
        rotateEnabled={navigationStarted}
        pitchEnabled={navigationStarted}
      >
        <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }} flat rotation={heading}>
          <View style={styles.driverMarker}><Text style={styles.driverText}>{"▲"}</Text></View>
        </Marker>
        {destination && <Marker coordinate={destination} pinColor={ride.status === 'in_progress' ? COLORS.red : COLORS.green} />}
        {routeCoordinates.length > 0 && (
          <>
            <Polyline coordinates={routeCoordinates} strokeColor="#000000" strokeWidth={14} lineCap="round" lineJoin="round" />
            <Polyline coordinates={routeCoordinates} strokeColor="#4285F4" strokeWidth={8} lineCap="round" lineJoin="round" />
          </>
        )}
      </MapView>

      <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
        <Text style={styles.recenterIcon}>{"O"}</Text>
      </TouchableOpacity>

      {queuedRide && queuedRide.accepted && (
        <View style={queueStyles.bannerContainer}>
          <QueuedRideBanner queuedRide={queuedRide} onView={function() {}} />
        </View>
      )}

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
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRide}>
          <Text style={styles.cancelIcon}>{"X"}</Text>
        </TouchableOpacity>
        {navigationStarted && (
          <TouchableOpacity style={styles.voiceButton} onPress={toggleVoice}>
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
          <TouchableOpacity style={styles.stopNavButton} onPress={function() {
            setNavigationStarted(false);
            if (mapRef.current) {
              mapRef.current.animateCamera({ pitch: 0, zoom: 15 }, { duration: 500 });
            }
          }}>
            <Text style={styles.stopNavText}>{"||"}</Text>
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
                <Text style={styles.addressLabel}>{ride.status === 'in_progress' ? 'Destination' : 'Point de depart'}</Text>
                <Text style={styles.addressText} numberOfLines={2}>
                  {ride.status === 'in_progress' ? (ride.dropoff ? ride.dropoff.address : '') : (ride.pickup ? ride.pickup.address : '')}
                </Text>
              </View>
            </View>
          </View>


          <View style={styles.chatButtonRow}>
            <TouchableOpacity style={styles.chatBtn} onPress={function() { setShowChat(true); }}>
              <Text style={styles.chatBtnIcon}>{String.fromCodePoint(0x1F4AC)}</Text>
              <Text style={styles.chatBtnText}>Message</Text>
            </TouchableOpacity>
            {ride && ride.rider && ride.rider.userId && ride.rider.userId.phone && (
              <TouchableOpacity style={styles.callBtn} onPress={function() { Linking.openURL('tel:' + ride.rider.userId.phone); }}>
                <Text style={styles.chatBtnIcon}>{String.fromCodePoint(0x1F4DE)}</Text>
                <Text style={styles.chatBtnText}>Appeler</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.actionContainer}>{getActionButton()}</View>
        </View>
      )}

      <CancelReasonModal
        visible={showCancelModal}
        onClose={function() { setShowCancelModal(false); }}
        onConfirm={handleConfirmCancel}
        onSupport={handleContactSupport}
      />

      <SuccessModal
        visible={showSuccessModal}
        title="Course annulee"
        message="La course a ete annulee avec succes"
        onClose={function() {
          setShowSuccessModal(false);
          navigation.replace('RideRequests');
        }}
      />
    </View>
  );
}

var queueStyles = StyleSheet.create({
  bannerContainer: { position: 'absolute', top: 130, left: 20, right: 20 },
  banner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(252, 209, 22, 0.95)', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 20 },
  textContainer: { flex: 1 },
  title: { fontSize: 14, fontWeight: 'bold', color: '#000' },
  subtitle: { fontSize: 12, color: '#333' },
  arrow: { fontSize: 20, fontWeight: 'bold', color: '#000' },
});

var cancelStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { backgroundColor: 'rgba(179, 229, 206, 0.95)', borderRadius: 20, padding: 24, width: '100%', maxHeight: '80%' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#333', marginBottom: 20 },
  reasonsList: { maxHeight: 300, marginBottom: 20 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(255, 255, 255, 0.4)', borderRadius: 12, marginBottom: 12, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.5)' },
  reasonItemSelected: { backgroundColor: 'rgba(255, 255, 255, 0.7)', borderColor: '#FCD116', borderWidth: 3 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#333', marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FCD116' },
  reasonText: { flex: 1, fontSize: 16, color: '#000', fontWeight: '500' },
  actions: { gap: 12 },
  supportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(255, 255, 255, 0.6)', borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.8)' },
  supportIcon: { fontSize: 20, marginRight: 8 },
  supportText: { fontSize: 16, fontWeight: '600', color: '#000' },
  mainActions: { flexDirection: 'row', gap: 12 },
  backButton: { flex: 1, padding: 16, backgroundColor: 'rgba(255, 255, 255, 0.6)', borderRadius: 12, alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.8)' },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#333' },
  confirmButton: { flex: 2, padding: 16, backgroundColor: '#FF3B30', borderRadius: 12, alignItems: 'center' },
  confirmButtonDisabled: { opacity: 0.4 },
  confirmButtonText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
});

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white },
  loadingText: { marginTop: 16, fontSize: 16, color: COLORS.gray },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  driverMarker: { width: 44, height: 44, backgroundColor: COLORS.green, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: COLORS.white },
  driverText: { fontSize: 18, color: COLORS.white, fontWeight: 'bold' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  cancelButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255, 59, 48, 0.95)', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  cancelIcon: { fontSize: 24, color: '#FFFFFF', fontWeight: 'bold' },
  voiceButton: { position: 'absolute', top: 60, right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.95)', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  voiceIcon: { fontSize: 24 },
  recenterButton: { position: 'absolute', bottom: 300, right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255, 255, 255, 0.95)', alignItems: 'center', justifyContent: 'center', elevation: 8 },
  recenterIcon: { fontSize: 28, color: COLORS.green, fontWeight: 'bold' },
  statusBadge: { backgroundColor: 'rgba(255, 255, 255, 0.95)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, elevation: 8 },
  statusText: { fontSize: 15, fontWeight: '700', color: COLORS.black },
  turnInstruction: { position: 'absolute', top: 120, left: 20, right: 20, flexDirection: 'row', backgroundColor: 'rgba(30, 30, 30, 0.95)', borderRadius: 16, padding: 16, alignItems: 'center', elevation: 10 },
  turnIconContainer: { width: 60, height: 60, borderRadius: 12, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  turnIcon: { fontSize: 32, color: COLORS.white, fontWeight: 'bold' },
  turnTextContainer: { flex: 1 },
  turnDistance: { fontSize: 22, fontWeight: 'bold', color: COLORS.white, marginBottom: 4 },
  turnText: { fontSize: 15, color: 'rgba(255, 255, 255, 0.9)' },
  wazeBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(30, 30, 30, 0.95)', paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  etaContainer: { flex: 1 },
  etaTime: { fontSize: 32, fontWeight: 'bold', color: COLORS.white, marginBottom: 4 },
  etaDistance: { fontSize: 16, color: 'rgba(255, 255, 255, 0.8)' },
  stopNavButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center' },
  stopNavText: { fontSize: 28, color: COLORS.white, fontWeight: 'bold' },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(179, 229, 206, 0.95)', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, elevation: 12 },
  etaCard: { backgroundColor: 'rgba(255, 255, 255, 0.4)', borderRadius: 16, padding: 16, marginBottom: 12 },
  etaRow: { flexDirection: 'row', alignItems: 'center' },
  etaItem: { flex: 1, alignItems: 'center' },
  etaValue: { fontSize: 24, fontWeight: 'bold', color: '#000', marginBottom: 4 },
  etaLabel: { fontSize: 12, color: '#333', textTransform: 'uppercase' },
  etaDivider: { width: 1, height: 40, backgroundColor: 'rgba(0, 0, 0, 0.2)' },
  addressCard: { backgroundColor: 'rgba(255, 255, 255, 0.4)', borderRadius: 16, padding: 16, marginBottom: 12 },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.green, marginRight: 12 },
  redSquare: { width: 14, height: 14, backgroundColor: COLORS.red, marginRight: 12 },
  addressTextContainer: { flex: 1 },
  addressLabel: { fontSize: 12, color: '#333', marginBottom: 4 },
  addressText: { fontSize: 15, color: '#000', fontWeight: '500' },
  actionContainer: { marginTop: 8 },
  navButton: { backgroundColor: '#FCD116', borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 6 },
  navIcon: { fontSize: 20, marginRight: 8 },
  navText: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  proximityHint: { backgroundColor: 'rgba(255, 255, 255, 0.5)', padding: 16, borderRadius: 12, alignItems: 'center' },
  proximityText: { fontSize: 14, color: '#333', textAlign: 'center' },
  chatButtonRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  chatBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(179, 229, 206, 0.2)', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(179, 229, 206, 0.3)' },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(76, 217, 100, 0.2)', borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(76, 217, 100, 0.3)' },
  chatBtnIcon: { fontSize: 18, marginRight: 8 },
  chatBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default ActiveRideScreen;






