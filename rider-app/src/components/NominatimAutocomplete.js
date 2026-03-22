import React, { useState, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, Keyboard, StyleSheet, ScrollView } from 'react-native';
import COLORS from '../constants/colors';

const GEOCODE_URL = 'https://geocode.terango.sn';

const POPULAR_PLACES = [
  { primary: 'Aeroport Blaise Diagne (AIBD)', secondary: 'Diass, Thies', coordinates: { latitude: 14.6697, longitude: -17.0734 }, geometry: { location: { lat: 14.6697, lng: -17.0734 } }, type: 'aerodrome' },
  { primary: 'Monument de la Renaissance', secondary: 'Ouakam, Dakar', coordinates: { latitude: 14.7225, longitude: -17.4929 }, geometry: { location: { lat: 14.7225, lng: -17.4929 } }, type: 'attraction' },
  { primary: 'Place de l\'Independance', secondary: 'Plateau, Dakar', coordinates: { latitude: 14.6693, longitude: -17.4380 }, geometry: { location: { lat: 14.6693, lng: -17.4380 } }, type: 'attraction' },
  { primary: 'Marche Sandaga', secondary: 'Plateau, Dakar', coordinates: { latitude: 14.6699, longitude: -17.4377 }, geometry: { location: { lat: 14.6699, lng: -17.4377 } }, type: 'marketplace' },
  { primary: 'Marche Kermel', secondary: 'Plateau, Dakar', coordinates: { latitude: 14.6667, longitude: -17.4349 }, geometry: { location: { lat: 14.6667, lng: -17.4349 } }, type: 'marketplace' },
  { primary: 'Marche HLM', secondary: 'HLM, Dakar', coordinates: { latitude: 14.6908, longitude: -17.4458 }, geometry: { location: { lat: 14.6908, lng: -17.4458 } }, type: 'marketplace' },
  { primary: 'Marche Colobane', secondary: 'Colobane, Dakar', coordinates: { latitude: 14.6850, longitude: -17.4483 }, geometry: { location: { lat: 14.6850, lng: -17.4483 } }, type: 'marketplace' },
  { primary: 'Marche Tilene', secondary: 'Medina, Dakar', coordinates: { latitude: 14.6750, longitude: -17.4417 }, geometry: { location: { lat: 14.6750, lng: -17.4417 } }, type: 'marketplace' },
  { primary: 'Universite Cheikh Anta Diop', secondary: 'Fann, Dakar', coordinates: { latitude: 14.6937, longitude: -17.4616 }, geometry: { location: { lat: 14.6937, lng: -17.4616 } }, type: 'university' },
  { primary: 'Hopital Principal', secondary: 'Plateau, Dakar', coordinates: { latitude: 14.6645, longitude: -17.4350 }, geometry: { location: { lat: 14.6645, lng: -17.4350 } }, type: 'hospital' },
  { primary: 'Hopital de Fann', secondary: 'Point E, Dakar', coordinates: { latitude: 14.6934, longitude: -17.4479 }, geometry: { location: { lat: 14.6934, lng: -17.4479 } }, type: 'hospital' },
  { primary: 'Hopital Aristide Le Dantec', secondary: 'Plateau, Dakar', coordinates: { latitude: 14.6700, longitude: -17.4410 }, geometry: { location: { lat: 14.6700, lng: -17.4410 } }, type: 'hospital' },
  { primary: 'Gare Routiere Pompiers', secondary: 'Colobane, Dakar', coordinates: { latitude: 14.6833, longitude: -17.4500 }, geometry: { location: { lat: 14.6833, lng: -17.4500 } }, type: 'bus_station' },
  { primary: 'Gare des Baux Maraichers', secondary: 'Pikine, Dakar', coordinates: { latitude: 14.7486, longitude: -17.3918 }, geometry: { location: { lat: 14.7486, lng: -17.3918 } }, type: 'bus_station' },
  { primary: 'Sea Plaza', secondary: 'Corniche, Dakar', coordinates: { latitude: 14.6892, longitude: -17.4675 }, geometry: { location: { lat: 14.6892, lng: -17.4675 } }, type: 'mall' },
  { primary: 'Sacre Coeur 3', secondary: 'Mermoz, Dakar', coordinates: { latitude: 14.7205, longitude: -17.4679 }, geometry: { location: { lat: 14.7205, lng: -17.4679 } }, type: 'neighbourhood' },
  { primary: 'Almadies', secondary: 'Dakar', coordinates: { latitude: 14.7453, longitude: -17.5078 }, geometry: { location: { lat: 14.7453, lng: -17.5078 } }, type: 'neighbourhood' },
  { primary: 'Ngor', secondary: 'Dakar', coordinates: { latitude: 14.7486, longitude: -17.5155 }, geometry: { location: { lat: 14.7486, lng: -17.5155 } }, type: 'neighbourhood' },
  { primary: 'Ouakam', secondary: 'Dakar', coordinates: { latitude: 14.7258, longitude: -17.4856 }, geometry: { location: { lat: 14.7258, lng: -17.4856 } }, type: 'neighbourhood' },
  { primary: 'Medina', secondary: 'Dakar', coordinates: { latitude: 14.6775, longitude: -17.4442 }, geometry: { location: { lat: 14.6775, lng: -17.4442 } }, type: 'neighbourhood' },
  { primary: 'Parcelles Assainies', secondary: 'Dakar', coordinates: { latitude: 14.7600, longitude: -17.4200 }, geometry: { location: { lat: 14.7600, lng: -17.4200 } }, type: 'neighbourhood' },
  { primary: 'Keur Massar', secondary: 'Dakar', coordinates: { latitude: 14.7823, longitude: -17.3112 }, geometry: { location: { lat: 14.7823, lng: -17.3112 } }, type: 'neighbourhood' },
  { primary: 'Pikine', secondary: 'Dakar', coordinates: { latitude: 14.7575, longitude: -17.3900 }, geometry: { location: { lat: 14.7575, lng: -17.3900 } }, type: 'neighbourhood' },
  { primary: 'Guediawaye', secondary: 'Dakar', coordinates: { latitude: 14.7725, longitude: -17.3853 }, geometry: { location: { lat: 14.7725, lng: -17.3853 } }, type: 'neighbourhood' },
  { primary: 'Rufisque', secondary: 'Dakar', coordinates: { latitude: 14.7164, longitude: -17.2738 }, geometry: { location: { lat: 14.7164, lng: -17.2738 } }, type: 'neighbourhood' },
  { primary: 'Thiaroye', secondary: 'Dakar', coordinates: { latitude: 14.7479, longitude: -17.3252 }, geometry: { location: { lat: 14.7479, lng: -17.3252 } }, type: 'neighbourhood' },
  { primary: 'Diamaguene', secondary: 'Dakar', coordinates: { latitude: 14.7671, longitude: -17.3507 }, geometry: { location: { lat: 14.7671, lng: -17.3507 } }, type: 'neighbourhood' },
  { primary: 'Grand Yoff', secondary: 'Dakar', coordinates: { latitude: 14.7358, longitude: -17.4378 }, geometry: { location: { lat: 14.7358, lng: -17.4378 } }, type: 'neighbourhood' },
  { primary: 'Yoff', secondary: 'Dakar', coordinates: { latitude: 14.7525, longitude: -17.4700 }, geometry: { location: { lat: 14.7525, lng: -17.4700 } }, type: 'neighbourhood' },
  { primary: 'Mamelles', secondary: 'Dakar', coordinates: { latitude: 14.7283, longitude: -17.5017 }, geometry: { location: { lat: 14.7283, lng: -17.5017 } }, type: 'neighbourhood' },
  { primary: 'Point E', secondary: 'Dakar', coordinates: { latitude: 14.6933, longitude: -17.4600 }, geometry: { location: { lat: 14.6933, lng: -17.4600 } }, type: 'neighbourhood' },
  { primary: 'Fann', secondary: 'Dakar', coordinates: { latitude: 14.6950, longitude: -17.4633 }, geometry: { location: { lat: 14.6950, lng: -17.4633 } }, type: 'neighbourhood' },
  { primary: 'Liberte 6', secondary: 'Dakar', coordinates: { latitude: 14.7100, longitude: -17.4517 }, geometry: { location: { lat: 14.7100, lng: -17.4517 } }, type: 'neighbourhood' },
  { primary: 'Mermoz', secondary: 'Dakar', coordinates: { latitude: 14.7133, longitude: -17.4700 }, geometry: { location: { lat: 14.7133, lng: -17.4700 } }, type: 'neighbourhood' },
  { primary: 'Plateau', secondary: 'Dakar', coordinates: { latitude: 14.6700, longitude: -17.4383 }, geometry: { location: { lat: 14.6700, lng: -17.4383 } }, type: 'neighbourhood' },
];

