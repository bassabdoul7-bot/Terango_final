import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, ActivityIndicator, Modal, ScrollView, Linking, TextInput, Image } from 'react-native';
import { Map, Camera, Marker, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';

const TERANGO_STYLE = require('../constants/terangoMapStyle.json');
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as PolylineUtil from '@mapbox/polyline';
import { createAuthSocket } from '../services/socket';
import GlassButton from '../components/GlassButton';
import SuccessModal from '../components/SuccessModal';
import COLORS from '../constants/colors';
import { driverService, deliveryService } from '../services/api.service';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { speak, speakNavigation, speakAnnouncement, stopSpeaking } from '../utils/voice';
import { simplifyPolyline } from '../utils/polylineSimplifier';
import { useAuth } from '../context/AuthContext';
import ChatScreen from './ChatScreen';

var screenWidth = Dimensions.get('window').width;
var screenHeight = Dimensions.get('window').height;
var ARRIVAL_APPEAR_THRESHOLD = 50;
var ARRIVAL_DISAPPEAR_THRESHOLD = 75;

// LRU Cache for directions to avoid duplicate API calls
var LRU_MAX = 20;
var directionsCacheMap = {};
var directionsCacheKeys = [];
function directionsCacheGet(key) {
  return directionsCacheMap[key] || null;
}
function directionsCacheSet(key, value) {
  if (directionsCacheMap[key]) {
    // Move to end (most recent)
    directionsCacheKeys = directionsCacheKeys.filter(function(k) { return k !== key; });
    directionsCacheKeys.push(key);
    directionsCacheMap[key] = value;
    return;
  }
  if (directionsCacheKeys.length >= LRU_MAX) {
    var oldest = directionsCacheKeys.shift();
    delete directionsCacheMap[oldest];
  }
  directionsCacheKeys.push(key);
  directionsCacheMap[key] = value;
}
function directionsCacheClear() {
  directionsCacheMap = {};
  directionsCacheKeys = [];
}
function directionsCacheDeleteMatching(substring) {
  directionsCacheKeys = directionsCacheKeys.filter(function(key) {
    if (key.indexOf(substring) !== -1) { delete directionsCacheMap[key]; return false; }
    return true;
  });
}

function CancelReasonModal(props) {
  var visible = props.visible; var onClose = props.onClose; var onConfirm = props.onConfirm; var onSupport = props.onSupport;
  var reasonState = useState(null); var selectedReason = reasonState[0]; var setSelectedReason = reasonState[1];
  var reasons = [{id:1,label:'Ma voiture est en panne'},{id:2,label:'Impossible de rejoindre le client'},{id:3,label:'Client ne repond pas'},{id:4,label:'Urgence personnelle'},{id:5,label:'Embouteillage majeur'},{id:6,label:'Autre raison'}];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={cancelStyles.overlay}><View style={cancelStyles.modal}>
        <Text style={cancelStyles.title}>{"Raison de l'annulation"}</Text><Text style={cancelStyles.subtitle}>{"Selectionnez une raison"}</Text>
        <ScrollView style={cancelStyles.reasonsList}>{reasons.map(function(reason){return(<TouchableOpacity key={reason.id} style={[cancelStyles.reasonItem,selectedReason===reason.id&&cancelStyles.reasonItemSelected]} onPress={function(){setSelectedReason(reason.id);}}><View style={cancelStyles.radio}>{selectedReason===reason.id&&<View style={cancelStyles.radioInner}/>}</View><Text style={cancelStyles.reasonText}>{reason.label}</Text></TouchableOpacity>);})}</ScrollView>
        <View style={cancelStyles.actions}>
          <TouchableOpacity style={cancelStyles.supportButton} onPress={onSupport}><Text style={cancelStyles.supportIcon}>{"\uD83D\uDCDE"}</Text><Text style={cancelStyles.supportText}>Contacter Support</Text></TouchableOpacity>
          <View style={cancelStyles.mainActions}><TouchableOpacity style={cancelStyles.backButton} onPress={onClose}><Text style={cancelStyles.backButtonText}>Retour</Text></TouchableOpacity><TouchableOpacity style={[cancelStyles.confirmButton,!selectedReason&&cancelStyles.confirmButtonDisabled]} onPress={function(){if(selectedReason){var found=reasons.find(function(r){return r.id===selectedReason;});onConfirm(found.label);}}} disabled={!selectedReason}><Text style={cancelStyles.confirmButtonText}>{"Confirmer l'annulation"}</Text></TouchableOpacity></View>
        </View>
      </View></View>
    </Modal>
  );
}

function QueuedRideBanner(props) {
  var queuedRide = props.queuedRide; var onView = props.onView; if (!queuedRide) return null;
  return (<TouchableOpacity style={queueStyles.banner} onPress={onView}><View style={queueStyles.iconContainer}><Text style={queueStyles.icon}>{"\uD83D\uDE97"}</Text></View><View style={queueStyles.textContainer}><Text style={queueStyles.title}>Course en attente</Text><Text style={queueStyles.subtitle}>{(queuedRide.driverEarnings?queuedRide.driverEarnings.toLocaleString():'0')+' FCFA - '+(queuedRide.distance?queuedRide.distance.toFixed(1):'0')+' km'}</Text></View><Text style={queueStyles.arrow}>{'>'}</Text></TouchableOpacity>);
}

