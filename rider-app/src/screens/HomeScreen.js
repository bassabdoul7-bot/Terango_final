import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { createAuthSocket } from '../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { WAZE_DARK_STYLE } from '../constants/mapStyles';
import { driverService, rideService } from '../services/api.service';
import CAR_IMAGES from '../constants/carImages';


var GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
var MINT = 'rgba(179, 229, 206, 0.95)';
var MINT_LIGHT = 'rgba(179, 229, 206, 0.12)';
var MINT_BORDER = 'rgba(179, 229, 206, 0.25)';
var YELLOW = '#FCD116';
var DARK_BG = '#0a0a0a';

function HomeScreen(props) {
  var navigation = props.navigation;
  var auth = useAuth();
  var user = auth.user;
  var logout = auth.logout;

  var locState = useState(null);
  var location = locState[0];
  var setLocation = locState[1];

  var driversState = useState([]);
  var nearbyDrivers = driversState[0];
  var setNearbyDrivers = driversState[1];

  var tabState = useState('home');
  var activeTab = tabState[0];
  var setActiveTab = tabState[1];

  var savedState = useState({ home: null, work: null, favorites: [] });
  var savedPlaces = savedState[0];
  var setSavedPlaces = savedState[1];

  var historyState = useState([]);
  var rideHistory = historyState[0];
  var setRideHistory = historyState[1];

  var modalState = useState(false);
  var showSaveModal = modalState[0];
  var setShowSaveModal = modalState[1];

  var saveTypeState = useState('home');
  var saveType = saveTypeState[0];
  var setSaveType = saveTypeState[1];

  var saveAddrState = useState('');
  var saveAddress = saveAddrState[0];
  var setSaveAddress = saveAddrState[1];

  var socketRef = useRef(null);
  var fetchInterval = useRef(null);

  // Load saved places from storage
  useEffect(function() {
    loadSavedPlaces();
    loadRideHistory();
  }, []);

  useEffect(function() {
    getLocation();
    return function() {
      if (socketRef.current) {
        socketRef.current.emit('rider-stop-watching');
        socketRef.current.disconnect();
      }
      if (fetchInterval.current) {
        clearInterval(fetchInterval.current);
      }
    };
  }, []);

  useEffect(function() {
    if (location) {
      fetchNearbyDrivers();
      connectSocket();
      fetchInterval.current = setInterval(fetchNearbyDrivers, 15000);
    }
  }, [location]);

  function loadSavedPlaces() {
    AsyncStorage.getItem('savedPlaces').then(function(data) {
      if (data) {
        setSavedPlaces(JSON.parse(data));
      }
    }).catch(function(err) {
      console.log('Load saved places error:', err);
    });
  }

  function savePlacesToStorage(places) {
    setSavedPlaces(places);
    AsyncStorage.setItem('savedPlaces', JSON.stringify(places)).catch(function(err) {
      console.log('Save places error:', err);
    });
  }

  function loadRideHistory() {
    rideService.getMyRides().then(function(response) {
      if (response.success) {
        setRideHistory(response.rides || []);
      }
    }).catch(function(err) {
      console.log('History error:', err);
    });
  }

  function getLocation() {
    Location.requestForegroundPermissionsAsync().then(function(result) {
      if (result.status !== 'granted') {
        setLocation({
          latitude: 14.6928,
          longitude: -17.4467,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        return;
      }
      Location.getCurrentPositionAsync({}).then(function(currentLocation) {
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      });
    }).catch(function(error) {
      console.error('Location error:', error);
    });
  }

  function fetchNearbyDrivers() {
    if (!location) return;
    driverService.getNearbyDrivers(location.latitude, location.longitude, 10).then(function(response) {
      if (response.success) {
        setNearbyDrivers(response.drivers);
      }
    }).catch(function(error) {
      console.error('Fetch nearby drivers error:', error);
    });
  }

  function connectSocket() {
    if (socketRef.current) return;
    createAuthSocket().then(function(socket) {
      socketRef.current = socket;

      socket.on('connect', function() {
        console.log('Rider connected to socket');
        socket.emit('rider-watching-drivers');
      });

      socket.on('nearby-driver-location', function(data) {
        setNearbyDrivers(function(prev) {
          var updated = prev.slice();
          var index = updated.findIndex(function(d) { return d._id === data.driverId; });
          if (index !== -1) {
            updated[index] = Object.assign({}, updated[index], { location: data.location });
          }
          return updated;
        });
      });

      socket.on('driver-went-offline', function(data) {
        setNearbyDrivers(function(prev) {
          return prev.filter(function(d) { return d._id !== data.driverId; });
        });
      });
    }).catch(function(err) {
      console.log('Socket error:', err);
    });
  }

  function handleWhereToPress() {
    navigation.navigate('SearchDestination', { currentLocation: location });
  }

  function handleQuickPlace(type) {
    var place = null;
    if (type === 'home') place = savedPlaces.home;
    if (type === 'work') place = savedPlaces.work;

    if (!place) {
      setSaveType(type);
      setShowSaveModal(true);
      return;
    }

    navigation.navigate('SearchDestination', {
      currentLocation: location,
      presetDestination: place,
    });
  }

  function handleSavePlace() {
    if (!saveAddress.trim()) {
      Alert.alert('Adresse requise', 'Veuillez entrer une adresse.');
      return;
    }

    var url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' +
      encodeURIComponent(saveAddress) + '&key=' + GOOGLE_MAPS_KEY + '&region=sn';

    fetch(url).then(function(res) { return res.json(); }).then(function(data) {
      if (data.results && data.results.length > 0) {
        var result = data.results[0];
        var place = {
          address: result.formatted_address,
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
        };

        var updated = Object.assign({}, savedPlaces);
        if (saveType === 'home') updated.home = place;
        else if (saveType === 'work') updated.work = place;
        else {
          updated.favorites = (updated.favorites || []).concat([place]);
        }

        savePlacesToStorage(updated);
        setShowSaveModal(false);
        setSaveAddress('');
        Alert.alert('Enregistré', (saveType === 'home' ? 'Maison' : saveType === 'work' ? 'Travail' : 'Favori') + ' enregistré avec succès!');
      } else {
        Alert.alert('Adresse introuvable', "Veuillez vérifier l'adresse.");
      }
    }).catch(function(err) {
      Alert.alert('Erreur', "Impossible de trouver l'adresse.");
    });
  }

  function handleLogout() {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: function() { logout(); } }
    ]);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var date = new Date(dateStr);
    var now = new Date();
    var diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return 'Il y a ' + diffDays + ' jours';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  // ========== ACTIVITY TAB ==========
  function renderActivityTab() {
    if (rideHistory.length === 0) {
      return (
        <View style={styles.tabScreen}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{"🚗"}</Text>
            <Text style={styles.emptyTitle}>Aucune course</Text>
            <Text style={styles.emptySub}>{"Vos courses apparaîtront ici"}</Text>
          </View>
        </View>
      );
    }

    return (
      <ScrollView style={styles.tabScreen} showsVerticalScrollIndicator={false}>
        <Text style={styles.tabHeader}>{"Historique des courses"}</Text>
        {rideHistory.slice(0, 20).map(function(ride, index) {
          var carImg = CAR_IMAGES[ride.rideType] || CAR_IMAGES.standard;
          return (
            <View key={ride._id || index} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>{formatDate(ride.completedAt || ride.updatedAt)}</Text>
                <Text style={styles.historyFare}>{(ride.fare || 0).toLocaleString() + ' FCFA'}</Text>
              </View>
              <View style={styles.historyRoute}>
                <View style={styles.dotLine}>
                  <View style={styles.gDot} />
                  <View style={styles.dLine} />
                  <View style={styles.rSquare} />
                </View>
                <View style={styles.addresses}>
                  <Text style={styles.addr} numberOfLines={1}>{ride.pickup ? ride.pickup.address || 'Départ' : 'Départ'}</Text>
                  <Text style={styles.addr} numberOfLines={1}>{ride.dropoff ? ride.dropoff.address || 'Arrivée' : 'Arrivée'}</Text>
                </View>
              </View>
              <View style={styles.historyFooter}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{carImg.name}</Text>
                </View>
                <Text style={styles.historyMeta}>{ride.status || 'completed'}</Text>
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  }

  // ========== PAYMENT TAB ==========
  function renderPaymentTab() {
    return (
      <View style={styles.tabScreen}>
        <Text style={styles.tabHeader}>Paiement</Text>

        <View style={styles.paymentCard}>
          <Text style={styles.paymentIcon}>{"💵"}</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>{"Espèces"}</Text>
            <Text style={styles.paymentSub}>{"Méthode par défaut"}</Text>
          </View>
          <View style={styles.paymentActive}>
            <Text style={styles.paymentActiveText}>{"Actif"}</Text>
          </View>
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.paymentIcon}>{"📱"}</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>Wave</Text>
            <Text style={styles.paymentSub}>{"Paiement mobile"}</Text>
          </View>
          <Text style={styles.paymentSoon}>{"Bientôt"}</Text>
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.paymentIcon}>{"🟠"}</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>Orange Money</Text>
            <Text style={styles.paymentSub}>{"Paiement mobile"}</Text>
          </View>
          <Text style={styles.paymentSoon}>{"Bientôt"}</Text>
        </View>

        <View style={styles.paymentCard}>
          <Text style={styles.paymentIcon}>{"💳"}</Text>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>Free Money</Text>
            <Text style={styles.paymentSub}>{"Paiement mobile"}</Text>
          </View>
          <Text style={styles.paymentSoon}>{"Bientôt"}</Text>
        </View>
      </View>
    );
  }

  // ========== PROFILE TAB ==========
  function renderProfileTab() {
    var userName = (user && user.name) ? user.name : 'Utilisateur';
    var userPhone = (user && user.phone) ? user.phone : '-';
    var userEmail = (user && user.email) ? user.email : '-';
    var userRating = (user && user.rating) ? user.rating.toFixed(1) : '5.0';
    var totalRides = rideHistory.length;

    return (
      <ScrollView style={styles.tabScreen} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHero}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.profileName}>{userName}</Text>
          <View style={styles.profileRatingRow}>
            <Text style={{ fontSize: 14 }}>{"⭐"}</Text>
            <Text style={styles.profileRatingVal}>{userRating}</Text>
            <Text style={styles.profileRatingMeta}>{"• " + totalRides + ' courses'}</Text>
          </View>
        </View>

        <View style={styles.profileSection}>
          <Text style={styles.profileSectionTitle}>Informations</Text>
          <View style={styles.profileGroup}>
            <View style={styles.profileRow}>
              <Text style={styles.profileEmoji}>{"📞"}</Text>
              <Text style={styles.profileLabel}>{"Téléphone"}</Text>
              <Text style={styles.profileValue}>{userPhone}</Text>
            </View>
            <View style={[styles.profileRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.profileEmoji}>{"📧"}</Text>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue}>{userEmail}</Text>
            </View>
          </View>
        </View>

        <View style={styles.profileSection}>
          <Text style={styles.profileSectionTitle}>{"Lieux enregistrés"}</Text>
          <View style={styles.profileGroup}>
            <TouchableOpacity style={styles.profileRow} onPress={function() { handleQuickPlace('home'); }}>
              <Text style={styles.profileEmoji}>{"🏠"}</Text>
              <Text style={styles.profileLabel}>Maison</Text>
              <Text style={styles.profileValue} numberOfLines={1}>
                {savedPlaces.home ? savedPlaces.home.address : 'Ajouter'}
              </Text>
              <Text style={styles.profileChevron}>{"›"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.profileRow, { borderBottomWidth: 0 }]} onPress={function() { handleQuickPlace('work'); }}>
              <Text style={styles.profileEmoji}>{"💼"}</Text>
              <Text style={styles.profileLabel}>Travail</Text>
              <Text style={styles.profileValue} numberOfLines={1}>
                {savedPlaces.work ? savedPlaces.work.address : 'Ajouter'}
              </Text>
              <Text style={styles.profileChevron}>{"›"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>{"👋"}</Text>
          <Text style={styles.logoutTxt}>{"Se déconnecter"}</Text>
        </TouchableOpacity>

        <Text style={styles.versionTxt}>TeranGO Rider v1.0.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  }

  // ========== SAVE PLACE MODAL ==========
  function renderSaveModal() {
    var typeLabel = saveType === 'home' ? 'Maison' : saveType === 'work' ? 'Travail' : 'Favori';
    return (
      <Modal visible={showSaveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{'Ajouter ' + typeLabel}</Text>
            <Text style={styles.modalSub}>{"Entrez l'adresse"}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Almadies, Dakar"
              placeholderTextColor="rgba(0,0,0,0.3)"
              value={saveAddress}
              onChangeText={setSaveAddress}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={function() { setShowSaveModal(false); setSaveAddress(''); }}>
                <Text style={styles.modalCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={handleSavePlace}>
                <Text style={styles.modalSaveText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ========== HOME MAP VIEW ==========
  function renderHomeTab() {
    return (
      <View style={{ flex: 1 }}>
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
            <Marker coordinate={location}>
              <View style={styles.userMarker}>
                <View style={styles.userMarkerInner} />
              </View>
            </Marker>

            {nearbyDrivers.map(function(driver) {
              return (
                <Marker key={driver._id} coordinate={driver.location} anchor={{ x: 0.5, y: 0.5 }}>
                  <View style={styles.driverMarker}>
                    <Image source={{ uri: CAR_IMAGES.standard.uri }} style={{ width: 28, height: 18 }} resizeMode="contain" />
                  </View>
                </Marker>
              );
            })}
          </MapView>
        )}

        {nearbyDrivers.length > 0 && (
          <View style={styles.driverCountBadge}>
            <Text style={styles.driverCountText}>
              {nearbyDrivers.length + ' chauffeur' + (nearbyDrivers.length > 1 ? 's' : '') + ' disponible' + (nearbyDrivers.length > 1 ? 's' : '')}
            </Text>
          </View>
        )}

        <View style={styles.topBar}>
          <View style={styles.logoContainer}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.greetingCard}>
            <Text style={styles.greeting}>Bonjour,</Text>
            <Text style={styles.userName}>{(user && user.name) ? user.name : 'Utilisateur'}</Text>
          </View>
          <TouchableOpacity style={styles.profileButton} onPress={function() { setActiveTab('profile'); }}>
            <Text style={styles.profileBtnIcon}>{"👤"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchCard}>
          <TouchableOpacity style={styles.searchButton} onPress={handleWhereToPress} activeOpacity={0.8}>
            <View style={styles.searchIconContainer}>
              <Text style={styles.searchIcon}>{"🔍"}</Text>
            </View>
            <Text style={styles.searchTitle}>{"Où allez-vous?"}</Text>
            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>{"↑"}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickActionButton} onPress={function() { handleQuickPlace('home'); }}>
              <View style={[styles.quickActionIcon, savedPlaces.home && styles.quickActionIconSaved]}>
                <Text style={styles.quickActionEmoji}>{"🏠"}</Text>
              </View>
              <Text style={styles.quickActionText}>Maison</Text>
              {savedPlaces.home && <Text style={styles.quickActionSet}>{"✓"}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionButton} onPress={function() { handleQuickPlace('work'); }}>
              <View style={[styles.quickActionIcon, savedPlaces.work && styles.quickActionIconSaved]}>
                <Text style={styles.quickActionEmoji}>{"💼"}</Text>
              </View>
              <Text style={styles.quickActionText}>Travail</Text>
              {savedPlaces.work && <Text style={styles.quickActionSet}>{"✓"}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionButton} onPress={function() {
              if (savedPlaces.favorites && savedPlaces.favorites.length > 0) {
                Alert.alert('Favoris', 'Vous avez ' + savedPlaces.favorites.length + ' lieu(x) favori(s).');
              } else {
                setSaveType('favorite');
                setShowSaveModal(true);
              }
            }}>
              <View style={[styles.quickActionIcon, savedPlaces.favorites && savedPlaces.favorites.length > 0 && styles.quickActionIconSaved]}>
                <Text style={styles.quickActionEmoji}>{"⭐"}</Text>
              </View>
              <Text style={styles.quickActionText}>Favoris</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.servicesSection}>
            <Text style={styles.servicesTitle}>Services</Text>
            <View style={styles.servicesGrid}>
              <TouchableOpacity style={styles.serviceCard} onPress={function() { navigation.navigate('SearchDestination', { currentLocation: location }); }}>
                <View style={[styles.serviceIconWrap, { backgroundColor: 'rgba(0, 133, 63, 0.15)' }]}>
                  <Text style={styles.serviceEmoji}>{"🚗"}</Text>
                </View>
                <Text style={styles.serviceLabel}>Course</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.serviceCard} onPress={function() { navigation.navigate('ThiakThiak', { currentLocation: location }); }}>
                <View style={[styles.serviceIconWrap, { backgroundColor: 'rgba(252, 209, 22, 0.15)' }]}>
                  <Text style={styles.serviceEmoji}>{"🏍️"}</Text>
                </View>
                <Text style={styles.serviceLabel}>Thiak Thiak</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.serviceCard} onPress={function() { navigation.navigate('Colis', { currentLocation: location }); }}>
                <View style={[styles.serviceIconWrap, { backgroundColor: 'rgba(255, 149, 0, 0.15)' }]}>
                  <Text style={styles.serviceEmoji}>{"📦"}</Text>
                </View>
                <Text style={styles.serviceLabel}>Colis</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.serviceCard} onPress={function() { navigation.navigate('RestaurantList', { currentLocation: location }); }}>
                <View style={[styles.serviceIconWrap, { backgroundColor: 'rgba(255, 59, 48, 0.15)' }]}>
                  <Text style={styles.serviceEmoji}>{"🍽️"}</Text>
                </View>
                <Text style={styles.serviceLabel}>Restaurant</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ========== MAIN RENDER ==========
  return (
    <View style={styles.container}>
      {activeTab === 'home' && renderHomeTab()}
      {activeTab === 'activity' && renderActivityTab()}
      {activeTab === 'payment' && renderPaymentTab()}
      {activeTab === 'profile' && renderProfileTab()}

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={function() { setActiveTab('home'); }}>
          <View style={activeTab === 'home' ? styles.navIconContainerActive : styles.navIconContainer}>
            <Text style={styles.navIconText}>{"🏠"}</Text>
          </View>
          <Text style={activeTab === 'home' ? styles.navLabelActive : styles.navLabel}>Accueil</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={function() { setActiveTab('activity'); loadRideHistory(); }}>
          <View style={activeTab === 'activity' ? styles.navIconContainerActive : styles.navIconContainer}>
            <Text style={styles.navIconText}>{"🕕"}</Text>
          </View>
          <Text style={activeTab === 'activity' ? styles.navLabelActive : styles.navLabel}>{"Activité"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={function() { setActiveTab('payment'); }}>
          <View style={activeTab === 'payment' ? styles.navIconContainerActive : styles.navIconContainer}>
            <Text style={styles.navIconText}>{"💳"}</Text>
          </View>
          <Text style={activeTab === 'payment' ? styles.navLabelActive : styles.navLabel}>Paiement</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={function() { setActiveTab('profile'); }}>
          <View style={activeTab === 'profile' ? styles.navIconContainerActive : styles.navIconContainer}>
            <Text style={styles.navIconText}>{"👤"}</Text>
          </View>
          <Text style={activeTab === 'profile' ? styles.navLabelActive : styles.navLabel}>Profil</Text>
        </TouchableOpacity>
      </View>

      {renderSaveModal()}
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  map: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  userMarker: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: YELLOW,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  userMarkerInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#000' },
  driverMarker: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.green,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  driverCountBadge: {
    position: 'absolute', top: 130, alignSelf: 'center',
    backgroundColor: 'rgba(0, 133, 63, 0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  driverCountText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  topBar: {
    position: 'absolute', top: 60, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  logoContainer: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: MINT,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', elevation: 4,
  },
  logo: { width: 45, height: 45, borderRadius: 22.5 },
  greetingCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, elevation: 4,
  },
  greeting: { fontSize: 12, color: '#666' },
  userName: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  profileButton: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: MINT,
    alignItems: 'center', justifyContent: 'center', elevation: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  profileBtnIcon: { fontSize: 24 },
  searchCard: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    backgroundColor: MINT, borderRadius: 20, padding: 20, elevation: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  searchButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)', paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)',
  },
  searchIconContainer: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: YELLOW,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  searchIcon: { fontSize: 20 },
  searchTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#000' },
  arrowContainer: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrow: { fontSize: 20, color: '#000', fontWeight: 'bold' },
  quickActions: { flexDirection: 'row', justifyContent: 'space-around' },
  quickActionButton: { alignItems: 'center' },
  quickActionIcon: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)',
  },
  quickActionIconSaved: { borderColor: '#4CD964', borderWidth: 2, backgroundColor: 'rgba(76, 217, 100, 0.15)' },
  quickActionEmoji: { fontSize: 24 },
  quickActionText: { fontSize: 12, color: '#000', fontWeight: '500' },
  quickActionSet: { fontSize: 10, color: '#4CD964', fontWeight: 'bold', marginTop: 2 },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row',
    backgroundColor: MINT, paddingVertical: 16, paddingBottom: 28,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, elevation: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)',
  },
  navItem: { flex: 1, alignItems: 'center' },
  navIconContainer: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  navIconContainerActive: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: YELLOW,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6, elevation: 4,
  },
  navIconText: { fontSize: 24 },
  navLabel: { fontSize: 11, color: '#333', fontWeight: '500' },
  navLabelActive: { fontSize: 11, color: '#000', fontWeight: 'bold' },
  tabScreen: { flex: 1, backgroundColor: DARK_BG, paddingHorizontal: 20, paddingTop: 70 },
  tabHeader: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 20, marginTop: 10 },
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  historyCard: {
    backgroundColor: MINT_LIGHT, borderRadius: 16, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: MINT_BORDER,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  historyDate: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  historyFare: { fontSize: 16, fontWeight: 'bold', color: YELLOW },
  historyRoute: { flexDirection: 'row', marginBottom: 14 },
  dotLine: { alignItems: 'center', marginRight: 12, paddingTop: 4 },
  gDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CD964' },
  dLine: { width: 2, height: 24, backgroundColor: 'rgba(179, 229, 206, 0.3)', marginVertical: 4 },
  rSquare: { width: 10, height: 10, backgroundColor: '#FF3B30' },
  addresses: { flex: 1, justifyContent: 'space-between' },
  addr: { fontSize: 14, color: 'rgba(255,255,255,0.7)', paddingVertical: 2 },
  historyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyMeta: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  typeBadge: { backgroundColor: 'rgba(252, 209, 22, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 11, color: YELLOW, fontWeight: '600' },
  paymentCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: MINT_LIGHT, borderRadius: 16, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: MINT_BORDER,
  },
  paymentIcon: { fontSize: 28, marginRight: 14 },
  paymentInfo: { flex: 1 },
  paymentTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  paymentSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  paymentActive: { backgroundColor: '#4CD964', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  paymentActiveText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  paymentSoon: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },
  profileHero: {
    backgroundColor: MINT, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24,
  },
  profileAvatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  profileAvatarText: { fontSize: 30, fontWeight: 'bold', color: '#4CD964' },
  profileName: { fontSize: 22, fontWeight: '700', color: '#000', marginBottom: 4 },
  profileRatingRow: { flexDirection: 'row', alignItems: 'center' },
  profileRatingVal: { fontSize: 15, fontWeight: '700', color: '#000', marginLeft: 4, marginRight: 6 },
  profileRatingMeta: { fontSize: 13, color: 'rgba(0,0,0,0.5)' },
  profileSection: { marginBottom: 20 },
  profileSectionTitle: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', marginBottom: 10, marginLeft: 4,
  },
  profileGroup: {
    backgroundColor: MINT_LIGHT, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: MINT_BORDER,
  },
  profileRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(179, 229, 206, 0.1)',
  },
  profileEmoji: { fontSize: 20, marginRight: 14 },
  profileLabel: { flex: 1, fontSize: 15, color: '#fff' },
  profileValue: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginRight: 8, maxWidth: 180 },
  profileChevron: { fontSize: 22, color: '#4CD964', fontWeight: '600' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 18, borderRadius: 16, backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.2)', marginBottom: 16, marginTop: 10,
  },
  logoutIcon: { fontSize: 20, marginRight: 10 },
  logoutTxt: { fontSize: 16, fontWeight: '600', color: '#FF3B30' },
  versionTxt: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.15)', marginBottom: 20 },
  servicesSection: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
  servicesTitle: { fontSize: 13, fontWeight: '700', color: '#333', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  servicesGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  serviceCard: { alignItems: 'center', flex: 1 },
  serviceIconWrap: {
    width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  serviceEmoji: { fontSize: 26 },
  serviceLabel: { fontSize: 11, fontWeight: '600', color: '#222' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    backgroundColor: MINT, borderRadius: 20, padding: 24, width: '100%',
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 8 },
  modalSub: { fontSize: 14, color: '#333', marginBottom: 16 },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12, padding: 16,
    fontSize: 16, color: '#000', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1, padding: 16, backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 12, alignItems: 'center',
  },
  modalCancelText: { fontSize: 16, fontWeight: '600', color: '#333' },
  modalSave: {
    flex: 2, padding: 16, backgroundColor: '#4CD964', borderRadius: 12, alignItems: 'center',
  },
  modalSaveText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
});

export default HomeScreen;