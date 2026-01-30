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
import { rideService } from '../services/api.service';

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

  useEffect(() => {
    getDirections();
  }, []);

  useEffect(() => {
    if (routeCoordinates.length > 0) {
      fitMapToRoute();
    }
  }, [routeCoordinates]);

  const getDirections = async () => {
    setCalculatingFare(true);
    
    try {
      const origin = `${pickup.coordinates.latitude},${pickup.coordinates.longitude}`;
      const destination = `${dropoff.coordinates.latitude},${dropoff.coordinates.longitude}`;
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_KEY}&mode=driving&language=fr`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];
        
        const distanceInKm = leg.distance.value / 1000;
        setRealDistance(distanceInKm);
        
        const durationInMinutes = Math.round(leg.duration.value / 60);
        setRealDuration(durationInMinutes);
        
        const points = PolylineUtil.decode(route.overview_polyline.points);
        const coords = points.map(point => ({
          latitude: point[0],
          longitude: point[1],
        }));
        setRouteCoordinates(coords);
        
        calculateFares(distanceInKm, durationInMinutes);
      } else {
        console.error('Directions API error:', data.status);
        Alert.alert('Erreur', 'Impossible de calculer l\'itinéraire');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Directions API error:', error);
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
          edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
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
      console.log('Ride response:', response);

      if (response.success) {
        navigation.replace('ActiveRide', {
          rideId: response.ride?.id || response.ride?._id
        });
      }
    } catch (error) {
      console.error('Create Ride Error:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      console.error('Error status:', error.response?.status);
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
        <Marker
          coordinate={{
            latitude: pickup.coordinates.latitude,
            longitude: pickup.coordinates.longitude,
          }}
          pinColor={COLORS.green}
          title="Départ"
        />
        <Marker
          coordinate={{
            latitude: dropoff.coordinates.latitude,
            longitude: dropoff.coordinates.longitude,
          }}
          pinColor={COLORS.red}
          title="Arrivée"
        />
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={COLORS.green}
            strokeWidth={4}
          />
        )}
      </MapView>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={styles.tripInfoCard}>
        <Text style={styles.tripTime}>{realDuration} min</Text>
        <Text style={styles.tripAddress} numberOfLines={1}>{dropoff.address.split(',')[0]}</Text>
        <Text style={styles.tripDistance}>{realDistance.toFixed(1)} km</Text>
      </View>
      <View style={styles.bottomSheet}>
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
                    <Text style={styles.rideDescription} numberOfLines={1}>{ride.description}</Text>
                  </View>
                </View>
                <Text style={styles.rideFare}>{ride.fare.toLocaleString()} FCFA</Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={styles.paymentSection}>
            <Text style={styles.paymentLabel}>Paiement</Text>
            <View style={styles.paymentMethod}>
              <Text style={styles.paymentIcon}>💵</Text>
              <Text style={styles.paymentText}>Espèces</Text>
            </View>
          </View>
          <View style={styles.bottomSpace} />
        </ScrollView>
        <View style={styles.confirmButton}>
          <GlassButton
            title={loading ? 'Confirmation...' : `Confirmer ${fareEstimates[selectedType]?.name}`}
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
    backgroundColor: COLORS.white,
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
    width,
    height: height * 0.5,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  backIcon: {
    fontSize: 24,
    color: COLORS.black,
  },
  tripInfoCard: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    maxWidth: width * 0.4,
  },
  tripTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  tripAddress: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  tripDistance: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '600',
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  rideCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rideCardSelected: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.white,
  },
  rideLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  rideImage: {
    width: 80,
    height: 60,
    marginRight: 12,
  },
  rideInfo: {
    flex: 1,
  },
  rideName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 2,
  },
  rideCapacity: {
    fontSize: 11,
    color: COLORS.gray,
    marginBottom: 4,
  },
  rideTime: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  rideDescription: {
    fontSize: 12,
    color: COLORS.gray,
  },
  rideFare: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
    flexShrink: 0,
  },
  paymentSection: {
    marginTop: 12,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 8,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  paymentIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  paymentText: {
    fontSize: 16,
    color: COLORS.black,
  },
  bottomSpace: {
    height: 20,
  },
  confirmButton: {
    padding: 20,
    paddingBottom: 30,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
  },
});

export default RideSelectionScreen;



