import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Map, Camera, Marker } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import COLORS from '../constants/colors';

const TERANGO_STYLE = require('../constants/terangoMapStyle.json');
const GEOCODE_URL = 'https://geocode.terango.sn';

const ConfirmDropoffScreen = ({ route, navigation }) => {
  const { pickup, dropoff } = route.params || {};
  if (!dropoff || !dropoff.coordinates) {
    return (<View style={{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#d4f0c8'}}><Text style={{fontSize:16,color:'#1A1A1A'}}>Chargement...</Text></View>);
  }
  const [pin, setPin] = useState({
    latitude: dropoff.coordinates.latitude,
    longitude: dropoff.coordinates.longitude,
  });
  const [address, setAddress] = useState(dropoff.address);
  const [loading, setLoading] = useState(false);
  const cameraRef = useRef(null);

  

  React.useEffect(() => {
    setTimeout(() => {
      if (cameraRef.current) {
        var lat = dropoff.coordinates.latitude;
        var lon = dropoff.coordinates.longitude;
        var delta = 0.005;
        cameraRef.current.fitBounds(
          [lon - delta, lat - delta, lon + delta, lat + delta],
          {top: 120, right: 50, bottom: 200, left: 50},
          500
        );
      }
    }, 800);
  }, []);

  const reverseGeocode = useCallback(async (lat, lon) => {
    setLoading(true);
    try {
      var url = GEOCODE_URL + '/reverse?lat=' + lat + '&lon=' + lon + '&format=json&addressdetails=1&accept-language=fr';
      var resp = await fetch(url);
      var data = await resp.json();
      if (data && data.address) {
        var addr = data.address;
        var name = addr.tourism || addr.amenity || addr.shop || addr.building || addr.road || '';
        var houseNumber = addr.house_number || '';
        var road = addr.road || '';
        var neighbourhood = addr.neighbourhood || addr.suburb || '';
        var city = addr.city || addr.town || addr.village || '';
        var parts = [];
        if (houseNumber && road) { parts.push(houseNumber + ' ' + road); }
        else if (name) { parts.push(name); }
        else if (road) { parts.push(road); }
        if (neighbourhood && neighbourhood !== name) parts.push(neighbourhood);
        if (city) parts.push(city);
        setAddress(parts.join(', ') || data.display_name.split(', ').slice(0, 3).join(', '));
      }
    } catch (e) {
      console.log('Reverse geocode error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMapPress = (event) => {
    try {
      var lngLat = event?.nativeEvent?.lngLat;
      if (!lngLat) return;
      var lon = lngLat[0];
      var lat = lngLat[1];
      setPin({ latitude: lat, longitude: lon });
      reverseGeocode(lat, lon);
    } catch (e) {
      console.log('Map press error:', e);
    }
  };

  const handleConfirm = () => {
    navigation.navigate('RideSelection', {
      pickup: pickup,
      dropoff: {
        address: address,
        coordinates: { latitude: pin.latitude, longitude: pin.longitude },
      },
    });
  };

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={TERANGO_STYLE}
        logo={false}
        attribution={false}
        onPress={handleMapPress}
      >
        <Camera
          ref={cameraRef}
          center={[dropoff.coordinates.longitude, dropoff.coordinates.latitude]}
          zoom={16}
        />
        <Marker id="dropoff-pin" lngLat={[pin.longitude, pin.latitude]}>
          <View style={styles.markerContainer}>
            <View style={styles.markerPin}>
              <Text style={styles.markerIcon}>{'\uD83D\uDCCD'}</Text>
            </View>
            <View style={styles.markerShadow} />
          </View>
        </Marker>
      </Map>

      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Confirmez la destination</Text>
      </View>

      {/* Instruction */}
      <View style={styles.instructionBadge}>
        <Text style={styles.instructionText}>Touchez la carte pour ajuster</Text>
      </View>

      {/* Bottom card */}
      <View style={styles.bottomCard}>
        <View style={styles.addressRow}>
          <View style={styles.redDot} />
          <View style={styles.addressTextWrap}>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.green} />
            ) : (
              <>
                <Text style={styles.addressPrimary} numberOfLines={2}>{address}</Text>
                <Text style={styles.coordsText}>
                  {pin.latitude.toFixed(5) + ', ' + pin.longitude.toFixed(5)}
                </Text>
              </>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} disabled={loading}>
          <Text style={styles.confirmText}>Confirmer la destination</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  topBar: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    marginRight: 12,
  },
  backIcon: { fontSize: 22, color: COLORS.darkBg },
  topTitle: {
    fontSize: 17,
    fontFamily: 'LexendDeca_600SemiBold',
    color: COLORS.darkBg,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    overflow: 'hidden',
  },

  instructionBadge: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,36,24,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  instructionText: {
    fontSize: 13,
    color: COLORS.white,
    fontFamily: 'LexendDeca_400Regular',
  },

  markerContainer: { alignItems: 'center', width: 60, height: 70 },
  markerPin: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  markerIcon: { fontSize: 26, color: '#FFFFFF' },
  markerShadow: {
    width: 20,
    height: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginTop: 4,
  },

  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  redDot: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: COLORS.red,
    marginTop: 4,
    marginRight: 14,
  },
  addressTextWrap: { flex: 1 },
  addressPrimary: {
    fontSize: 17,
    fontFamily: 'LexendDeca_600SemiBold',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  coordsText: {
    fontSize: 13,
    fontFamily: 'LexendDeca_400Regular',
    color: COLORS.textDarkSub,
  },
  confirmButton: {
    backgroundColor: COLORS.green,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    elevation: 4,
  },
  confirmText: {
    fontSize: 17,
    fontFamily: 'LexendDeca_700Bold',
    color: COLORS.white,
  },
});

export default ConfirmDropoffScreen;

















