import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import io from 'socket.io-client';
import COLORS from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { driverService } from '../services/api.service';

const SOCKET_URL = 'http://192.168.1.184:5000';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [location, setLocation] = useState(null);
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const socketRef = useRef(null);
  const fetchInterval = useRef(null);

  useEffect(() => {
    getLocation();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('rider-stop-watching');
        socketRef.current.disconnect();
      }
      if (fetchInterval.current) {
        clearInterval(fetchInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (location) {
      fetchNearbyDrivers();
      connectSocket();
      
      // Refresh nearby drivers every 15 seconds
      fetchInterval.current = setInterval(fetchNearbyDrivers, 15000);
    }
  }, [location]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocation({
          latitude: 14.6928,
          longitude: -17.4467,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const fetchNearbyDrivers = async () => {
    if (!location) return;
    
    try {
      const response = await driverService.getNearbyDrivers(
        location.latitude,
        location.longitude,
        10
      );
      
      if (response.success) {
        setNearbyDrivers(response.drivers);
      }
    } catch (error) {
      console.error('Fetch nearby drivers error:', error);
    }
  };

  const connectSocket = () => {
    if (socketRef.current) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
    });

    socketRef.current.on('connect', () => {
      console.log('Rider connected to socket');
      socketRef.current.emit('rider-watching-drivers');
    });

    // Real-time driver location updates
    socketRef.current.on('nearby-driver-location', (data) => {
      setNearbyDrivers(prev => {
        const updated = [...prev];
        const index = updated.findIndex(d => d._id === data.driverId);
        
        if (index !== -1) {
          updated[index] = {
            ...updated[index],
            location: data.location
          };
        }
        
        return updated;
      });
    });

    // Driver went offline
    socketRef.current.on('driver-went-offline', (data) => {
      setNearbyDrivers(prev => prev.filter(d => d._id !== data.driverId));
    });
  };

  const handleWhereToPress = () => {
    navigation.navigate('SearchDestination', {
      currentLocation: location,
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Voulez-vous vous déconnecter?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: () => logout()
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {location && (
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={WAZE_DARK_STYLE}
          initialRegion={location}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsTraffic={true}
        >
          {/* User Marker */}
          <Marker coordinate={location}>
            <View style={styles.userMarker}>
              <View style={styles.userMarkerInner} />
            </View>
          </Marker>

          {/* Nearby Driver Markers */}
          {nearbyDrivers.map((driver) => (
            <Marker
              key={driver._id}
              coordinate={driver.location}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.driverMarker}>
                <Text style={styles.driverCarIcon}>🚗</Text>
              </View>
            </Marker>
          ))}
        </MapView>
      )}

      {/* Drivers count badge */}
      {nearbyDrivers.length > 0 && (
        <View style={styles.driverCountBadge}>
          <Text style={styles.driverCountText}>
            {nearbyDrivers.length} chauffeur{nearbyDrivers.length > 1 ? 's' : ''} disponible{nearbyDrivers.length > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <View style={styles.topBar}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.greetingCard}>
          <Text style={styles.greeting}>Bonjour,</Text>
          <Text style={styles.userName}>{user?.name || 'Utilisateur'}</Text>
        </View>

        <TouchableOpacity
          style={styles.profileButton}
          onPress={handleLogout}
        >
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchCard}>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleWhereToPress}
          activeOpacity={0.8}
        >
          <View style={styles.searchIconContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
          </View>
          <Text style={styles.searchTitle}>Où allez-vous?</Text>
          <View style={styles.arrowContainer}>
            <Text style={styles.arrow}>→</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionButton}>
            <View style={styles.quickActionIcon}>
              <Text style={styles.quickActionEmoji}>🏠</Text>
            </View>
            <Text style={styles.quickActionText}>Maison</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionButton}>
            <View style={styles.quickActionIcon}>
              <Text style={styles.quickActionEmoji}>💼</Text>
            </View>
            <Text style={styles.quickActionText}>Travail</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionButton}>
            <View style={styles.quickActionIcon}>
              <Text style={styles.quickActionEmoji}>⭐</Text>
            </View>
            <Text style={styles.quickActionText}>Favoris</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <View style={styles.navIconContainerActive}>
            <Text style={styles.navIconActive}>🏠</Text>
          </View>
          <Text style={styles.navLabelActive}>Accueil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <View style={styles.navIconContainer}>
            <Text style={styles.navIcon}>🕐</Text>
          </View>
          <Text style={styles.navLabel}>Activité</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <View style={styles.navIconContainer}>
            <Text style={styles.navIcon}>💳</Text>
          </View>
          <Text style={styles.navLabel}>Paiement</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={handleLogout}
        >
          <View style={styles.navIconContainer}>
            <Text style={styles.navIcon}>👤</Text>
          </View>
          <Text style={styles.navLabel}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  userMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FCD116',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  userMarkerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000',
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: COLORS.green,
  },
  driverCarIcon: {
    fontSize: 18,
  },
  driverCountBadge: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 133, 63, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  driverCountText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  topBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(179, 229, 206, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  logo: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
  },
  greetingCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  greeting: {
    fontSize: 12,
    color: '#666',
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(179, 229, 206, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileIcon: {
    fontSize: 24,
  },
  searchCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(179, 229, 206, 0.95)',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  searchIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FCD116',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchIcon: {
    fontSize: 20,
  },
  searchTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 20,
    color: '#000',
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickActionButton: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '500',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(179, 229, 206, 0.95)',
    paddingVertical: 16,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  navIconContainerActive: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FCD116',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  navIcon: {
    fontSize: 24,
  },
  navIconActive: {
    fontSize: 24,
  },
  navLabel: {
    fontSize: 11,
    color: '#333',
    fontWeight: '500',
  },
  navLabelActive: {
    fontSize: 11,
    color: '#000',
    fontWeight: 'bold',
  },
});

export default HomeScreen;
