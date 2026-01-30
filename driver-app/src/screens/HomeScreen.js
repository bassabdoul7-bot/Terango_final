import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import GlassCard from '../components/GlassCard';
import COLORS from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { driverService } from '../services/api.service';

const HomeScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [location, setLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getLocation();
    const interval = setInterval(() => {
      if (isOnline) {
        updateDriverLocation();
      }
    }, 10000); // Update location every 10 seconds

    return () => clearInterval(interval);
  }, [isOnline]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin de votre localisation pour fonctionner');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  const updateDriverLocation = async () => {
    if (!location) return;

    try {
      await driverService.updateLocation(location.latitude, location.longitude);
    } catch (error) {
      console.error('Update location error:', error);
    }
  };

  const handleToggleOnline = async (value) => {
    setLoading(true);
    try {
      await driverService.toggleOnlineStatus(value);
      setIsOnline(value);
      
      if (value) {
        Alert.alert('En ligne', 'Vous êtes maintenant en ligne et pouvez recevoir des courses');
        // Navigate to ride requests screen
        navigation.navigate('RideRequests');
      } else {
        Alert.alert('Hors ligne', 'Vous ne recevrez plus de demandes de course');
      }
    } catch (error) {
      console.error('Toggle online error:', error);
      Alert.alert('Erreur', 'Impossible de changer le statut');
    } finally {
      setLoading(false);
    }
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
          initialRegion={location}
          showsUserLocation
          showsMyLocationButton
        >
          {location && (
            <Marker
              coordinate={location}
              title="Votre position"
            />
          )}
        </MapView>
      )}

      <GlassCard style={styles.topBar}>
        <View style={styles.topBarContent}>
          <View>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.userName}>{user?.name || 'Chauffeur'}</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleLogout}
          >
            <Text style={styles.profileIcon}>👤</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>

      <GlassCard style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.statusLabel}>Statut</Text>
            <Text style={[styles.statusText, isOnline && styles.statusOnline]}>
              {isOnline ? 'En ligne' : 'Hors ligne'}
            </Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            disabled={loading}
            trackColor={{ false: COLORS.gray, true: COLORS.green }}
            thumbColor={isOnline ? COLORS.white : COLORS.grayLight}
          />
        </View>

        {!isOnline && (
          <Text style={styles.statusHint}>
            Activez pour recevoir des demandes de course
          </Text>
        )}
      </GlassCard>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIconActive}>🏠</Text>
          <Text style={styles.navLabelActive}>Accueil</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('Earnings')}
        >
          <Text style={styles.navIcon}>💰</Text>
          <Text style={styles.navLabel}>Gains</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('History')}
        >
          <Text style={styles.navIcon}>🕐</Text>
          <Text style={styles.navLabel}>Historique</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={handleLogout}
        >
          <Text style={styles.navIcon}>👤</Text>
          <Text style={styles.navLabel}>Profil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    color: COLORS.gray,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIcon: {
    fontSize: 20,
  },
  statusCard: {
    position: 'absolute',
    top: 140,
    left: 20,
    right: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.red,
  },
  statusOnline: {
    color: COLORS.green,
  },
  statusHint: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 12,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayLight,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  navIconActive: {
    fontSize: 24,
    marginBottom: 4,
  },
  navLabel: {
    fontSize: 10,
    color: COLORS.gray,
  },
  navLabelActive: {
    fontSize: 10,
    color: COLORS.green,
    fontWeight: '600',
  },
});

export default HomeScreen;
