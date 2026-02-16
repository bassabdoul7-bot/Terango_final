import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, StatusBar, Image } from 'react-native';
import COLORS from '../constants/colors';
import { rideService } from '../services/api.service';

function RatingScreen(props) {
  var navigation = props.navigation;
  var route = props.route;
  var ride = route.params ? route.params.ride : null;

  var ratingState = useState(0); var rating = ratingState[0]; var setRating = ratingState[1];
  var reviewState = useState(''); var review = reviewState[0]; var setReview = reviewState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];

  var driverName = 'Chauffeur'; var driverPhoto = null; var driverRating = '5.0'; var vehicleInfo = ''; var fare = 0;
  if (ride) {
    if (ride.driver && ride.driver.userId) { driverName = ride.driver.userId.name || 'Chauffeur'; driverPhoto = ride.driver.userId.profilePhoto || null; driverRating = ride.driver.userId.rating ? ride.driver.userId.rating.toFixed(1) : '5.0'; }
    if (ride.driver && ride.driver.vehicle) { vehicleInfo = (ride.driver.vehicle.make || '') + ' ' + (ride.driver.vehicle.model || '') + ' • ' + (ride.driver.vehicle.color || ''); }
    fare = ride.fare || 0;
  }

  function submitRating() {
    if (rating === 0) { Alert.alert('Note requise', 'Veuillez donner une note à votre chauffeur.'); return; }
    setLoading(true);
    var rideId = ride ? ride._id : null;
    if (!rideId) { navigation.replace('Home'); return; }
    rideService.rateRide(rideId, rating, review).then(function(response) {
      setLoading(false);
      if (response.success) { Alert.alert('Merci!', 'Votre note a été enregistrée.', [{ text: 'OK', onPress: function() { navigation.replace('Home'); } }]); }
      else { Alert.alert('Erreur', response.message || 'Impossible de soumettre la note.'); }
    }).catch(function(error) { setLoading(false); console.log('Rating error:', error); navigation.replace('Home'); });
  }

  function renderStar(index) {
    var filled = index <= rating;
    return (<TouchableOpacity key={index} onPress={function() { setRating(index); }} style={styles.starTouch}><Text style={[styles.star, filled && styles.starFilled]}>★</Text></TouchableOpacity>);
  }

  function renderDriverAvatar() {
    if (driverPhoto) { return React.createElement(Image, { source: { uri: driverPhoto }, style: styles.driverPhoto }); }
    return (<View style={styles.driverAvatarFallback}><Text style={styles.driverAvatarLetter}>{driverName.charAt(0).toUpperCase()}</Text></View>);
  }

  function getRatingLabel() {
    switch (rating) { case 1: return 'Très mauvais'; case 2: return 'Mauvais'; case 3: return 'Correct'; case 4: return 'Bien'; case 5: return 'Excellent!'; default: return 'Notez votre chauffeur'; }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.successBanner}><Text style={styles.successIcon}>✔</Text><Text style={styles.successTitle}>Course terminée!</Text><Text style={styles.successFare}>{fare.toLocaleString() + ' FCFA'}</Text></View>
      <View style={styles.driverCard}>
        {renderDriverAvatar()}
        <Text style={styles.driverName}>{driverName}</Text>
        <Text style={styles.driverMeta}>{'⭐ ' + driverRating}</Text>
        {vehicleInfo ? <Text style={styles.vehicleText}>{vehicleInfo}</Text> : null}
      </View>
      <Text style={styles.ratingPrompt}>{getRatingLabel()}</Text>
      <View style={styles.starsRow}>{[1, 2, 3, 4, 5].map(function(i) { return renderStar(i); })}</View>
      <TextInput style={styles.reviewInput} placeholder="Commentaire (optionnel)" placeholderTextColor={COLORS.textDarkMuted} value={review} onChangeText={setReview} multiline={true} maxLength={200} />
      <TouchableOpacity style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]} onPress={submitRating} disabled={loading}><Text style={styles.submitBtnText}>{loading ? 'Envoi...' : 'Soumettre'}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.skipBtn} onPress={function() { navigation.replace('Home'); }}><Text style={styles.skipBtnText}>Passer</Text></TouchableOpacity>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 24, paddingTop: 80, alignItems: 'center' },
  successBanner: { alignItems: 'center', marginBottom: 32 },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.green, textAlign: 'center', lineHeight: 64, fontSize: 32, color: '#fff', overflow: 'hidden', marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '700', color: COLORS.textDark, marginBottom: 8 },
  successFare: { fontSize: 32, fontWeight: 'bold', color: COLORS.darkBg },
  driverCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 24, alignItems: 'center', width: '100%', marginBottom: 32, borderWidth: 1, borderColor: COLORS.darkCardBorder, elevation: 8 },
  driverPhoto: { width: 72, height: 72, borderRadius: 36, marginBottom: 12, backgroundColor: COLORS.darkCardLight },
  driverAvatarFallback: { width: 72, height: 72, borderRadius: 36, marginBottom: 12, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  driverAvatarLetter: { fontSize: 30, fontWeight: 'bold', color: COLORS.textLight },
  driverName: { fontSize: 20, fontWeight: '700', color: COLORS.textLight, marginBottom: 4 },
  driverMeta: { fontSize: 14, color: COLORS.textLightSub, marginBottom: 4 },
  vehicleText: { fontSize: 13, color: COLORS.textLightMuted },
  ratingPrompt: { fontSize: 18, fontWeight: '600', color: COLORS.textDark, marginBottom: 16, textAlign: 'center' },
  starsRow: { flexDirection: 'row', marginBottom: 24 },
  starTouch: { padding: 8 },
  star: { fontSize: 44, color: COLORS.grayLight },
  starFilled: { color: COLORS.yellow },
  reviewInput: { width: '100%', minHeight: 80, backgroundColor: COLORS.backgroundWhite, borderRadius: 16, borderWidth: 1, borderColor: COLORS.grayLight, padding: 16, color: COLORS.textDark, fontSize: 15, textAlignVertical: 'top', marginBottom: 24 },
  submitBtn: { width: '100%', padding: 18, borderRadius: 16, backgroundColor: COLORS.green, alignItems: 'center', marginBottom: 12 },
  submitBtnDisabled: { backgroundColor: 'rgba(0, 133, 63, 0.3)' },
  submitBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.textLight },
  skipBtn: { padding: 16 },
  skipBtnText: { fontSize: 15, color: COLORS.textDarkMuted },
});

export default RatingScreen;
