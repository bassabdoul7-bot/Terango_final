import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { Map, Camera, Marker } from '@maplibre/maplibre-react-native';
const TERANGO_STYLE = require('../constants/terangoMapStyle.json');
import * as Location from 'expo-location';
import COLORS from '../constants/colors';

var FILTER_ALL = 'all';
var FILTER_MECHANICS = 'mechanics';
var FILTER_PARTS = 'parts';

function getDistance(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function buildOverpassUrl(lat, lon, radius) {
  var r = radius || 5000;
  var query = '[out:json];(node["shop"="car_repair"](around:' + r + ',' + lat + ',' + lon + ');node["shop"="car_parts"](around:' + r + ',' + lat + ',' + lon + ');node["craft"="mechanic"](around:' + r + ',' + lat + ',' + lon + '););out body;';
  return 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
}

function categorize(tags) {
  if (tags.shop === 'car_parts') return 'parts';
  return 'mechanics';
}

var MechanicsScreen = function (props) {
  var navigation = props.navigation;

  var locationState = useState(null);
  var location = locationState[0];
  var setLocation = locationState[1];

  var resultsState = useState([]);
  var results = resultsState[0];
  var setResults = resultsState[1];

  var loadingState = useState(true);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var filterState = useState(FILTER_ALL);
  var activeFilter = filterState[0];
  var setActiveFilter = filterState[1];

  var radiusState = useState(5000);
  var radius = radiusState[0];
  var setRadius = radiusState[1];

  var selectedState = useState(null);
  var selectedId = selectedState[0];
  var setSelectedId = selectedState[1];

  var cameraRef = useRef(null);
  var errorState = useState(null);
  var error = errorState[0];
  var setError = errorState[1];

  useEffect(function () {
    initLocation();
  }, []);

  useEffect(function () {
    if (location) {
      fetchPOIs();
    }
  }, [location, radius]);

  function initLocation() {
    setLoading(true);
    setError(null);
    Location.requestForegroundPermissionsAsync().then(function (perm) {
      if (perm.status !== 'granted') {
        setError('Permission de localisation requise');
        setLoading(false);
        return;
      }
      return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, timeout: 15000 });
    }).then(function (loc) {
      if (loc) {
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    }).catch(function () {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(function (loc) {
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }).catch(function () {
        setError('Impossible d\'obtenir votre position');
        setLoading(false);
      });
    });
  }

  function fetchPOIs() {
    setLoading(true);
    setError(null);
    var url = buildOverpassUrl(location.latitude, location.longitude, radius);
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var elements = data.elements || [];
        var items = elements.map(function (el) {
          var tags = el.tags || {};
          var dist = getDistance(location.latitude, location.longitude, el.lat, el.lon);
          return {
            id: el.id,
            name: tags.name || 'Sans nom',
            lat: el.lat,
            lon: el.lon,
            category: categorize(tags),
            phone: tags.phone || tags['contact:phone'] || null,
            address: tags['addr:street']
              ? (tags['addr:housenumber'] ? tags['addr:housenumber'] + ' ' : '') + tags['addr:street'] + (tags['addr:city'] ? ', ' + tags['addr:city'] : '')
              : tags['addr:full'] || null,
            distance: dist,
            opening_hours: tags.opening_hours || null,
          };
        });
        items.sort(function (a, b) { return a.distance - b.distance; });
        setResults(items);
        setLoading(false);
      })
      .catch(function () {
        setError('Erreur lors de la recherche');
        setLoading(false);
      });
  }

  function getFiltered() {
    if (activeFilter === FILTER_ALL) return results;
    return results.filter(function (r) { return r.category === activeFilter; });
  }

  function handleCardPress(item) {
    setSelectedId(item.id);
  }

  function handlePhone(phone) {
    Linking.openURL('tel:' + phone.replace(/\s/g, ''));
  }

  function handleDirections(item) {
    var url = Platform.OS === 'ios'
      ? 'maps://app?daddr=' + item.lat + ',' + item.lon
      : 'google.navigation:q=' + item.lat + ',' + item.lon;
    Linking.canOpenURL(url).then(function (supported) {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=' + item.lat + ',' + item.lon);
      }
    });
  }

  function toggleRadius() {
    setRadius(radius === 5000 ? 10000 : 5000);
  }

  var filtered = getFiltered();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={function () { navigation.goBack(); }}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTxt}>Mecaniciens & Pieces auto</Text>
        <TouchableOpacity style={styles.radiusBtn} onPress={toggleRadius}>
          <Text style={styles.radiusTxt}>{radius === 5000 ? '5km' : '10km'}</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === FILTER_ALL && styles.filterTabActive]}
          onPress={function () { setActiveFilter(FILTER_ALL); }}
        >
          <Text style={[styles.filterText, activeFilter === FILTER_ALL && styles.filterTextActive]}>Tous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === FILTER_MECHANICS && styles.filterTabActive]}
          onPress={function () { setActiveFilter(FILTER_MECHANICS); }}
        >
          <Text style={[styles.filterText, activeFilter === FILTER_MECHANICS && styles.filterTextActive]}>Mecaniciens</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, activeFilter === FILTER_PARTS && styles.filterTabActive]}
          onPress={function () { setActiveFilter(FILTER_PARTS); }}
        >
          <Text style={[styles.filterText, activeFilter === FILTER_PARTS && styles.filterTextActive]}>Pieces auto</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {location ? (
          <Map style={styles.map} mapStyle={TERANGO_STYLE} logo={false} attribution={false}>
            <Camera
              ref={cameraRef}
              center={selectedId
                ? (function () { var s = filtered.find(function (r) { return r.id === selectedId; }); return s ? [s.lon, s.lat] : [location.longitude, location.latitude]; })()
                : [location.longitude, location.latitude]}
              zoom={selectedId ? 16 : 13}
            />
            <Marker id="userLocation" lngLat={[location.longitude, location.latitude]}>
              <View style={styles.userMarker}>
                <View style={styles.userMarkerDot} />
              </View>
            </Marker>
            {filtered.map(function (item) {
              var isSelected = item.id === selectedId;
              return (
                <Marker key={item.id} id={'poi-' + item.id} lngLat={[item.lon, item.lat]}>
                  <TouchableOpacity onPress={function () { handleCardPress(item); }}>
                    <View style={[styles.poiMarker, isSelected && styles.poiMarkerSelected, item.category === 'parts' && styles.poiMarkerParts]}>
                      <Text style={styles.poiMarkerEmoji}>{item.category === 'parts' ? '\u2699\uFE0F' : '\uD83D\uDD27'}</Text>
                    </View>
                  </TouchableOpacity>
                </Marker>
              );
            })}
          </Map>
        ) : (
          <View style={styles.mapPlaceholder}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={initLocation}>
                  <Text style={styles.retryText}>Reessayer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <ActivityIndicator size="large" color={COLORS.green} />
                <Text style={styles.loadingText}>Obtention de votre position...</Text>
              </View>
            )}
          </View>
        )}
        {loading && location && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={COLORS.yellow} />
            <Text style={styles.loadingOverlayText}>Recherche en cours...</Text>
          </View>
        )}
      </View>

      {/* Results list */}
      <View style={styles.listContainer}>
        {loading && !location ? null : !loading && filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\uD83D\uDD27'}</Text>
            <Text style={styles.emptyTitle}>Aucun resultat</Text>
            <Text style={styles.emptySub}>{'Aucun ' + (activeFilter === FILTER_PARTS ? 'magasin de pieces' : 'mecanicien') + ' dans un rayon de ' + (radius / 1000) + 'km'}</Text>
            {radius === 5000 && (
              <TouchableOpacity style={styles.expandBtn} onPress={toggleRadius}>
                <Text style={styles.expandBtnText}>Chercher dans 10km</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
            <Text style={styles.resultsCount}>{filtered.length + ' resultat' + (filtered.length !== 1 ? 's' : '') + ' dans ' + (radius / 1000) + 'km'}</Text>
            {filtered.map(function (item) {
              var isSelected = item.id === selectedId;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.resultCard, isSelected && styles.resultCardSelected]}
                  onPress={function () { handleCardPress(item); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.categoryBadge, item.category === 'parts' ? styles.badgeParts : styles.badgeMechanic]}>
                      <Text style={styles.categoryEmoji}>{item.category === 'parts' ? '\u2699\uFE0F' : '\uD83D\uDD27'}</Text>
                      <Text style={styles.categoryText}>{item.category === 'parts' ? 'Pieces' : 'Mecanicien'}</Text>
                    </View>
                    <Text style={styles.distanceText}>{item.distance < 1 ? (item.distance * 1000).toFixed(0) + 'm' : item.distance.toFixed(1) + 'km'}</Text>
                  </View>
                  <Text style={styles.cardName}>{item.name}</Text>
                  {item.address && <Text style={styles.cardAddress}>{item.address}</Text>}
                  {item.opening_hours && <Text style={styles.cardHours}>{'\uD83D\uDD52 ' + item.opening_hours}</Text>}
                  <View style={styles.cardActions}>
                    {item.phone && (
                      <TouchableOpacity style={styles.actionBtn} onPress={function () { handlePhone(item.phone); }}>
                        <Text style={styles.actionEmoji}>{'\uD83D\uDCDE'}</Text>
                        <Text style={styles.actionText}>Appeler</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={function () { handleDirections(item); }}>
                      <Text style={styles.actionEmoji}>{'\uD83D\uDDFA\uFE0F'}</Text>
                      <Text style={[styles.actionText, styles.actionTextPrimary]}>Itineraire</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 30 }} />
          </ScrollView>
        )}
      </View>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.darkBg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: COLORS.darkCard, borderBottomWidth: 1, borderBottomColor: COLORS.darkCardBorder,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  backArrow: { fontSize: 24, color: COLORS.green, fontFamily: 'LexendDeca_400Regular' },
  headerTxt: { fontSize: 17, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, letterSpacing: 0.3, flex: 1, textAlign: 'center' },
  radiusBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
    backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
  },
  radiusTxt: { fontSize: 13, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.yellow },

  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    backgroundColor: COLORS.darkBg,
  },
  filterTab: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  filterTabActive: {
    backgroundColor: 'rgba(212,175,55,0.2)', borderColor: 'rgba(212,175,55,0.5)',
  },
  filterText: { fontSize: 13, fontFamily: 'LexendDeca_500Medium', color: COLORS.textLightMuted },
  filterTextActive: { color: COLORS.yellow, fontFamily: 'LexendDeca_600SemiBold' },

  mapContainer: { height: 240, position: 'relative' },
  map: { flex: 1 },
  mapPlaceholder: { flex: 1, backgroundColor: COLORS.darkBg2, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textLightSub, fontSize: 14, marginTop: 12, fontFamily: 'LexendDeca_400Regular' },
  loadingOverlay: {
    position: 'absolute', top: 10, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,36,24,0.9)', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.darkCardBorder,
  },
  loadingOverlayText: { color: COLORS.textLightSub, fontSize: 12, fontFamily: 'LexendDeca_500Medium' },

  userMarker: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(33,150,243,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  userMarkerDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2196F3', borderWidth: 2, borderColor: '#fff' },

  poiMarker: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,133,63,0.9)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.green,
  },
  poiMarkerSelected: {
    backgroundColor: 'rgba(212,175,55,0.9)', borderColor: COLORS.yellow,
    width: 44, height: 44, borderRadius: 22,
  },
  poiMarkerParts: { backgroundColor: 'rgba(33,150,243,0.9)', borderColor: '#2196F3' },
  poiMarkerEmoji: { fontSize: 16 },

  listContainer: { flex: 1, backgroundColor: COLORS.darkBg },
  resultsList: { flex: 1, paddingHorizontal: 16 },
  resultsCount: { fontSize: 12, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular', marginTop: 12, marginBottom: 8, paddingHorizontal: 4 },

  resultCard: {
    backgroundColor: COLORS.darkCard, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.darkCardBorder, elevation: 4,
  },
  resultCardSelected: { borderColor: COLORS.yellow, backgroundColor: 'rgba(0,51,34,0.95)' },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, gap: 4,
  },
  badgeMechanic: { backgroundColor: 'rgba(0,133,63,0.15)' },
  badgeParts: { backgroundColor: 'rgba(33,150,243,0.15)' },
  categoryEmoji: { fontSize: 12 },
  categoryText: { fontSize: 11, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightSub },
  distanceText: { fontSize: 13, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },

  cardName: { fontSize: 16, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLight, marginBottom: 4 },
  cardAddress: { fontSize: 12, fontFamily: 'LexendDeca_400Regular', color: COLORS.textLightSub, marginBottom: 4 },
  cardHours: { fontSize: 11, fontFamily: 'LexendDeca_400Regular', color: COLORS.textLightMuted, marginBottom: 8 },

  cardActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  actionBtnPrimary: { backgroundColor: 'rgba(212,175,55,0.15)', borderColor: 'rgba(212,175,55,0.3)' },
  actionEmoji: { fontSize: 14 },
  actionText: { fontSize: 12, fontFamily: 'LexendDeca_500Medium', color: COLORS.textLightSub },
  actionTextPrimary: { color: COLORS.yellow },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 6 },
  emptySub: { fontSize: 13, fontFamily: 'LexendDeca_400Regular', color: COLORS.textLightMuted, textAlign: 'center', paddingHorizontal: 30 },
  expandBtn: {
    marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
  },
  expandBtnText: { fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.yellow },

  errorBox: { alignItems: 'center' },
  errorText: { fontSize: 14, fontFamily: 'LexendDeca_500Medium', color: COLORS.red, marginBottom: 12, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(0,133,63,0.2)', borderWidth: 1, borderColor: 'rgba(0,133,63,0.4)',
  },
  retryText: { fontSize: 14, fontFamily: 'LexendDeca_500Medium', color: COLORS.green },
});

export default MechanicsScreen;