function ActiveRideScreen(props) {
  var navigation = props.navigation; var route = props.route;
  var rideId = route.params.rideId; var passedRide = route.params.ride;
  var deliveryMode = route.params.deliveryMode || false; var deliveryData = route.params.deliveryData || null;
  var deliveryId = deliveryMode ? (rideId || (deliveryData ? (deliveryData._id || deliveryData.rideId) : null)) : null;
  var auth = useAuth(); var driver = auth.driver;
  var mapRef = useRef(null);
  var cameraRef = useRef(null); var locationSubscription = useRef(null); var hasFetchedRoute = useRef(false); var socketRef = useRef(null);
  var chatState = useState(false); var showChat = chatState[0]; var setShowChat = chatState[1];
  var announcementDistances = useRef(new Set()); var cancelledRef = useRef(false);
  var lastDirectionsFetchTime = useRef(0);
  var isNearDestRef = useRef(false);
  var hapticFiredRef = useRef(false);
  var lastCameraUpdateTime = useRef(0);
  var lastCameraHeading = useRef(0);
  var lastProgressCalcTime = useRef(0);
  var toastMessageState = useState(null); var toastMessage = toastMessageState[0]; var setToastMessage = toastMessageState[1];

  var rideState = useState(null); var ride = rideState[0]; var setRide = rideState[1];
  var driverLocState = useState(null); var driverLocation = driverLocState[0]; var setDriverLocation = driverLocState[1];
  var headingState = useState(0); var heading = headingState[0]; var setHeading = headingState[1];
  var speedState = useState(0); var currentSpeed = speedState[0]; var setCurrentSpeed = speedState[1];
  var offRouteCount = useRef(0);
  var [routeProgress, setRouteProgress] = useState(0);
  var lastProgress = useRef(0);
  var lastRerouteTime = useRef(0);
  var routeState = useState([]); var routeCoordinates = routeState[0]; var setRouteCoordinates = routeState[1];
  var stepsState = useState([]); var allSteps = stepsState[0]; var setAllSteps = stepsState[1];
  var currentStepState = useState(null); var currentStep = currentStepState[0]; var setCurrentStep = currentStepState[1];
  var distStepState = useState(null); var distanceToStep = distStepState[0]; var setDistanceToStep = distStepState[1];
  var totalDistState = useState('--'); var totalDistance = totalDistState[0]; var setTotalDistance = totalDistState[1];
  var totalDurState = useState('--'); var totalDuration = totalDurState[0]; var setTotalDuration = totalDurState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var initState = useState(true); var initializing = initState[0]; var setInitializing = initState[1];
  var navStartState = useState(false); var navigationStarted = navStartState[0]; var setNavigationStarted = navStartState[1];
  var pinModalState = useState(false); var showPinModal = pinModalState[0]; var setShowPinModal = pinModalState[1];
  var pinInputState = useState(''); var pinInput = pinInputState[0]; var setPinInput = pinInputState[1];
  var pinErrorState = useState(''); var pinError = pinErrorState[0]; var setPinError = pinErrorState[1];
  var pinVerifiedState = useState(false); var pinVerified = pinVerifiedState[0]; var setPinVerified = pinVerifiedState[1];
  var voiceState = useState(true); var voiceEnabled = voiceState[0]; var setVoiceEnabled = voiceState[1];
  var lastStepState = useState(null); var lastAnnouncedStep = lastStepState[0]; var setLastAnnouncedStep = lastStepState[1];
  var nearDestState = useState(false); var isNearDestination = nearDestState[0]; var setIsNearDestination = nearDestState[1];
  var cancelModalState = useState(false); var showCancelModal = cancelModalState[0]; var setShowCancelModal = cancelModalState[1];
  var successModalState = useState(false); var showSuccessModal = successModalState[0]; var setShowSuccessModal = successModalState[1];
  var queueState = useState(null); var queuedRide = queueState[0]; var setQueuedRide = queueState[1];

  // Delivery photo states
  var [showPhotoModal, setShowPhotoModal] = useState(false);
  var [pendingDeliveryStatus, setPendingDeliveryStatus] = useState(null);
  var [deliveryPhoto, setDeliveryPhoto] = useState(null);

  // Wave payment verification states
  var [waveScreenshotUrl, setWaveScreenshotUrl] = useState(null);
  var [wavePaymentVerified, setWavePaymentVerified] = useState(false);
  var [waveVerifying, setWaveVerifying] = useState(false);
  var [waveScreenshotFullView, setWaveScreenshotFullView] = useState(false);
  var [waveAutoCancelMsg, setWaveAutoCancelMsg] = useState(false);
  var waveArrivedTimerRef = useRef(null);
  var isWaveRide = ride ? ride.paymentMethod === 'wave' : false;

  // Clear LRU cache on unmount
  useEffect(function(){ return function(){ directionsCacheClear(); }; },[]);

  useEffect(function(){if(!driver||!driver._id)return;createAuthSocket().then(function(sock){socketRef.current=sock;sock.on('connect',function(){sock.emit('driver-online',{driverId:driver._id,latitude:driverLocation?driverLocation.latitude:0,longitude:driverLocation?driverLocation.longitude:0});if(rideId){sock.emit('join-ride-room',rideId);}if(deliveryId){sock.emit('join-delivery-room',deliveryId);}});sock.on('new-ride-offer',function(rideData){if(ride&&ride.status==='in_progress'){setQueuedRide(rideData);Alert.alert('Nouvelle course en attente',(rideData.driverEarnings?rideData.driverEarnings.toLocaleString():'0')+' FCFA',[{text:'Refuser',style:'cancel',onPress:function(){rejectQueuedRide(rideData);}},{text:'Accepter',onPress:function(){acceptQueuedRide(rideData);}}]);}});sock.on('ride-cancelled',function(data){if(cancelledRef.current)return;driverService.getRide(rideId).then(function(res){if(res&&res.success&&res.ride&&res.ride.status==='cancelled'){cancelledRef.current=true;speakAnnouncement('Le passager a annule la course');Alert.alert('Course annulee','La course a ete annulee.',[{text:'OK',onPress:function(){navigation.replace('RideRequests');}}]);}else{console.log('Ride-cancelled event ignored, ride status:',res?.ride?.status);}}).catch(function(err){console.error('Failed to check ride status after cancellation event:',err);});});if(deliveryMode){sock.on('delivery-cancelled',function(data){if(cancelledRef.current)return;cancelledRef.current=true;speakAnnouncement('Le client a annule la livraison');Alert.alert('Livraison annulee','Le client a annule la livraison.',[{text:'OK',onPress:function(){navigation.replace('RideRequests');}}]);});}sock.on('ride-status',function(data){if(data.status==='cancelled'&&!cancelledRef.current){cancelledRef.current=true;speakAnnouncement('Le passager a annule la course');Alert.alert('Course annulee','Le passager a annule la course.',[{text:'OK',onPress:function(){navigation.replace('RideRequests');}}]);}});sock.on('wave-screenshot-uploaded',function(data){if(data&&data.screenshotUrl){setWaveScreenshotUrl(data.screenshotUrl);speakAnnouncement('Le passager a envoye une preuve de paiement Wave');}});sock.on('wave-payment-verified',function(data){setWavePaymentVerified(true);setWaveScreenshotUrl(null);});}).catch(function(err){console.log("Socket error:",err);});return function(){if(socketRef.current)socketRef.current.disconnect();};},[driver?driver._id:null,ride?ride.status:null]);

  // Check ride status when app returns to foreground
  useEffect(function() {
    var sub = AppState.addEventListener("change", function(state) {
      if (state === "active" && rideId) {
        driverService.getRide(rideId).then(function(res) {
          if (res && res.success && res.ride) {
            if (res.ride.status === "cancelled") {
              if (!cancelledRef.current) {
                cancelledRef.current = true;
                Alert.alert("Course annulee", "Le passager a annule la course.", [{ text: "OK", onPress: function() { navigation.replace("RideRequests"); } }]);
              }
            }
          }
        }).catch(function(err) { console.error('AppState ride status check failed:', err); });
      }
    });
    return function() { sub.remove(); };
  }, [rideId]);

  function acceptQueuedRide(rd){driverService.acceptRide(rd.rideId).then(function(){setQueuedRide(Object.assign({},rd,{accepted:true}));speak('Course en attente acceptee');}).catch(function(err){console.error('Failed to accept queued ride:',err);setQueuedRide(null);});}
  function rejectQueuedRide(rd){driverService.rejectRide(rd.rideId,'Occupe').then(function(){setQueuedRide(null);}).catch(function(err){console.error('Failed to reject queued ride:',err);});}

  useEffect(function(){if(passedRide){setRide({_id:rideId,status:'accepted',pickup:passedRide.pickup,dropoff:passedRide.dropoff,fare:passedRide.fare,distance:passedRide.distance,pinRequired:passedRide.pinRequired||false});}driverService.getRide(rideId).then(function(res){if(res&&res.success&&res.ride){setRide(function(prev){hasFetchedRoute.current=false;return Object.assign({},prev||{},res.ride,{status:prev?prev.status:'accepted'});});}}).catch(function(e){console.log('getRide error:',e);});},[]);

  var lastLocationRef = useRef(null);
  var lastLocationTimeRef = useRef(null);
  var currentWatchOptions = useRef({ timeInterval: 1000, distanceInterval: 5 });

  function getAdaptiveLocationOptions(speedKmh) {
    // Highway (>60 km/h): less frequent, larger distance threshold
    if (speedKmh > 60) { return { timeInterval: 3000, distanceInterval: 20 }; }
    // City/stopped (<20 km/h): frequent updates
    return { timeInterval: 1000, distanceInterval: 5 };
  }

  function calcSpeedFromLocations(prevLoc, prevTime, curLoc, curTime) {
    if (!prevLoc || !prevTime) return 0;
    var elapsed = (curTime - prevTime) / 1000;
    if (elapsed <= 0) return 0;
    var R = 6371e3;
    var p1 = prevLoc.latitude * Math.PI / 180;
    var p2 = curLoc.latitude * Math.PI / 180;
    var dp = (curLoc.latitude - prevLoc.latitude) * Math.PI / 180;
    var dl = (curLoc.longitude - prevLoc.longitude) * Math.PI / 180;
    var a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    var dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (dist / elapsed) * 3.6;
  }

  useEffect(function(){var mounted=true;function startWatcher(opts){currentWatchOptions.current=opts;Location.watchPositionAsync({accuracy:Location.Accuracy.High,timeInterval:opts.timeInterval,distanceInterval:opts.distanceInterval},function(loc){if(!mounted)return;var curLoc={latitude:loc.coords.latitude,longitude:loc.coords.longitude};var now=Date.now();var sensorSpeed=(loc.coords.speed||0)*3.6;var calculatedSpeed=calcSpeedFromLocations(lastLocationRef.current,lastLocationTimeRef.current,curLoc,now);var speedKmh=Math.max(0,Math.round(sensorSpeed>0?sensorSpeed:calculatedSpeed));lastLocationRef.current=curLoc;lastLocationTimeRef.current=now;setDriverLocation(curLoc);setHeading(loc.coords.heading||heading);setCurrentSpeed(speedKmh);driverService.updateLocation(loc.coords.latitude,loc.coords.longitude).catch(function(err){console.error('Location update API error:',err);});if(socketRef.current&&socketRef.current.connected){socketRef.current.emit('driver-location-update',{rideId:rideId,location:{latitude:loc.coords.latitude,longitude:loc.coords.longitude,heading:loc.coords.heading||0}});}var newOpts=getAdaptiveLocationOptions(speedKmh);if(newOpts.timeInterval!==currentWatchOptions.current.timeInterval||newOpts.distanceInterval!==currentWatchOptions.current.distanceInterval){if(locationSubscription.current){locationSubscription.current.remove();}startWatcher(newOpts);}}).then(function(sub){locationSubscription.current=sub;});}function startTracking(){Location.requestForegroundPermissionsAsync().then(function(result){if(result.status!=='granted'){Alert.alert('Permission refusee','Localisation requise');setInitializing(false);return;}Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High}).then(function(cur){if(mounted){setDriverLocation({latitude:cur.coords.latitude,longitude:cur.coords.longitude});setHeading(cur.coords.heading||0);lastLocationRef.current={latitude:cur.coords.latitude,longitude:cur.coords.longitude};lastLocationTimeRef.current=Date.now();setInitializing(false);}startWatcher({timeInterval:1000,distanceInterval:5});});}).catch(function(err){console.error('Location permission/init error:',err);setInitializing(false);});}startTracking();return function(){mounted=false;if(locationSubscription.current)locationSubscription.current.remove();};},[]);

  useEffect(function(){
    if(!ride||!driverLocation||hasFetchedRoute.current)return;
    var destination;
    if (deliveryMode) {
      // Delivery: navigate to pickup first, then dropoff after picked_up
      if (ride.status === 'accepted' || ride.status === 'at_pickup') {
        destination = ride.pickup ? ride.pickup.coordinates : null;
      } else {
        destination = ride.dropoff ? ride.dropoff.coordinates : null;
      }
    } else {
      destination = (ride.status==='accepted'||ride.status==='arrived') ? ride.pickup.coordinates : ride.dropoff.coordinates;
    }
    if(!destination)return;

    var cacheKey = [
      Math.round(driverLocation.latitude*1000)/1000,
      Math.round(driverLocation.longitude*1000)/1000,
      destination.latitude,
      destination.longitude,
      ride.status
    ].join('_');

    var cached = directionsCacheGet(cacheKey);
    if(cached){
      setTotalDistance(cached.totalDistance);
      setTotalDuration(cached.totalDuration);
      setAllSteps(cached.steps);
      if(cached.steps.length>0) setCurrentStep(cached.steps[0]);
      setRouteCoordinates(cached.coords);
      hasFetchedRoute.current=true;
      setTimeout(function(){if(mapRef.current&&!navigationStarted){if(cameraRef.current){var lats=cached.coords.map(function(c){return c.latitude;});var lons=cached.coords.map(function(c){return c.longitude;});cameraRef.current.fitBounds([Math.min.apply(null,lons),Math.min.apply(null,lats),Math.max.apply(null,lons),Math.max.apply(null,lats)],{top:200,right:50,bottom:400,left:50},500);};}},1000);
      return;
    }

    // Enforce minimum 5-second gap between direction requests
    var now = Date.now();
    if (now - lastDirectionsFetchTime.current < 5000) { return; }
    lastDirectionsFetchTime.current = now;

    var url='https://osrm.terango.sn/route/v1/driving/'+driverLocation.longitude+','+driverLocation.latitude+';'+destination.longitude+','+destination.latitude+'?overview=full&geometries=polyline&steps=true';

    function applyDirectionsResult(data) {
      if(data.code==='Ok'&&data.routes.length>0){
        var rt=data.routes[0];
        var leg=rt.legs[0];
        var steps=leg.steps.map(function(step,index){
          var loc=step.maneuver.location;
          var nextLoc=leg.steps[index+1]?leg.steps[index+1].maneuver.location:loc;
          return{id:index,instruction:step.maneuver.instruction||step.name||'Continuer',distance:step.distance<1000?Math.round(step.distance)+' m':(step.distance/1000).toFixed(1)+' km',distanceValue:step.distance,maneuver:step.maneuver.type,startLocation:{latitude:loc[1],longitude:loc[0]},endLocation:{latitude:nextLoc[1],longitude:nextLoc[0]}};
        });
        var coords=PolylineUtil.decode(rt.geometry).map(function(p){return{latitude:p[0],longitude:p[1]};});
        var distText=leg.distance<1000?Math.round(leg.distance)+' m':(leg.distance/1000).toFixed(1)+' km';
        var durText=leg.duration<60?Math.round(leg.duration)+' sec':Math.round(leg.duration/60)+' min';
        directionsCacheSet(cacheKey,{totalDistance:distText,totalDuration:durText,steps:steps,coords:coords});
        setTotalDistance(distText);
        setTotalDuration(durText);
        setAllSteps(steps);
        if(steps.length>0)setCurrentStep(steps[0]);
        setRouteCoordinates(coords);
        hasFetchedRoute.current=true;
        setTimeout(function(){if(mapRef.current&&!navigationStarted){if(cameraRef.current){var lats=coords.map(function(c){return c.latitude;});var lons=coords.map(function(c){return c.longitude;});cameraRef.current.fitBounds([Math.min.apply(null,lons),Math.min.apply(null,lats),Math.max.apply(null,lons),Math.max.apply(null,lats)],{top:200,right:50,bottom:400,left:50},500);};}},1000);
        return true;
      }
      return false;
    }

    function fetchWithTimeout(fetchUrl, timeoutMs) {
      var controller = new AbortController();
      var timer = setTimeout(function() { controller.abort(); }, timeoutMs);
      return fetch(fetchUrl, { signal: controller.signal })
        .then(function(r) { clearTimeout(timer); return r.json(); })
        .catch(function(err) { clearTimeout(timer); throw err; });
    }

    fetchWithTimeout(url, 10000)
      .then(function(data) {
        if (!applyDirectionsResult(data)) {
          console.warn('Directions: OSRM returned non-Ok response', data.code);
          hasFetchedRoute.current = false;
        }
      })
      .catch(function(err) {
        console.warn('Directions fetch failed (attempt 1):', err.message || err);
        // Retry once after 2 seconds
        setTimeout(function() {
          fetchWithTimeout(url, 10000)
            .then(function(data) {
              if (!applyDirectionsResult(data)) {
                console.warn('Directions: OSRM returned non-Ok on retry', data.code);
                hasFetchedRoute.current = false;
              }
            })
            .catch(function(retryErr) {
              console.error('Directions fetch failed (attempt 2):', retryErr.message || retryErr);
              hasFetchedRoute.current = false;
              setToastMessage('Itin\u00e9raire indisponible');
              setTimeout(function() { setToastMessage(null); }, 3000);
            });
        }, 2000);
      });
  },[ride,driverLocation]);

  var announceInstruction = useCallback(function(instruction){if(!voiceEnabled)return;speakNavigation(instruction);},[voiceEnabled]);
  var handleRecenter = useCallback(function(){if(mapRef.current&&driverLocation){cameraRef.current.flyTo({center:[driverLocation.longitude,driverLocation.latitude],zoom:18,pitch:navigationStarted?30:0,heading:navigationStarted?heading:0,duration:500});}},[driverLocation,heading,navigationStarted]);
  var handleForceRecalculate = useCallback(function(){lastDirectionsFetchTime.current=0;lastRerouteTime.current=0;offRouteCount.current=0;hasFetchedRoute.current=false;speakAnnouncement("Recalcul de l'itineraire");},[]);

  useEffect(function(){if(!driverLocation||!currentStep||!allSteps.length||!voiceEnabled)return;var distance=calcDistance(driverLocation.latitude,driverLocation.longitude,currentStep.endLocation.latitude,currentStep.endLocation.longitude);var stepKey='step_'+currentStep.id;if(distance<=300&&distance>250&&!announcementDistances.current.has(stepKey+'_300')){announceInstruction('Dans 300 metres, '+currentStep.instruction);announcementDistances.current.add(stepKey+'_300');}else if(distance<=100&&distance>75&&!announcementDistances.current.has(stepKey+'_100')){announceInstruction('Dans 100 metres, '+currentStep.instruction);announcementDistances.current.add(stepKey+'_100');}else if(distance<=50&&distance>30&&!announcementDistances.current.has(stepKey+'_50')){announceInstruction(currentStep.instruction);announcementDistances.current.add(stepKey+'_50');}if(currentStep.id!==lastAnnouncedStep){setLastAnnouncedStep(currentStep.id);announcementDistances.current.clear();}},[driverLocation,currentStep,allSteps,voiceEnabled,announceInstruction,lastAnnouncedStep]);

  var toggleVoice = useCallback(function(){var ns=!voiceEnabled;setVoiceEnabled(ns);speak(ns?"Navigation vocale activee":"Navigation vocale desactivee");},[voiceEnabled]);

  useEffect(function(){
    if(!driverLocation||!currentStep||!allSteps.length)return;
    var distance=calcDistance(driverLocation.latitude,driverLocation.longitude,currentStep.endLocation.latitude,currentStep.endLocation.longitude);
    setDistanceToStep(formatDistance(distance));
    if(distance<50&&currentStep.id<allSteps.length-1){setCurrentStep(allSteps[currentStep.id+1]);}

    var destination;
    if (deliveryMode) {
      if (ride.status === 'accepted' || ride.status === 'at_pickup') {
        destination = ride.pickup ? ride.pickup.coordinates : null;
      } else {
        destination = ride.dropoff ? ride.dropoff.coordinates : null;
      }
    } else {
      destination = (ride.status==='accepted'||ride.status==='arrived') ? ride.pickup.coordinates : ride.dropoff.coordinates;
    }
    if(destination){
      var distToDest=calcDistance(driverLocation.latitude,driverLocation.longitude,destination.latitude,destination.longitude);
      // Hysteresis: appear at 50m, disappear only beyond 75m
      if (isNearDestRef.current) {
        // Already near: only hide if moved beyond disappear threshold
        if (distToDest > ARRIVAL_DISAPPEAR_THRESHOLD) {
          isNearDestRef.current = false;
          hapticFiredRef.current = false;
          setIsNearDestination(false);
        }
      } else {
        // Not near yet: show only when within appear threshold
        if (distToDest <= ARRIVAL_APPEAR_THRESHOLD) {
          isNearDestRef.current = true;
          setIsNearDestination(true);
          // Haptic feedback when button first appears
          if (!hapticFiredRef.current) {
            hapticFiredRef.current = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(function(e) { console.warn('Haptics error:', e); });
          }
        }
      }
    }

    // Calculate route progress (only every 5 seconds)
    var progressNow = Date.now();
    if (routeCoordinates.length > 0 && progressNow - lastProgressCalcTime.current > 5000) {
      lastProgressCalcTime.current = progressNow;
      var closestIdx = 0;
      var closestDist = Infinity;
      for (var pi = 0; pi < routeCoordinates.length; pi += 3) {
        var pd = calcDistance(driverLocation.latitude, driverLocation.longitude, routeCoordinates[pi].latitude, routeCoordinates[pi].longitude);
        if (pd < closestDist) { closestDist = pd; closestIdx = pi; }
      }
      var newProgress = Math.min(closestIdx / routeCoordinates.length, 1);
      if (Math.abs(newProgress - lastProgress.current) > 0.02) { lastProgress.current = newProgress; setRouteProgress(newProgress); }
    }

    // Off-route detection
    if (routeCoordinates.length > 0 && navigationStarted) {
      var minDistToRoute = Infinity;
      for (var ri = 0; ri < routeCoordinates.length; ri += 5) {
        var d = calcDistance(driverLocation.latitude, driverLocation.longitude, routeCoordinates[ri].latitude, routeCoordinates[ri].longitude);
        if (d < minDistToRoute) minDistToRoute = d;
      }
      if (minDistToRoute > 100) {
        offRouteCount.current++;
        if (offRouteCount.current >= 2 && Date.now() - lastRerouteTime.current > 15000) {
          lastRerouteTime.current = Date.now();
          offRouteCount.current = 0;
          hasFetchedRoute.current = false;
          speakAnnouncement("Recalcul de l'itineraire");
        }
      } else { offRouteCount.current = 0; }
    }
  },[driverLocation,currentStep,allSteps,ride]);

  // Periodic reroute check every 2 minutes during navigation for traffic changes
  var trafficRerouteInterval = useRef(null);
  useEffect(function(){
    if (navigationStarted) {
      trafficRerouteInterval.current = setInterval(function(){
        hasFetchedRoute.current = false;
        // Clear cache for current route to get fresh traffic data
        directionsCacheDeleteMatching(ride.status);
      }, 120000); // every 2 minutes
    } else {
      if (trafficRerouteInterval.current) { clearInterval(trafficRerouteInterval.current); trafficRerouteInterval.current = null; }
    }
    return function(){ if (trafficRerouteInterval.current) clearInterval(trafficRerouteInterval.current); };
  },[navigationStarted]);

  function calcDistance(lat1,lon1,lat2,lon2){var R=6371e3;var p1=lat1*Math.PI/180;var p2=lat2*Math.PI/180;var dp=(lat2-lat1)*Math.PI/180;var dl=(lon2-lon1)*Math.PI/180;var a=Math.sin(dp/2)*Math.sin(dp/2)+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)*Math.sin(dl/2);return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
  function formatDistance(m){if(m<1000)return Math.round(m)+' m';return(m/1000).toFixed(1)+' km';}
  function getManeuverIcon(m){if(!m)return '^';if(m.indexOf('left')!==-1)return '<';if(m.indexOf('right')!==-1)return '>';if(m.indexOf('uturn')!==-1)return 'U';return '^';}

  useEffect(function(){if(!navigationStarted||!mapRef.current||!driverLocation)return;var now=Date.now();if(now-lastCameraUpdateTime.current<2000)return;var headingDiff=Math.abs(heading-lastCameraHeading.current);if(headingDiff>180)headingDiff=360-headingDiff;if(headingDiff<10&&now-lastCameraUpdateTime.current<2000)return;lastCameraUpdateTime.current=now;lastCameraHeading.current=heading;cameraRef.current.flyTo({center:[driverLocation.longitude,driverLocation.latitude],zoom:18,pitch:30,heading:heading,duration:500});},[driverLocation,navigationStarted,heading]);
  var handleStartNavigation = useCallback(function(){setNavigationStarted(true);if(mapRef.current&&driverLocation){cameraRef.current.flyTo({center:[driverLocation.longitude,driverLocation.latitude],zoom:18,pitch:30,heading:heading,duration:1000});}},[driverLocation,heading]);
  function handleCancelRide(){setShowCancelModal(true);}
  function handleConfirmCancel(reason){setShowCancelModal(false);setLoading(true);var p=deliveryMode?driverService.cancelDelivery(deliveryId,reason):driverService.cancelRide(rideId,reason);p.then(function(){}).catch(function(err){console.error('Cancel ride/delivery error:',err);Alert.alert('Erreur',"Impossible d'annuler");}).finally(function(){setLoading(false);});}
  function handleContactSupport(){Alert.alert('Contacter le Support','Choisissez',[{text:'Annuler',style:'cancel'},{text:'Appeler',onPress:function(){Linking.openURL('tel:+221338234567');}},{text:'WhatsApp',onPress:function(){Linking.openURL('https://wa.me/221778234567');}}]);}
  var handleArrived = useCallback(function(){setLoading(true);driverService.updateRideStatus(rideId,'arrived').then(function(){setRide(function(prev){return Object.assign({},prev,{status:'arrived'});});hasFetchedRoute.current=false;setNavigationStarted(false);speakAnnouncement("Vous etes arrive au point de depart");}).catch(function(e){Alert.alert('Erreur',(e.response&&e.response.data&&e.response.data.message)||'Erreur');}).finally(function(){setLoading(false);});},[rideId]);
  var handleVerifyPin = useCallback(function(){
    if(pinInput.length !== 4){setPinError('Entrez 4 chiffres');return;}
    setLoading(true);setPinError('');
    driverService.verifyPin(rideId, pinInput).then(function(){
      setPinVerified(true);setShowPinModal(false);setPinInput('');
      setLoading(true);driverService.startRide(rideId).then(function(){setRide(function(prev){return Object.assign({},prev,{status:'in_progress'});});hasFetchedRoute.current=false;setNavigationStarted(false);speakAnnouncement('Course demarree. Bonne route!');}).catch(function(err){console.error('Start ride error:',err);Alert.alert('Erreur',"Impossible de demarrer");}).finally(function(){setLoading(false);});
    }).catch(function(e){setPinError('Code incorrect');setLoading(false);});
  },[rideId,pinInput]);
  var handleStartRide = useCallback(function(){
    if(ride && ride.pinRequired && !pinVerified){setShowPinModal(true);return;}
    setLoading(true);driverService.startRide(rideId).then(function(){setRide(function(prev){return Object.assign({},prev,{status:'in_progress'});});hasFetchedRoute.current=false;setNavigationStarted(false);speakAnnouncement('Course demarree. Bonne route!');}).catch(function(err){console.error('Start ride error:',err);Alert.alert('Erreur',"Impossible de demarrer");}).finally(function(){setLoading(false);});},[rideId,ride,pinVerified]);
  var handleCompleteRide = useCallback(function(){setLoading(true);driverService.completeRide(rideId).then(function(){speakAnnouncement('Course terminee. Le passager a paye '+(ride.fare||0)+' francs. Commission TeranGO '+(ride.platformCommission||0)+' francs. Vos gains '+(ride.driverEarnings||ride.fare||0)+' francs.');if(queuedRide&&queuedRide.accepted){Alert.alert('Course terminee!','Tarif passager: '+(ride.fare?ride.fare.toLocaleString():'0')+' FCFA\nCommission TeranGO (5%): '+(ride.platformCommission?ride.platformCommission.toLocaleString():'0')+' FCFA\nVos gains: '+(ride.driverEarnings?ride.driverEarnings.toLocaleString():'0')+' FCFA\n\nCourse en attente.',[{text:'Commencer',onPress:function(){navigation.replace('ActiveRide',{rideId:queuedRide.rideId,ride:queuedRide});}}]);}else{Alert.alert('Course terminee!','Tarif passager: '+(ride.fare?ride.fare.toLocaleString():'0')+' FCFA\nCommission TeranGO (5%): '+(ride.platformCommission?ride.platformCommission.toLocaleString():'0')+' FCFA\n\nVos gains: '+(ride.driverEarnings?ride.driverEarnings.toLocaleString():'0')+' FCFA',[{text:'OK',onPress:function(){navigation.replace('RideRequests');}}]);}}).catch(function(err){console.error('Complete ride error:',err);Alert.alert('Erreur','Impossible de terminer');}).finally(function(){setLoading(false);});},[rideId,ride,navigation,queuedRide]);

  // ========== DELIVERY PHOTO FUNCTIONS ==========
  var takeDeliveryPhoto = function() {
    ImagePicker.requestCameraPermissionsAsync().then(function(perm) {
      if (perm.status !== 'granted') { Alert.alert('Permission requise', 'Activez la camera'); return; }
      ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.7, maxWidth: 1200 }).then(function(result) {
        if (!result.canceled) {
          setDeliveryPhoto(result.assets[0].uri);
        }
      });
    });
  };

  var confirmDeliveryStatus = function() {
    if (!deliveryPhoto) { Alert.alert('Photo requise', 'Prenez une photo avant de confirmer'); return; }
    setLoading(true);
    deliveryService.updateDeliveryStatus(deliveryId, pendingDeliveryStatus, deliveryPhoto).then(function() {
      setRide(function(prev) { return Object.assign({}, prev, { status: pendingDeliveryStatus }); });
      hasFetchedRoute.current = false;
      setNavigationStarted(false);
      setShowPhotoModal(false);
      setDeliveryPhoto(null);
      setPendingDeliveryStatus(null);
      if (pendingDeliveryStatus === 'delivered') {
        speakAnnouncement('Livraison terminee');
        Alert.alert('Livraison terminee!', 'Gains: ' + (ride.fare ? ride.fare.toLocaleString() : '0') + ' FCFA', [{ text: 'OK', onPress: function() { navigation.replace('RideRequests'); } }]);
      } else if (pendingDeliveryStatus === 'picked_up') {
        speakAnnouncement('Colis recupere. En route vers la destination.');
      }
    }).catch(function(err) { console.error('Delivery status update error:', err); Alert.alert('Erreur', 'Impossible de mettre a jour'); }).finally(function() { setLoading(false); });
  };

  var handleDeliveryAction = function(status) {
    if (status === 'picked_up' || status === 'delivered') {
      setPendingDeliveryStatus(status);
      setDeliveryPhoto(null);
      setShowPhotoModal(true);
    } else {
      setLoading(true);
      deliveryService.updateDeliveryStatus(deliveryId, status).then(function() {
        setRide(function(prev) { return Object.assign({}, prev, { status: status }); });
        hasFetchedRoute.current = false;
        setNavigationStarted(false);
        if (status === 'at_pickup') speakAnnouncement('Arrive au point de retrait');
        if (status === 'at_dropoff') speakAnnouncement('Arrive au point de livraison');
      }).catch(function(err) { console.error('Delivery status update error:', err); Alert.alert('Erreur', 'Impossible de mettre a jour'); }).finally(function() { setLoading(false); });
    }
  };

  // Wave payment: 10-minute auto-cancel timer when arrived + wave
  useEffect(function() {
    if (ride && ride.status === 'arrived' && ride.paymentMethod === 'wave' && !wavePaymentVerified) {
      waveArrivedTimerRef.current = setTimeout(function() {
        setWaveAutoCancelMsg(true);
      }, 10 * 60 * 1000);
    } else {
      if (waveArrivedTimerRef.current) { clearTimeout(waveArrivedTimerRef.current); waveArrivedTimerRef.current = null; }
      setWaveAutoCancelMsg(false);
    }
    return function() { if (waveArrivedTimerRef.current) clearTimeout(waveArrivedTimerRef.current); };
  }, [ride ? ride.status : null, ride ? ride.paymentMethod : null, wavePaymentVerified]);

  var handleVerifyWavePayment = useCallback(function() {
    setWaveVerifying(true);
    driverService.verifyWavePayment(rideId).then(function() {
      setWavePaymentVerified(true);
      setWaveScreenshotUrl(null);
      speakAnnouncement('Paiement Wave verifie. Vous pouvez demarrer la course.');
    }).catch(function(err) {
      console.error('Verify wave payment error:', err);
      Alert.alert('Erreur', 'Impossible de verifier le paiement');
    }).finally(function() { setWaveVerifying(false); });
  }, [rideId]);

  var handleRejectWavePayment = useCallback(function() {
    Alert.alert('Paiement invalide', 'Le passager sera notifie de renvoyer la preuve', [{ text: 'OK' }]);
    setWaveScreenshotUrl(null);
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('wave-payment-rejected', { rideId: rideId });
    }
  }, [rideId]);

  if(initializing||!driverLocation||!ride){return(<View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.green}/><Text style={styles.loadingText}>Chargement...</Text></View>);}

  var destination;
  if (deliveryMode) {
    if (ride.status === 'accepted' || ride.status === 'at_pickup') {
      destination = ride.pickup ? ride.pickup.coordinates : null;
    } else {
      destination = ride.dropoff ? ride.dropoff.coordinates : null;
    }
  } else {
    destination = (ride.status==='accepted'||ride.status==='arrived') ? (ride.pickup?ride.pickup.coordinates:null) : (ride.dropoff?ride.dropoff.coordinates:null);
  }

  function getStatusText(){
    if (deliveryMode) {
      switch(ride.status){
        case 'accepted': return 'En route vers le retrait';
        case 'at_pickup': return 'Au point de retrait';
        case 'picked_up': return 'En route vers la livraison';
        case 'at_dropoff': return 'Au point de livraison';
        default: return '';
      }
    }
    switch(ride.status){case 'accepted':return 'En route vers le passager';case 'arrived':return 'En attente du passager';case 'in_progress':return 'Course en cours';default:return '';}
  }

  function getActionButton(){
    // ===== DELIVERY MODE =====
    if (deliveryMode) {
      switch(ride.status) {
        case 'accepted':
          return (<View>
            {!navigationStarted && <TouchableOpacity style={styles.navButton} onPress={handleStartNavigation}><Text style={styles.navIcon}>{String.fromCodePoint(0x1F4E6)}</Text><Text style={styles.navText}>{'Naviguer vers le retrait'}</Text></TouchableOpacity>}
            {isNearDestination ? <GlassButton title="Arrive au point de retrait" onPress={function(){handleDeliveryAction('at_pickup');}} loading={loading}/> : <View style={styles.proximityHint}><Text style={styles.proximityText}>{"Le bouton apparaitra a 50m du retrait"}</Text></View>}
          </View>);
        case 'at_pickup':
          return <GlassButton title={String.fromCodePoint(0x1F4F7) + " Colis recupere - Prendre photo"} onPress={function(){handleDeliveryAction('picked_up');}} loading={loading}/>;
        case 'picked_up':
          return (<View>
            {!navigationStarted && <TouchableOpacity style={styles.navButton} onPress={handleStartNavigation}><Text style={styles.navIcon}>{String.fromCodePoint(0x1F9ED)}</Text><Text style={styles.navText}>{'Naviguer vers la livraison'}</Text></TouchableOpacity>}
            {isNearDestination ? <GlassButton title="Arrive au point de livraison" onPress={function(){handleDeliveryAction('at_dropoff');}} loading={loading}/> : <View style={styles.proximityHint}><Text style={styles.proximityText}>{"Le bouton apparaitra a 50m de la livraison"}</Text></View>}
          </View>);
        case 'at_dropoff':
          return <GlassButton title={String.fromCodePoint(0x1F4F7) + " Confirmer livraison - Photo"} onPress={function(){handleDeliveryAction('delivered');}} loading={loading}/>;
        default: return null;
      }
    }

    // ===== RIDE MODE =====
    switch(ride.status){
      case 'accepted':return(<View>{!navigationStarted&&<TouchableOpacity style={styles.navButton} onPress={handleStartNavigation}><Text style={styles.navIcon}>{"\uD83E\uDDED"}</Text><Text style={styles.navText}>{"Demarrer navigation"}</Text></TouchableOpacity>}{isNearDestination?<GlassButton title="Je suis arrive" onPress={handleArrived} loading={loading}/>:<View style={styles.proximityHint}><Text style={styles.proximityText}>{"Le bouton apparaitra a 50m du client"}</Text></View>}</View>);
      case 'arrived':
        // Wave payment: block start until verified
        if (ride.paymentMethod === 'wave' && !wavePaymentVerified) {
          return (<View>
            {waveAutoCancelMsg && <View style={waveStyles.autoCancelBanner}><Text style={waveStyles.autoCancelText}>{"Le passager n'a pas pay\u00e9. La course sera annul\u00e9e automatiquement."}</Text></View>}
            {!waveScreenshotUrl && <View style={waveStyles.waitingCard}><ActivityIndicator size="small" color="#1DC3E1" style={{marginBottom:8}}/><Text style={waveStyles.waitingText}>{"En attente du paiement Wave du passager..."}</Text></View>}
            {waveScreenshotUrl && <View style={waveStyles.proofCard}>
              <Text style={waveStyles.proofTitle}>{"Le passager a envoy\u00e9 une preuve de paiement"}</Text>
              <TouchableOpacity onPress={function(){setWaveScreenshotFullView(true);}} activeOpacity={0.8}>
                <Image source={{uri:waveScreenshotUrl}} style={waveStyles.screenshotImage} resizeMode="contain"/>
              </TouchableOpacity>
              <Text style={waveStyles.amountText}>{(ride.fare ? ride.fare.toLocaleString() : '0') + ' FCFA'}</Text>
              <View style={waveStyles.proofActions}>
                <TouchableOpacity style={waveStyles.rejectBtn} onPress={handleRejectWavePayment}><Text style={waveStyles.rejectBtnText}>{String.fromCodePoint(0x2717) + " Paiement invalide"}</Text></TouchableOpacity>
                <TouchableOpacity style={waveStyles.verifyBtn} onPress={handleVerifyWavePayment} disabled={waveVerifying}>{waveVerifying ? <ActivityIndicator color="#FFF" size="small"/> : <Text style={waveStyles.verifyBtnText}>{String.fromCodePoint(0x2713) + " Paiement v\u00e9rifi\u00e9"}</Text>}</TouchableOpacity>
              </View>
            </View>}
            <View style={waveStyles.disabledStartBtn}><Text style={waveStyles.disabledStartText}>En attente du paiement</Text></View>
          </View>);
        }
        return <GlassButton title="Demarrer la course" onPress={handleStartRide} loading={loading}/>;
      case 'in_progress':return(<View>{!navigationStarted&&<TouchableOpacity style={styles.navButton} onPress={handleStartNavigation}><Text style={styles.navIcon}>{String.fromCodePoint(0x1F9ED)}</Text><Text style={styles.navText}>{"Naviguer vers la destination"}</Text></TouchableOpacity>}{isNearDestination?<GlassButton title="Terminer la course" onPress={handleCompleteRide} loading={loading}/>:<View style={styles.proximityHint}><Text style={styles.proximityText}>{"Le bouton apparaitra a 50m de la destination"}</Text></View>}</View>);
      default:return null;
    }
  }

  return (
    <View style={styles.container}>
      <Map ref={mapRef} style={styles.map} mapStyle={TERANGO_STYLE} logo={false} attribution={false} rotateEnabled={navigationStarted} pitchEnabled={navigationStarted}>
        <Camera ref={cameraRef} center={[driverLocation.longitude, driverLocation.latitude]} zoom={16} />
        <Marker id="driverPos" lngLat={[driverLocation.longitude, driverLocation.latitude]}>
          <View style={styles.driverMarkerOuter}>
            <View style={styles.driverMarkerShadow} />
            <View style={styles.driverMarkerArrow}>
              <View style={styles.driverArrowTop} />
              <View style={styles.driverArrowBottom} />
            </View>
            <View style={styles.driverMarkerDot} />
          </View>
        </Marker>
        {destination && (
          <Marker id="destination" lngLat={[destination.longitude, destination.latitude]}>
            <View style={ride.status==="in_progress"||ride.status==="picked_up"||ride.status==="at_dropoff" ? styles.dropoffMarker : styles.pickupMarker}>
              <View style={ride.status==="in_progress"||ride.status==="picked_up"||ride.status==="at_dropoff" ? styles.dropoffDot : styles.pickupDot} />
            </View>
          </Marker>
        )}
        {routeCoordinates.length > 0 && (
          <GeoJSONSource id="routeSource" data={{ type: "Feature", geometry: { type: "LineString", coordinates: routeCoordinates.map(function(c){return [c.longitude,c.latitude];}) } }}>
            <Layer type="line" id="routeShadow" paint={{ "line-color": "#4285F4", "line-width": 14, "line-opacity": 0.3  }} layout={{ "line-cap": "round", "line-join": "round" }} />
            <Layer type="line" id="routeLine" paint={{ "line-color": "#4285F4", "line-width": 6  }} layout={{ "line-cap": "round", "line-join": "round" }} />
          </GeoJSONSource>
        )}
      </Map>
      <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}><Text style={styles.recenterIcon}>{"O"}</Text></TouchableOpacity>
      {navigationStarted&&<TouchableOpacity style={styles.recalculateButton} onPress={handleForceRecalculate}><Text style={styles.recalculateText}>Recalculer</Text></TouchableOpacity>}
      {navigationStarted&&(ride.status==='accepted'||ride.status==='arrived'||ride.status==='in_progress'||ride.status==='at_pickup'||ride.status==='picked_up'||ride.status==='at_dropoff')&&<TouchableOpacity style={styles.floatingChatBtn} onPress={function(){setShowChat(true);}}><Text style={styles.floatingChatIcon}>{String.fromCodePoint(0x1F4AC)}</Text></TouchableOpacity>}
      {toastMessage&&<View style={styles.toastContainer}><Text style={styles.toastText}>{toastMessage}</Text></View>}
      {queuedRide&&queuedRide.accepted&&<View style={queueStyles.bannerContainer}><QueuedRideBanner queuedRide={queuedRide} onView={function(){}}/></View>}
      {navigationStarted&&currentStep&&(<View style={styles.turnInstruction}><View style={styles.turnIconContainer}><Text style={styles.turnIcon}>{getManeuverIcon(currentStep.maneuver)}</Text></View><View style={styles.turnTextContainer}><Text style={styles.turnDistance}>{distanceToStep}</Text><Text style={styles.turnText} numberOfLines={2}>{currentStep.instruction}</Text></View></View>)}
      <View style={styles.topBar}>{!navigationStarted&&<TouchableOpacity style={styles.cancelButton} onPress={handleCancelRide}><Text style={styles.cancelIcon}>{"X"}</Text></TouchableOpacity>}{navigationStarted&&<TouchableOpacity style={styles.voiceButton} onPress={toggleVoice}><Text style={styles.voiceIcon}>{voiceEnabled?'\uD83D\uDD0A':'\uD83D\uDD07'}</Text></TouchableOpacity>}{!navigationStarted&&<View style={styles.statusBadge}><Text style={styles.statusText}>{getStatusText()}</Text></View>}</View>
      {navigationStarted&&(<><View style={styles.progressBarFloat}><View style={styles.progressBarTrack}><View style={[styles.progressBarFill, {width: (routeProgress * 100) + '%'}]} /><View style={[styles.progressBarDot, {left: (routeProgress * 100) + '%'}]} /></View><View style={styles.progressBarLabels}><Text style={styles.progressBarEta}>{totalDistance}</Text><Text style={styles.progressBarArrival}>{totalDuration}</Text></View></View><View style={styles.wazeBottomBar}><View style={styles.etaContainer}><Text style={styles.etaTime}>{totalDuration}</Text><Text style={styles.etaDistance}>{totalDistance}</Text></View><View style={styles.speedBubble}><Text style={styles.speedText}>{currentSpeed}</Text><Text style={styles.speedUnit}>km/h</Text></View><TouchableOpacity style={styles.stopNavButton} onPress={function(){setNavigationStarted(false);if(mapRef.current){cameraRef.current.flyTo({pitch:0,zoom:15,duration:500});}}}><Text style={styles.stopNavText}>{String.fromCodePoint(0x1F5FA)}</Text></TouchableOpacity></View></>)}
      {!navigationStarted&&(<View style={styles.bottomSheet}>
        <View style={styles.etaCard}><View style={styles.etaRow}><View style={styles.etaItem}><Text style={styles.etaValue}>{totalDuration}</Text><Text style={styles.etaLabel}>Temps</Text></View><View style={styles.etaDivider}/><View style={styles.etaItem}><Text style={styles.etaValue}>{totalDistance}</Text><Text style={styles.etaLabel}>Distance</Text></View></View></View>
        <View style={styles.addressCard}><View style={styles.addressRow}><View style={deliveryMode?(ride.status==='picked_up'||ride.status==='at_dropoff'?styles.redSquare:styles.greenDot):(ride.status==='in_progress'?styles.redSquare:styles.greenDot)}/><View style={styles.addressTextContainer}><Text style={styles.addressLabel}>{deliveryMode?(ride.status==='picked_up'||ride.status==='at_dropoff'?'Livraison':'Point de retrait'):(ride.status==='in_progress'?'Destination':'Point de depart')}</Text><Text style={styles.addressText} numberOfLines={2}>{deliveryMode?(ride.status==='picked_up'||ride.status==='at_dropoff'?(ride.dropoff?ride.dropoff.address:''):(ride.pickup?ride.pickup.address:'')):(ride.status==='in_progress'?(ride.dropoff?ride.dropoff.address:''):(ride.pickup?ride.pickup.address:''))}</Text></View></View></View>
        <View style={styles.chatButtonRow}><TouchableOpacity style={styles.chatBtn} onPress={function(){setShowChat(true);}}><Text style={styles.chatBtnIcon}>{String.fromCodePoint(0x1F4AC)}</Text><Text style={styles.chatBtnText}>Message</Text></TouchableOpacity>{ride&&ride.rider&&ride.rider.phone&&<TouchableOpacity style={styles.callBtn} onPress={function(){Linking.openURL('tel:'+ride.rider.phone);}}><Text style={styles.chatBtnIcon}>{String.fromCodePoint(0x1F4DE)}</Text><Text style={styles.chatBtnText}>Appeler</Text></TouchableOpacity>}</View>
        <View style={styles.actionContainer}>{getActionButton()}</View>
      </View>)}

      {/* ===== DELIVERY PHOTO MODAL ===== */}
      <Modal visible={showPhotoModal} transparent animationType='slide'>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.85)',justifyContent:'flex-end'}}>
          <View style={{backgroundColor:COLORS.darkCard,borderTopLeftRadius:24,borderTopRightRadius:24,padding:24}}>
            <Text style={{fontSize:22,fontFamily:'LexendDeca_700Bold',color:COLORS.textLight,textAlign:'center',marginBottom:8}}>
              {pendingDeliveryStatus==='picked_up' ? String.fromCodePoint(0x1F4E6)+' Photo du colis' : String.fromCodePoint(0x2705)+' Preuve de livraison'}
            </Text>
            <Text style={{fontSize:14,fontFamily:'LexendDeca_400Regular',color:COLORS.textLightSub,textAlign:'center',marginBottom:20}}>
              {pendingDeliveryStatus==='picked_up' ? 'Prenez une photo du colis avant de partir' : 'Prenez une photo comme preuve de livraison'}
            </Text>
            {deliveryPhoto ? (
              <View>
                <Image source={{uri:deliveryPhoto}} style={{width:'100%',height:250,borderRadius:16,marginBottom:16}} />
                <TouchableOpacity onPress={takeDeliveryPhoto} style={{alignItems:'center',marginBottom:12}}>
                  <Text style={{color:COLORS.green,fontFamily:'LexendDeca_600SemiBold',fontSize:15}}>Reprendre la photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={takeDeliveryPhoto} style={{width:'100%',height:200,borderRadius:16,borderWidth:2,borderStyle:'dashed',borderColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center',marginBottom:16}}>
                <Text style={{fontSize:48}}>{String.fromCodePoint(0x1F4F7)}</Text>
                <Text style={{color:COLORS.textLightSub,fontFamily:'LexendDeca_400Regular',marginTop:8}}>Appuyez pour prendre une photo</Text>
              </TouchableOpacity>
            )}
            <View style={{flexDirection:'row',gap:12}}>
              <TouchableOpacity onPress={function(){setShowPhotoModal(false);setDeliveryPhoto(null);setPendingDeliveryStatus(null);}} style={{flex:1,padding:16,backgroundColor:'rgba(255,255,255,0.08)',borderRadius:14,alignItems:'center'}}>
                <Text style={{color:COLORS.textLightSub,fontFamily:'LexendDeca_600SemiBold',fontSize:16}}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDeliveryStatus} style={{flex:1,padding:16,backgroundColor:COLORS.green,borderRadius:14,alignItems:'center',opacity:deliveryPhoto?1:0.4}} disabled={!deliveryPhoto}>
                {loading ? <ActivityIndicator color='#FFF'/> : <Text style={{color:'#FFF',fontFamily:'LexendDeca_700Bold',fontSize:16}}>Confirmer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showChat} animationType="slide" onRequestClose={function(){setShowChat(false);}}><ChatScreen socket={socketRef.current} rideId={deliveryMode?null:rideId} deliveryId={deliveryMode?deliveryId:null} myRole="driver" myUserId={auth.user?auth.user._id:null} otherName={ride&&ride.rider?ride.rider.name:'Passager'} onClose={function(){setShowChat(false);}}/></Modal>
      <CancelReasonModal visible={showCancelModal} onClose={function(){setShowCancelModal(false);}} onConfirm={handleConfirmCancel} onSupport={handleContactSupport}/>
      {showPinModal && <Modal transparent animationType='fade' visible={showPinModal} onRequestClose={function(){setShowPinModal(false);}}>
        <View style={styles.pinOverlay}>
          <View style={styles.pinModal}>
            <Text style={styles.pinModalIcon}>{'\uD83D\uDD12'}</Text>
            <Text style={styles.pinModalTitle}>{'Code de s\u00e9curit\u00e9'}</Text>
            <Text style={styles.pinModalSub}>Demandez le code au passager</Text>
            <TextInput style={styles.pinModalInput} value={pinInput} onChangeText={function(t){setPinInput(t.replace(/[^0-9]/g,'').slice(0,4));setPinError('');}} keyboardType='number-pad' maxLength={4} placeholder='_ _ _ _' placeholderTextColor='#999' autoFocus={true} />
            {pinError ? <Text style={styles.pinModalError}>{pinError}</Text> : null}
            <TouchableOpacity style={styles.pinModalBtn} onPress={handleVerifyPin}><Text style={styles.pinModalBtnText}>{'V\u00e9rifier'}</Text></TouchableOpacity>
            <TouchableOpacity onPress={function(){setShowPinModal(false);setPinInput('');setPinError('');}}><Text style={styles.pinModalCancel}>Annuler</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>}
      <SuccessModal visible={showSuccessModal} title="Course annulee" message="La course a ete annulee" onClose={function(){setShowSuccessModal(false);navigation.replace('RideRequests');}}/>
      {/* Wave screenshot fullscreen modal */}
      <Modal visible={waveScreenshotFullView} transparent animationType="fade" onRequestClose={function(){setWaveScreenshotFullView(false);}}>
        <TouchableOpacity style={waveStyles.fullscreenOverlay} activeOpacity={1} onPress={function(){setWaveScreenshotFullView(false);}}>
          <Image source={{uri:waveScreenshotUrl}} style={waveStyles.fullscreenImage} resizeMode="contain"/>
          <Text style={waveStyles.fullscreenHint}>Appuyez pour fermer</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

var queueStyles = StyleSheet.create({
  bannerContainer: { position: 'absolute', top: 130, left: 20, right: 20 },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.yellow, borderRadius: 12, padding: 12, elevation: 4 },
  iconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 20, fontFamily: 'LexendDeca_400Regular' },
  textContainer: { flex: 1 },
  title: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  subtitle: { fontSize: 12, color: 'rgba(0,0,0,0.6)', fontFamily: 'LexendDeca_400Regular' },
  arrow: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
});

var cancelStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 24, width: '100%', maxHeight: '80%', borderWidth: 1, borderColor: COLORS.darkCardBorder },
  title: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textLightMuted, marginBottom: 20, fontFamily: 'LexendDeca_400Regular' },
  reasonsList: { maxHeight: 300, marginBottom: 20 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, marginBottom: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  reasonItemSelected: { backgroundColor: 'rgba(212,175,55,0.1)', borderColor: COLORS.yellow, borderWidth: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.textLightMuted, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.yellow },
  reasonText: { flex: 1, fontSize: 16, color: COLORS.textLight, fontFamily: 'LexendDeca_500Medium' },
  actions: { gap: 12 },
  supportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  supportIcon: { fontSize: 20, marginRight: 8, fontFamily: 'LexendDeca_400Regular' },
  supportText: { fontSize: 16, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLight },
  mainActions: { flexDirection: 'row', gap: 12 },
  backButton: { flex: 1, padding: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backButtonText: { fontSize: 16, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightSub },
  confirmButton: { flex: 2, padding: 16, backgroundColor: '#FF3B30', borderRadius: 12, alignItems: 'center' },
  confirmButtonDisabled: { opacity: 0.4 },
  confirmButtonText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF' },
});

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 16, fontSize: 16, color: COLORS.textDarkSub, fontFamily: 'LexendDeca_400Regular' },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  driverMarkerOuter: { width: 70, height: 70, alignItems: 'center', justifyContent: 'center' },
  driverMarkerShadow: { position: 'absolute', bottom: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.25)' },
  driverMarkerArrow: { width: 56, height: 56, alignItems: 'center' },
  driverArrowTop: { width: 0, height: 0, borderLeftWidth: 22, borderRightWidth: 22, borderBottomWidth: 40, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#D4AF37' },
  driverArrowBottom: { width: 0, height: 0, borderLeftWidth: 14, borderRightWidth: 14, borderTopWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#D4A900', marginTop: -6 },
  driverMarkerDot: { position: 'absolute', top: 24, width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#D4AF37' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  cancelButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  cancelIcon: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontFamily: 'LexendDeca_600SemiBold' },
  voiceButton: { position: 'absolute', top: 130, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.backgroundWhite, alignItems: 'center', justifyContent: 'center', elevation: 8, borderWidth: 1, borderColor: COLORS.grayLight },
  voiceIcon: { fontSize: 24, fontFamily: 'LexendDeca_400Regular' },
  floatingChatBtn: { position: 'absolute', bottom: 300, right: 76, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(30,30,40,0.85)', alignItems: 'center', justifyContent: 'center', elevation: 8, borderWidth: 1, borderColor: 'rgba(66,133,244,0.4)' },
  floatingChatIcon: { fontSize: 22 },
  recenterButton: { position: 'absolute', bottom: 300, right: 20, width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.backgroundWhite, alignItems: 'center', justifyContent: 'center', elevation: 8, borderWidth: 1, borderColor: COLORS.grayLight },
  recalculateButton: { position: 'absolute', bottom: 300, left: 20, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: COLORS.backgroundWhite, alignItems: 'center', justifyContent: 'center', elevation: 8, borderWidth: 1, borderColor: COLORS.grayLight },
  recalculateText: { fontSize: 13, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.darkBg },
  toastContainer: { position: 'absolute', top: 120, left: 40, right: 40, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', zIndex: 999 },
  toastText: { fontSize: 14, fontFamily: 'LexendDeca_500Medium', color: '#FFFFFF' },
  recenterIcon: { fontSize: 28, color: COLORS.green, fontFamily: 'LexendDeca_700Bold' },
  statusBadge: { backgroundColor: COLORS.darkCard, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, elevation: 8, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  statusText: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight },
  turnInstruction: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', backgroundColor: 'rgba(212,175,55,0.7)', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, padding: 14, paddingTop: 16, alignItems: 'center', elevation: 10, borderBottomWidth: 1.5, borderBottomColor: 'rgba(212,175,55,0.5)' },
  turnIconContainer: { width: 50, height: 50, borderRadius: 10, backgroundColor: 'rgba(212,175,55,0.5)', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  turnIcon: { fontSize: 32, color: '#fff', fontFamily: 'LexendDeca_700Bold' },
  turnTextContainer: { flex: 1 },
  turnDistance: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg, marginBottom: 4 },
  turnText: { fontSize: 15, color: COLORS.darkBg2, fontFamily: 'LexendDeca_400Regular' },
  wazeBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: COLORS.darkCard, paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', justifyContent: 'space-between', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  etaContainer: { flex: 1 },
  etaTime: { fontSize: 32, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 4 },
  etaDistance: { fontSize: 16, color: COLORS.textLightSub, fontFamily: 'LexendDeca_400Regular' },
  stopNavButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  stopNavText: { fontSize: 20, color: COLORS.textLightSub, fontFamily: 'LexendDeca_400Regular' },
  speedBubble: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 2, borderColor: COLORS.green },
  speedText: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  speedUnit: { fontSize: 10, color: COLORS.gray, marginTop: -2, fontFamily: 'LexendDeca_400Regular' },
  progressBarFloat: { position: 'absolute', bottom: 90, left: 16, right: 16, zIndex: 10, backgroundColor: COLORS.darkCard, borderRadius: 14, padding: 12, paddingTop: 14, elevation: 6, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  progressBarTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 4, overflow: 'visible', marginBottom: 8 },
  progressBarLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressBarEta: { fontSize: 12, fontFamily: 'LexendDeca_500Medium', color: COLORS.textLightSub },
  progressBarArrival: { fontSize: 12, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },
  progressBarContainer: { left: 16, right: 16, height: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 5, overflow: 'visible', marginBottom: 16 },
  progressBarFill: { position: 'absolute', top: 0, left: 0, height: 8, borderRadius: 4, backgroundColor: COLORS.yellow },
  progressBarDot: { position: 'absolute', top: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: COLORS.yellow, marginLeft: -8, elevation: 4 },
  bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.darkCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, elevation: 12, borderTopWidth: 1, borderTopColor: COLORS.darkCardBorder },
  etaCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  etaRow: { flexDirection: 'row', alignItems: 'center' },
  etaItem: { flex: 1, alignItems: 'center' },
  etaValue: { fontSize: 24, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 4 },
  etaLabel: { fontSize: 12, color: COLORS.textLightMuted, textTransform: 'uppercase', fontFamily: 'LexendDeca_400Regular' },
  etaDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },
  addressCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  addressRow: { flexDirection: 'row', alignItems: 'center' },
  greenDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.green, marginRight: 12 },
  redSquare: { width: 14, height: 14, backgroundColor: COLORS.red, marginRight: 12 },
  addressTextContainer: { flex: 1 },
  addressLabel: { fontSize: 12, color: COLORS.textLightMuted, marginBottom: 4, fontFamily: 'LexendDeca_400Regular' },
  addressText: { fontSize: 15, color: COLORS.textLight, fontFamily: 'LexendDeca_500Medium' },
  actionContainer: { marginTop: 8 },
  navButton: { backgroundColor: COLORS.yellow, borderRadius: 16, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 6 },
  navIcon: { fontSize: 20, marginRight: 8, fontFamily: 'LexendDeca_400Regular' },
  navText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  proximityHint: { backgroundColor: 'rgba(255,255,255,0.06)', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  proximityText: { fontSize: 14, color: COLORS.textLightMuted, textAlign: 'center', fontFamily: 'LexendDeca_400Regular' },
  chatButtonRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  chatBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(66,133,244,0.15)', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(66,133,244,0.3)' },
  callBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(76,217,100,0.15)', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(76,217,100,0.3)' },
  chatBtnIcon: { fontSize: 24, marginRight: 8, fontFamily: 'LexendDeca_400Regular' },
  chatBtnText: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight },
  pinOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  pinModal: { backgroundColor: '#fff', borderRadius: 24, padding: 32, width: '85%', alignItems: 'center' },
  pinModalIcon: { fontSize: 48, marginBottom: 12, fontFamily: 'LexendDeca_400Regular' },
  pinModalTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 6 },
  pinModalSub: { fontSize: 14, color: '#888', marginBottom: 24, fontFamily: 'LexendDeca_400Regular' },
  pinModalInput: { fontSize: 36, fontFamily: 'LexendDeca_700Bold', letterSpacing: 16, textAlign: 'center', backgroundColor: '#F5F5F5', borderRadius: 16, padding: 16, width: '80%', marginBottom: 12, color: '#1A1A1A', borderWidth: 2, borderColor: COLORS.green },
  pinModalError: { fontSize: 14, color: '#FF3B30', marginBottom: 12, fontFamily: 'LexendDeca_400Regular' },
  pinModalBtn: { backgroundColor: COLORS.green, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 48, marginBottom: 12 },
  pinModalBtnText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#fff' },
  pinModalCancel: { fontSize: 14, color: '#888', marginTop: 4, fontFamily: 'LexendDeca_400Regular' },
});