const COMMON_TYPOS = {
  'universite': 'universit\u00e9',
  'hopital': 'h\u00f4pital',
  'aeroport': 'a\u00e9roport',
  'marche': 'march\u00e9',
  'mosquee': 'mosqu\u00e9e',
  'medina': 'm\u00e9dina',
  'ecole': '\u00e9cole',
  'lycee': 'lyc\u00e9e',
  'bibliotheque': 'biblioth\u00e8que',
};

const fixAccents = (text) => {
  var lower = text.toLowerCase();
  Object.keys(COMMON_TYPOS).forEach(function(key) {
    if (lower.includes(key)) lower = lower.replace(key, COMMON_TYPOS[key]);
  });
  return lower;
};

const formatAddress = (item) => {
  var addr = item.address || {};
  var name = addr.tourism || addr.amenity || addr.shop || addr.building || addr.aeroway || '';
  var road = addr.road || '';
  var houseNumber = addr.house_number || '';
  var neighbourhood = addr.neighbourhood || addr.suburb || '';
  var city = addr.city || addr.town || addr.village || '';

  var primary = '';
  if (name) { primary = name; }
  else if (houseNumber && road) { primary = houseNumber + ' ' + road; }
  else if (road) { primary = road; }
  else { var parts = item.display_name.split(', '); primary = parts[0] || ''; }

  var secondaryParts = [];
  if (road && road !== primary) secondaryParts.push(road);
  if (neighbourhood && neighbourhood !== primary && !neighbourhood.startsWith('Commune') && !neighbourhood.startsWith('Arrondissement')) secondaryParts.push(neighbourhood);
  if (city && city !== primary && !city.startsWith('Commune')) secondaryParts.push(city);

  if (secondaryParts.length === 0) {
    var cleanParts = item.display_name.split(', ').filter(function(p) {
      return p !== primary && !p.startsWith('Commune') && !p.startsWith('Arrondissement') && !p.startsWith('D\u00e9partement') && !p.startsWith('R\u00e9gion') && p !== 'S\u00e9n\u00e9gal' && !/^\d{5}$/.test(p);
    });
    secondaryParts = cleanParts.slice(0, 2);
  }

  return { primary: primary.trim(), secondary: secondaryParts.join(', ').trim() };
};

