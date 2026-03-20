import React, { useState, useRef, useCallback } from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, Keyboard, StyleSheet } from 'react-native';
import COLORS from '../constants/colors';

const GEOCODE_URL = 'https://geocode.terango.sn';

const NominatimAutocomplete = ({ placeholder, onSelect, onPress, autoFocus, defaultValue, style, inputStyle, listStyle, styles: customStyles }) => {
  const [query, setQuery] = useState(defaultValue || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback((text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        var url = GEOCODE_URL + '/search?q=' + encodeURIComponent(text) + '&format=json&limit=5&accept-language=fr&countrycodes=sn';
        var resp = await fetch(url);
        var data = await resp.json();
        var items = data.map(function(r) {
          var parts = r.display_name.split(', ');
          return {
            address: parts.slice(0, 3).join(', '),
            coordinates: { latitude: parseFloat(r.lat), longitude: parseFloat(r.lon) },
            name: parts[0] || '',
            city: parts[2] || parts[1] || '',
            description: parts.slice(0, 3).join(', '),
            geometry: { location: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) } }
          };
        });
        setResults(items);
      } catch (e) {
        console.log('Geocode search error:', e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  return (
    <View style={[styles.container, style, customStyles?.container]}>
      <TextInput
        style={[styles.input, inputStyle, customStyles?.textInput]}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textDarkMuted}
        value={query}
        onChangeText={search}
        autoFocus={autoFocus}
      />
      {loading && <ActivityIndicator size="small" color={COLORS.green} style={{ marginTop: 4 }} />}
      {results.length > 0 && (
        <View style={[styles.list, listStyle, customStyles?.listView]}>
          {results.map(function(item, index) {
            return (
              <TouchableOpacity
                key={index}
                style={styles.item}
                onPress={function() {
                  setQuery(item.address);
                  setResults([]);
                  Keyboard.dismiss();
                  var cb = onSelect || onPress; if (cb) cb({ description: item.address, geometry: item.geometry }, { geometry: item.geometry });
                }}
              >
                <Text style={styles.itemName} numberOfLines={1}>{item.name || item.address}</Text>
                <Text style={styles.itemCity} numberOfLines={1}>{item.city}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1 },
  input: { fontSize: 16, color: COLORS.textDark, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontFamily: 'LexendDeca_400Regular' },
  list: { marginTop: 8, backgroundColor: COLORS.darkCard, borderRadius: 12, borderWidth: 1, borderColor: COLORS.darkCardBorder, maxHeight: 250 },
  item: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  itemName: { fontSize: 15, color: COLORS.textDark, fontFamily: 'LexendDeca_500Medium' },
  itemCity: { fontSize: 13, color: COLORS.textDarkSub, fontFamily: 'LexendDeca_400Regular', marginTop: 2 },
});

export default NominatimAutocomplete;
