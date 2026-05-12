import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, StatusBar, Image, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import COLORS from '../constants/colors';
import { rideService, deliveryService } from '../services/api.service';

function StrokedAmount(props) {
  var fontSize = props.fontSize || 52;
  var text = (props.amount || 0).toLocaleString() + ' FCFA';
  var base = { fontFamily: 'Anton_400Regular', fontSize: fontSize, color: '#FFFFFF', fontStyle: 'italic', letterSpacing: 1 };
  var stroke = Object.assign({}, base, { color: '#000000', position: 'absolute' });
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={[stroke, { top: -1 }]} numberOfLines={1}>{text}</Text>
      <Text style={[stroke, { top: 1 }]} numberOfLines={1}>{text}</Text>
      <Text style={[stroke, { left: -1 }]} numberOfLines={1}>{text}</Text>
      <Text style={[stroke, { left: 1 }]} numberOfLines={1}>{text}</Text>
      <Text style={[base, { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 6 }]} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function RatingScreen(props) {
  var navigation = props.navigation;
  var route = props.route;
  var trip = route.params ? (route.params.delivery || route.params.ride) : null;
  var isDelivery = !!(route.params && route.params.delivery);

  var ratingState = useState(0); var rating = ratingState[0]; var setRating = ratingState[1];
  var reviewState = useState(''); var review = reviewState[0]; var setReview = reviewState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];

  var driverName = isDelivery ? 'Livreur' : 'Chauffeur'; var driverPhoto = null; var driverRating = '5.0'; var vehicleInfo = ''; var fare = 0;
  if (trip) {
    var driverObj = trip.driver || (trip.driverId && typeof trip.driverId === 'object' ? trip.driverId : null);
    if (driverObj && driverObj.userId) { driverName = driverObj.userId.name || driverName; driverPhoto = driverObj.userId.profilePhoto || null; driverRating = driverObj.userId.rating ? driverObj.userId.rating.toFixed(1) : '5.0'; }
    if (driverObj && driverObj.vehicle) { vehicleInfo = (driverObj.vehicle.make || '') + ' ' + (driverObj.vehicle.model || '') + ' • ' + (driverObj.vehicle.color || ''); }
    fare = trip.fare || 0;
  }

  function submitRating() {
    if (rating === 0) { Alert.alert('Note requise', 'Veuillez donner une note.'); return; }
    setLoading(true);
    var tripId = trip ? trip._id : null;
    if (!tripId) { navigation.replace('Home'); return; }
    var promise = isDelivery
      ? deliveryService.rateDelivery(tripId, rating, review)
      : rideService.rateRide(tripId, rating, review);
    promise.then(function(response) {
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
    switch (rating) { case 1: return 'Très mauvais'; case 2: return 'Mauvais'; case 3: return 'Correct'; case 4: return 'Bien'; case 5: return 'Excellent!'; default: return isDelivery ? 'Notez votre livreur' : 'Notez votre chauffeur'; }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F2F4F7' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <LinearGradient colors={['#000000', '#003322', '#00853F']} locations={[0, 0.55, 1]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.heroGradient}>
        <Text style={styles.heroEyebrow}>{(isDelivery ? 'LIVRAISON TERMINÉE' : 'COURSE TERMINÉE').toUpperCase()}</Text>
        <View style={{ marginTop: 8 }}><StrokedAmount amount={fare} fontSize={48} /></View>
      </LinearGradient>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.driverCard}>
          {renderDriverAvatar()}
          <Text style={styles.driverName}>{driverName}</Text>
          <Text style={styles.driverMeta}>{'⭐ ' + driverRating}</Text>
          {vehicleInfo ? <Text style={styles.vehicleText}>{vehicleInfo}</Text> : null}
        </View>
        <Text style={styles.ratingPrompt}>{getRatingLabel()}</Text>
        <View style={styles.starsRow}>{[1, 2, 3, 4, 5].map(function(i) { return renderStar(i); })}</View>
        <TextInput style={styles.reviewInput} placeholder="Commentaire (optionnel)" placeholderTextColor={COLORS.textDarkMuted} value={review} onChangeText={setReview} multiline={true} maxLength={200} blurOnSubmit={true} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} />
        <TouchableOpacity style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]} onPress={submitRating} disabled={loading}><Text style={styles.submitBtnText}>{loading ? 'Envoi...' : 'Soumettre'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.skipBtn} onPress={function() { navigation.replace('Home'); }}><Text style={styles.skipBtnText}>Passer</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

var styles = StyleSheet.create({
  heroGradient: { paddingTop: 70, paddingBottom: 36, paddingHorizontal: 24, alignItems: 'center' },
  heroEyebrow: { fontSize: 12, fontFamily: 'LexendDeca_700Bold', color: 'rgba(255,255,255,0.85)', letterSpacing: 2 },
  container: { flexGrow: 1, backgroundColor: '#F2F4F7', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, alignItems: 'center' },
  successBanner: { alignItems: 'center', marginBottom: 32 },
  successIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.green, textAlign: 'center', lineHeight: 64, fontSize: 32, color: '#fff', overflow: 'hidden', marginBottom: 16 , fontFamily: 'LexendDeca_400Regular' },
  successTitle: { fontSize: 24, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 8 },
  successFare: { fontSize: 32, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  driverCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, alignItems: 'center', width: '100%', marginBottom: 24, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  driverPhoto: { width: 72, height: 72, borderRadius: 36, marginBottom: 12, backgroundColor: '#EEF0F3' },
  driverAvatarFallback: { width: 72, height: 72, borderRadius: 36, marginBottom: 12, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  driverAvatarLetter: { fontSize: 30, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF' },
  driverName: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 4 },
  driverMeta: { fontSize: 14, color: '#5a5a5a', marginBottom: 4 , fontFamily: 'LexendDeca_400Regular' },
  vehicleText: { fontSize: 13, color: '#757575' , fontFamily: 'LexendDeca_400Regular' },
  ratingPrompt: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 16, textAlign: 'center' },
  starsRow: { flexDirection: 'row', marginBottom: 20 },
  starTouch: { padding: 8 },
  star: { fontSize: 44, color: '#D7DBE0', fontFamily: 'LexendDeca_400Regular' },
  starFilled: { color: COLORS.yellow },
  reviewInput: { width: '100%', minHeight: 80, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#EEF0F3', padding: 16, color: '#1A1A1A', fontSize: 15, textAlignVertical: 'top', marginBottom: 24, fontFamily: 'LexendDeca_400Regular' },
  submitBtn: { width: '100%', padding: 18, borderRadius: 16, backgroundColor: COLORS.green, alignItems: 'center', marginBottom: 12 },
  submitBtnDisabled: { backgroundColor: 'rgba(0, 133, 63, 0.3)' },
  submitBtnText: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: '#FFFFFF' },
  skipBtn: { padding: 16 },
  skipBtnText: { fontSize: 15, color: '#757575', fontFamily: 'LexendDeca_400Regular' },
});

export default RatingScreen;