var waveStyles = StyleSheet.create({
  waitingCard: {
    backgroundColor: 'rgba(29,195,225,0.12)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(29,195,225,0.3)',
  },
  waitingText: {
    fontSize: 15,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#1DC3E1',
    textAlign: 'center',
  },
  proofCard: {
    backgroundColor: 'rgba(29,195,225,0.10)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(29,195,225,0.35)',
  },
  proofTitle: {
    fontSize: 14,
    fontFamily: 'LexendDeca_600SemiBold',
    color: '#1DC3E1',
    textAlign: 'center',
    marginBottom: 12,
  },
  screenshotImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  amountText: {
    fontSize: 20,
    fontFamily: 'LexendDeca_700Bold',
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 14,
  },
  proofActions: {
    flexDirection: 'row',
    gap: 10,
  },
  verifyBtn: {
    flex: 1,
    backgroundColor: '#00853F',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_700Bold',
    color: '#FFFFFF',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#E31B23',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: {
    fontSize: 14,
    fontFamily: 'LexendDeca_700Bold',
    color: '#FFFFFF',
  },
  disabledStartBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  disabledStartText: {
    fontSize: 16,
    fontFamily: 'LexendDeca_600SemiBold',
    color: 'rgba(255,255,255,0.3)',
  },
  autoCancelBanner: {
    backgroundColor: 'rgba(227,27,35,0.15)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(227,27,35,0.3)',
  },
  autoCancelText: {
    fontSize: 13,
    fontFamily: 'LexendDeca_500Medium',
    color: '#FF6B6B',
    textAlign: 'center',
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: screenWidth - 32,
    height: screenHeight * 0.7,
  },
  fullscreenHint: {
    fontSize: 14,
    fontFamily: 'LexendDeca_400Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 20,
  },
});

export default ActiveRideScreen;


