const dedup = (items) => {
  var seen = {};
  return items.filter(function(item) {
    var key = item.primary + '|' + Math.round(item.coordinates.latitude * 1000) + ',' + Math.round(item.coordinates.longitude * 1000);
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
};

const getIcon = (item) => {
  var k = (item.class || '') + '|' + (item.type || '');
  if (k.includes('hospital') || k.includes('pharmacy') || k.includes('clinic')) return '\uD83C\uDFE5';
  if (k.includes('school') || k.includes('university') || k.includes('college')) return '\uD83C\uDF93';
  if (k.includes('worship') || k.includes('mosque')) return '\uD83D\uDD4C';
  if (k.includes('restaurant') || k.includes('cafe') || k.includes('fast_food')) return '\uD83C\uDF74';
  if (k.includes('aerodrome') || k.includes('aeroway')) return '\u2708\uFE0F';
  if (k.includes('shop') || k.includes('market') || k.includes('supermarket') || k.includes('mall')) return '\uD83D\uDED2';
  if (k.includes('tourism') || k.includes('attraction') || k.includes('hotel')) return '\u2B50';
  if (k.includes('bus') || k.includes('station')) return '\uD83D\uDE8F';
  if (k.includes('highway') || k.includes('road')) return '\uD83D\uDEE3\uFE0F';
  return '\uD83D\uDCCD';
};

const NominatimAutocomplete = ({ placeholder, onSelect, onPress, autoFocus, defaultValue, onResultsChange }) => {
  const [query, setQuery] = useState(defaultValue || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPopular, setShowPopular] = useState(false);
  const debounceRef = useRef(null);

  const updateResults = (items) => {
    setResults(items);
    if (onResultsChange) onResultsChange(items.length > 0);
  };

  const handleFocus = () => {
    if (!query && results.length === 0) setShowPopular(true);
  };

  const search = useCallback((text) => {
    setQuery(text);
    setShowPopular(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) {
      var earlyMatches = POPULAR_PLACES.filter(function(p) { return p.primary.toLowerCase().includes(text.toLowerCase()); }).map(function(p) { return Object.assign({}, p, { address: p.primary + ', ' + p.secondary, description: p.primary + ', ' + p.secondary }); });
      if (earlyMatches.length > 0) { updateResults(earlyMatches); } else { updateResults([]); }
      if (!text) setShowPopular(true);
      return;
    }

    // Filter popular places that match
    var matchedPopular = POPULAR_PLACES.filter(function(p) {
      return p.primary.toLowerCase().includes(text.toLowerCase());
    }).map(function(p) {
      return Object.assign({}, p, { address: p.primary + ', ' + p.secondary, description: p.primary + ', ' + p.secondary });
    });

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        var fixedText = fixAccents(text);
        var url = GEOCODE_URL + '/search?q=' + encodeURIComponent(fixedText) + '&format=json&limit=8&accept-language=fr&countrycodes=sn&addressdetails=1&viewbox=-17.6,14.85,-17.1,14.55&bounded=1';
        var resp = await fetch(url);
        var data = await resp.json();

        var items = data.map(function(r) {
          var fmt = formatAddress(r);
          var fullAddress = fmt.primary + (fmt.secondary ? ', ' + fmt.secondary : '');
          return {
            address: fullAddress, coordinates: { latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) },
            primary: fmt.primary, secondary: fmt.secondary, description: fullAddress,
            geometry: { location: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) } },
            class: r.class || '', type: r.type || '',
          };
        });

        // If we got a location result, also search for POIs near it
        if (items.length > 0 && text.length >= 4) {
          var topResult = items[0];
          var lat = topResult.coordinates.latitude;
          var lon = topResult.coordinates.longitude;
          var delta = 0.01;
          var poiUrl = GEOCODE_URL + '/search?q=' + encodeURIComponent(text) + '&format=json&limit=5&accept-language=fr&countrycodes=sn&addressdetails=1&viewbox=' + (lon - delta) + ',' + (lat + delta) + ',' + (lon + delta) + ',' + (lat - delta) + '&bounded=1';
          try {
            var poiResp = await fetch(poiUrl);
            var poiData = await poiResp.json();
            var poiItems = poiData.map(function(r) {
              var fmt = formatAddress(r);
              var fullAddress = fmt.primary + (fmt.secondary ? ', ' + fmt.secondary : '');
              return {
                address: fullAddress, coordinates: { latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) },
                primary: fmt.primary, secondary: fmt.secondary, description: fullAddress,
                geometry: { location: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) } },
                class: r.class || '', type: r.type || '',
              };
            });
            items = items.concat(poiItems);
          } catch (e) {}
        }

        // Merge popular matches at the top
        items = matchedPopular.concat(items);
        items = dedup(items);

        if (items.length === 0 && fixedText !== text.toLowerCase()) {
          var url2 = GEOCODE_URL + '/search?q=' + encodeURIComponent(text) + '&format=json&limit=8&accept-language=fr&countrycodes=sn&addressdetails=1&viewbox=-17.6,14.85,-17.1,14.55&bounded=1';
          var resp2 = await fetch(url2);
          var data2 = await resp2.json();
          items = data2.map(function(r) {
            var fmt = formatAddress(r);
            var fullAddress = fmt.primary + (fmt.secondary ? ', ' + fmt.secondary : '');
            return {
              address: fullAddress, coordinates: { latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) },
              primary: fmt.primary, secondary: fmt.secondary, description: fullAddress,
              geometry: { location: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) } },
              class: r.class || '', type: r.type || '',
            };
          });
          items = dedup(items);
        }

        updateResults(items.slice(0, 10));
      } catch (e) {
        console.log('Geocode search error:', e);
        updateResults(matchedPopular);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleSelect = (item) => {
    setQuery(item.address || item.primary);
    updateResults([]);
    setShowPopular(false);
    Keyboard.dismiss();
    var cb = onSelect || onPress;
    if (cb) cb({ description: item.address || item.primary, geometry: item.geometry }, { geometry: item.geometry });
  };

  const renderItem = (item, index, total) => (
    <TouchableOpacity key={index} style={[styles.resultItem, index === total - 1 && { borderBottomWidth: 0 }]} onPress={() => handleSelect(item)}>
      <View style={styles.iconWrap}>
        <Text style={styles.iconText}>{getIcon(item)}</Text>
      </View>
      <View style={styles.resultTextWrap}>
        <Text style={styles.resultPrimary} numberOfLines={1}>{item.primary}</Text>
        {item.secondary ? <Text style={styles.resultSecondary} numberOfLines={1}>{item.secondary}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={'rgba(255,255,255,0.35)'}
          value={query}
          onChangeText={search}
          autoFocus={autoFocus}
          selectTextOnFocus={true}
          onFocus={handleFocus}
        />
        {loading && <ActivityIndicator size="small" color={COLORS.yellow} style={styles.loader} />}
      </View>
      {showPopular && !query && (
        <View>
          <Text style={styles.sectionLabel}>Destinations populaires</Text>
          {POPULAR_PLACES.slice(0, 6).map(function(item, index) {
            return renderItem(item, index, 6);
          })}
        </View>
      )}
      {results.length > 0 && results.map(function(item, index) {
        return renderItem(item, index, results.length);
      })}
    </View>
  );
};

var styles = StyleSheet.create({
  inputContainer: { position: 'relative' },
  input: {
    fontSize: 16, color: '#FFFFFF', paddingVertical: 14, paddingHorizontal: 16, paddingRight: 40,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)', fontFamily: 'LexendDeca_400Regular', minHeight: 50,
  },
  loader: { position: 'absolute', right: 14, top: 16 },
  sectionLabel: {
    fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'LexendDeca_500Medium',
    textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 6, paddingTop: 12, paddingBottom: 6,
  },
  resultItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  iconText: { fontSize: 18 },
  resultTextWrap: { flex: 1 },
  resultPrimary: { fontSize: 15, color: '#FFFFFF', fontFamily: 'LexendDeca_500Medium' },
  resultSecondary: { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'LexendDeca_400Regular', marginTop: 2 },
});

export default NominatimAutocomplete;






