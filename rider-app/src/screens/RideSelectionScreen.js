import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as PolylineUtil from '@mapbox/polyline';
import GlassButton from '../components/GlassButton';
import COLORS from '../constants/colors';
import { rideService, driverService } from '../services/api.service';

const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const RideSelectionScreen = ({ route, navigation }) => {
  const { pickup, dropoff } = route.params;

  const mapRef = useRef(null);
  const [selectedType, setSelectedType] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [fareEstimates, setFareEstimates] = useState(null);
  const [calculatingFare, setCalculatingFare] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [realDistance, setRealDistance] = useState(0);
  const [realDuration, setRealDuration] = useState(0);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);

  useEffect(() => {
    getDirections();
    fetchNearbyDrivers();
  }, []);

  useEffect(() => {
    if (routeCoordinates.length > 0) {
      fitMapToRoute();
    }
  }, [routeCoordinates]);

  const fetchNearbyDrivers = async () => {
    try {
      const response = await driverService.getNearbyDrivers(
        pickup.coordinates.latitude,
        pickup.coordinates.longitude,
        10
      );
      
      if (response.success) {
        setNearbyDrivers(response.drivers);
      }
    } catch (error) {
      console.error('Fetch nearby drivers error:', error);
    }
  };

  const getDirections = async () => {
    setCalculatingFare(true);

    try {
      const origin = `${pickup.coordinates.latitude},${pickup.coordinates.longitude}`;
      const destination = `${dropoff.coordinates.latitude},${dropoff.coordinates.longitude}`;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_KEY}&mode=driving&language=fr`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const routeData = data.routes[0];
        const leg = routeData.legs[0];

        const distanceInKm = leg.distance.value / 1000;
        setRealDistance(distanceInKm);

        const durationInMinutes = Math.round(leg.duration.value / 60);
        setRealDuration(durationInMinutes);

        const points = PolylineUtil.decode(routeData.overview_polyline.points);
        const coords = points.map(point => ({
          latitude: point[0],
          longitude: point[1],
        }));
        setRouteCoordinates(coords);

        calculateFares(distanceInKm, durationInMinutes);
      } else {
        Alert.alert('Erreur', 'Impossible de calculer l\'itinéraire');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Erreur', 'Erreur lors du calcul de l\'itinéraire');
      navigation.goBack();
    }
  };

  const calculateFares = (distance, duration) => {
    const fares = {
      standard: {
        type: 'standard',
        name: 'TeranGO Standard',
        description: 'Trajet économique',
        imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberX_v1.png',
        fare: Math.round(500 + (distance * 300)),
        estimatedTime: duration,
        distance: distance.toFixed(1),
        capacity: '4'
      },
      comfort: {
        type: 'comfort',
        name: 'TeranGO Comfort',
        description: 'Véhicule confortable avec climatisation',
        imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/Black_v1.png',
        fare: Math.round(800 + (distance * 400)),
        estimatedTime: duration,
        distance: distance.toFixed(1),
        capacity: '4'
      },
      xl: {
        type: 'xl',
        name: 'TeranGO XL',
        description: 'Véhicule spacieux pour groupes',
        imageUri: 'https://d1a3f4spazzrp4.cloudfront.net/car-types/haloProductImages/v1.1/UberXL_v1.png',
        fare: Math.round(1200 + (distance * 550)),
        estimatedTime: duration,
        distance: distance.toFixed(1),
        capacity: '7'
      }
    };

    setFareEstimates(fares);
    setCalculatingFare(false);
  };

  const fitMapToRoute = () => {
    if (mapRef.current && routeCoordinates.length > 0) {
      setTimeout(() => {
        mapRef.current.fitToCoordinates(routeCoordinates, {
          edgePadding: { top: 100, right: 50, bottom: 380, left: 50 },
          animated: true,
        });
      }, 500);
    }
  };

  const handleBookRide = async () => {
    if (!selectedType || !fareEstimates) {
      Alert.alert('Erreur', 'Veuillez sélectionner un type de course');
      return;
    }

    setLoading(true);

    try {
      const rideData = {
        pickup: {
          address: pickup.address,
          coordinates: {
            latitude: pickup.coordinates.latitude,
            longitude: pickup.coordinates.longitude
          }
        },
        dropoff: {
          address: dropoff.address,
          coordinates: {
            latitude: dropoff.coordinates.latitude,
            longitude: dropoff.coordinates.longitude
          }
        },
        rideType: selectedType,
        paymentMethod: 'cash'
      };

      const response = await rideService.createRide(rideData);

      if (response.success) {
        navigation.replace('ActiveRide', {
          rideId: response.ride?.id || response.ride?._id
        });
      }
    } catch (error) {
      Alert.alert(
        'Erreur',
        error.response?.data?.message || 'Impossible de créer la course'
      );
    } finally {
      setLoading(false);
    }
  };

  if (calculatingFare) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.loadingText}>Calcul de l'itinéraire...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: (pickup.coordinates.latitude + dropoff.coordinates.latitude) / 2,
          longitude: (pickup.coordinates.longitude + dropoff.coordinates.longitude) / 2,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {/* Pickup Marker */}
        <Marker coordinate={pickup.coordinates} title="Départ">
          <View style={styles.pickupMarker}>
            <View style={styles.pickupDot} />
          </View>
        </Marker>

        {/* Dropoff Marker */}
        <Marker coordinate={dropoff.coordinates} title="Arrivée">
          <View style={styles.dropoffMarker}>
            <View style={styles.dropoffSquare} />
          </View>
        </Marker>

        {/* Nearby Drivers */}
        {nearbyDrivers.map((driver) => (
          <Marker
            key={driver._id}
            coordinate={driver.location}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverIcon}>🚗</Text>
            </View>
          </Marker>
        ))}

        {/* Route */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={COLORS.green}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>

      {/* Trip Info Card */}
      <View style={styles.tripInfoCard}>
        <Text style={styles.tripTime}>{realDuration} min</Text>
        <Text style={styles.tripAddress} numberOfLines={1}>
          {dropoff.address.split(',')[0]}
        </Text>
        <Text style={styles.tripDistance}>{realDistance.toFixed(1)} km</Text>
        {nearbyDrivers.length > 0 && (
          <View style={styles.driversBadge}>
            <Text style={styles.driversBadgeText}>
              {nearbyDrivers.length} 🚗
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.sheetHandle} />
        
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {fareEstimates && Object.values(fareEstimates).map((ride) => (
            <TouchableOpacity
              key={ride.type}
              onPress={() => setSelectedType(ride.type)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.rideCard,
                  selectedType === ride.type && styles.rideCardSelected
                ]}
              >
                <View style={styles.rideLeft}>
                  <Image
                    source={{ uri: ride.imageUri }}
                    style={styles.rideImage}
                    resizeMode="contain"
                  />
                  <View style={styles.rideInfo}>
                    <Text style={styles.rideName}>{ride.name}</Text>
                    <Text style={styles.rideCapacity}>👤 {ride.capacity} places</Text>
                    <Text style={styles.rideTime}>
                      {ride.estimatedTime} min • {ride.distance} km
                    </Text>
                  </View>
                </View>
                <Text style={styles.rideFare}>{ride.fare.toLocaleString()} F</Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Payment Section */}
          <View style={styles.paymentCard}>
            <Text style={styles.paymentLabel}>Paiement</Text>
            <View style={styles.paymentRow}>
              <View style={styles.paymentIconBg}>
                <Text style={styles.paymentIcon}>💵</Text>
              </View>
              <Text style={styles.paymentText}>Espèces</Text>
              <Text style={styles.paymentArrow}>›</Text>
            </View>
          </View>

          <View style={styles.bottomSpace} />
        </ScrollView>

        {/* Confirm Button */}
        <View style={styles.confirmSection}>
          <GlassButton
            title={loading ? 'Confirmation...' : `Confirmer • ${fareEstimates[selectedType]?.fare.toLocaleString()} FCFA`}
            onPress={handleBookRide}
            loading={loading}
          />
        </View>
      </View>
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
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.gray,
  },
  map: {
    width,
    height: height * 0.48,
  },
  pickupMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.green,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.green,
  },
  dropoffMarker: {
    width: 26,
    height: 26,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.red,
  },
  dropoffSquare: {
    width: 10,
    height: 10,
    backgroundColor: COLORS.red,
  },
  driverMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.green,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  driverIcon: {
    fontSize: 16,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  backIcon: {
    fontSize: 22,
    color: '#000',
    fontWeight: 'bold',
  },
  tripInfoCard: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(179, 229, 206, 0.95)',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    maxWidth: width * 0.4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tripTime: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  tripAddress: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
  },
  tripDistance: {
    fontSize: 12,
    color: COLORS.green,
    fontWeight: '600',
  },
  driversBadge: {
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  driversBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000',
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: 'rgba(179, 229, 206, 0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  rideCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rideCardSelected: {
    borderColor: COLORS.green,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  rideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  rideImage: {
    width: 70,
    height: 50,
    marginRight: 10,
  },
  rideInfo: {
    flex: 1,
  },
  rideName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 2,
  },
  rideCapacity: {
    fontSize: 11,
    color: '#555',
    marginBottom: 2,
  },
  rideTime: {
    fontSize: 11,
    color: '#666',
  },
  rideFare: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.green,
  },
  paymentCard: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  paymentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FCD116',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentIcon: {
    fontSize: 18,
  },
  paymentText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  paymentArrow: {
    fontSize: 22,
    color: '#999',
  },
  bottomSpace: {
    height: 16,
  },
  confirmSection: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: 'rgba(179, 229, 206, 0.98)',
  },
});

export default RideSelectionScreen;
