import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Alert, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import NominatimAutocomplete from '../components/NominatimAutocomplete';
import * as Location from 'expo-location';
import COLORS from '../constants/colors';
import { deliveryService } from '../services/api.service';
import { calculateDistance } from '../utils/distance';


function ColisScreen(props) {
  var navigation = props.navigation;
  var route = props.route;
  var currentLocation = route.params ? route.params.currentLocation : null;

  var stepState = useState(1); var step = stepState[0]; var setStep = stepState[1];
  var pickupState = useState(null); var pickup = pickupState[0]; var setPickup = pickupState[1];
  var dropoffState = useState(null); var dropoff = dropoffState[0]; var setDropoff = dropoffState[1];
  var sizeState = useState('petit'); var size = sizeState[0]; var setSize = sizeState[1];
  var descState = useState(''); var description = descState[0]; var setDescription = descState[1];
  var fragileState = useState(false); var isFragile = fragileState[0]; var setIsFragile = fragileState[1];
  var recipientNameState = useState(''); var recipientName = recipientNameState[0]; var setRecipientName = recipientNameState[1];
  var recipientPhoneState = useState(''); var recipientPhone = recipientPhoneState[0]; var setRecipientPhone = recipientPhoneState[1];
  var instructionsState = useState(''); var instructions = instructionsState[0]; var setInstructions = instructionsState[1];
  var estimateState = useState(null); var estimate = estimateState[0]; var setEstimate = estimateState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var confirmingState = useState(false); var confirming = confirmingState[0]; var setConfirming = confirmingState[1];
  var pmState = useState('cash'); var paymentMethod = pmState[0]; var setPaymentMethod = pmState[1];
  var pickupAddrState = useState(''); var pickupAddress = pickupAddrState[0]; var setPickupAddress = pickupAddrState[1];

  useEffect(function() {
    if (currentLocation) {
      Location.reverseGeocodeAsync({ latitude: currentLocation.latitude, longitude: currentLocation.longitude }).then(function(result) {
        if (result && result[0]) {
          var addr = result[0];
          var address = (addr.street || '') + ' ' + (addr.city || '') + ', ' + (addr.region || '');
          setPickup({ address: address.trim() || 'Position actuelle', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } });
          setPickupAddress(address.trim() || 'Position actuelle');
        }
      }).catch(function() {
        setPickup({ address: 'Position actuelle', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } });
        setPickupAddress('Position actuelle');
      });
    }
  }, []);

  function haversineDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; var dLat = (lat2 - lat1) * Math.PI / 180; var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  async function getRoadDistance() {
    try {
      var gUrl = 'https://maps.googleapis.com/maps/api/directions/json?origin=' + pickup.coordinates.latitude + ',' + pickup.coordinates.longitude + '&destination=' + dropoff.coordinates.latitude + ',' + dropoff.coordinates.longitude + '&key=AIzaSyCwm1J7ULt8EnKX-0Gyj6Y_AxISDkbRSkw';
      var gR = await fetch(gUrl);
      var gData = await gR.json();
      if (gData.status === 'OK' && gData.routes.length > 0) return gData.routes[0].legs[0].distance.value / 1000;
    } catch(e) {}
    try {
      var oUrl = 'https://osrm.terango.sn/route/v1/driving/' + pickup.coordinates.longitude + ',' + pickup.coordinates.latitude + ';' + dropoff.coordinates.longitude + ',' + dropoff.coordinates.latitude + '?overview=false';
      var oR = await fetch(oUrl);
      var oData = await oR.json();
      if (oData.code === 'Ok' && oData.routes.length > 0) return oData.routes[0].distance / 1000;
    } catch(e) {}
    return haversineDistance(pickup.coordinates.latitude, pickup.coordinates.longitude, dropoff.coordinates.latitude, dropoff.coordinates.longitude) * 1.3;
  }

  function fetchEstimate() {
    if (!pickup || !dropoff) { Alert.alert('Erreur', 'Veuillez remplir les adresses de d\u00e9part et arriv\u00e9e.'); return; }
    setLoading(true);
    getRoadDistance().then(function(dist) {
      deliveryService.getEstimate('colis', dist, size).then(function(response) {
        setLoading(false);
        if (response.success) { setEstimate(response.estimate); setStep(3); }
        else { Alert.alert('Erreur', 'Impossible de calculer le prix.'); }
      }).catch(function() { setLoading(false); Alert.alert('Erreur', 'Erreur de connexion au serveur.'); });
    });
  }

  function handleConfirm() {
    if (!recipientName.trim() || !recipientPhone.trim()) { Alert.alert('Erreur', 'Nom et t\u00e9l\u00e9phone du destinataire requis.'); return; }
    if (!description.trim()) { Alert.alert('Erreur', 'Veuillez d\u00e9crire votre colis.'); return; }
    setConfirming(true);
    getRoadDistance().then(function(dist) {
      var data = { serviceType: 'colis', pickup: { address: pickup.address, coordinates: pickup.coordinates, instructions: instructions }, dropoff: { address: dropoff.address, coordinates: dropoff.coordinates, contactName: recipientName, contactPhone: recipientPhone }, distance: dist, estimatedDuration: Math.round((dist / 30) * 60), paymentMethod: paymentMethod, packageDetails: { size: size, description: description, isFragile: isFragile } };
      deliveryService.createDelivery(data).then(function(response) {
        setConfirming(false);
        if (response.success) { navigation.replace('ActiveDeliveryScreen', { deliveryId: response.delivery._id }); }
        else { Alert.alert('Info', response.message || 'Aucun livreur disponible.'); }
      }).catch(function() { setConfirming(false); Alert.alert('Erreur', 'Impossible de cr\u00e9er la livraison.'); });
    });
  }

  var sizes = [
    { key: 'petit', icon: '\uD83D\uDCE6', label: 'Petit', desc: 'Enveloppe, petit sac', extra: '+0 FCFA' },
    { key: 'moyen', icon: '\uD83D\uDCE6', label: 'Moyen', desc: 'Sac, bo\u00eete moyenne', extra: '+300 FCFA' },
    { key: 'grand', icon: '\uD83D\uDCE6', label: 'Grand', desc: 'Valise, carton', extra: '+700 FCFA' },
  ];

  function renderStep1() {
    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} >
        <Text style={styles.stepTitle}>Adresses</Text>
        <Text style={styles.stepSub}>{"D'o\u00f9 \u00e0 o\u00f9 envoyez-vous?"}</Text>
        <View style={styles.addressCard}>
          <View style={styles.addressRow}>
            <View style={styles.dotGreen} />
            <View style={styles.addressInputWrap}>
              <Text style={styles.addressLabel}>Point de retrait</Text>
              {pickup ? (
                <TouchableOpacity onPress={function() { setPickup(null); setPickupAddress(''); }}>
                  <Text style={styles.addressSet} numberOfLines={1}>{pickup.address}</Text>
                </TouchableOpacity>
              ) : (
                <NominatimAutocomplete placeholder="Adresse de retrait"
                  onPress={function(data, details) { setPickup({ address: data.description, coordinates: { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng } }); }}
                  styles={{ textInput: styles.gInput, listView: styles.gList, container: { flex: 0 } }} />
              )}
            </View>
          </View>
          <View style={styles.dashedLine} />
          <View style={styles.addressRow}>
            <View style={styles.dotRed} />
            <View style={styles.addressInputWrap}>
              <Text style={styles.addressLabel}>Point de livraison</Text>
              {dropoff ? (
                <TouchableOpacity onPress={function() { setDropoff(null); }}>
                  <Text style={styles.addressSet} numberOfLines={1}>{dropoff.address}</Text>
                </TouchableOpacity>
              ) : (
                <NominatimAutocomplete placeholder="Adresse de livraison"
                  onPress={function(data, details) { setDropoff({ address: data.description, coordinates: { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng } }); }}
                  styles={{ textInput: styles.gInput, listView: styles.gList, container: { flex: 0 } }} />
              )}
            </View>
          </View>
        </View>
        {pickup && dropoff && (
          <TouchableOpacity style={styles.nextBtn} onPress={function() { setStep(2); }}><Text style={styles.nextBtnText}>Continuer</Text></TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderStep2() {
    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>{"D\u00e9tails du colis"}</Text>
        <Text style={styles.stepSub}>{"D\u00e9crivez votre envoi"}</Text>
        <Text style={styles.fieldLabel}>Taille du colis</Text>
        <View style={styles.sizeRow}>
          {sizes.map(function(s) {
            var selected = size === s.key;
            return (
              <TouchableOpacity key={s.key} style={[styles.sizeCard, selected && styles.sizeCardSelected]} onPress={function() { setSize(s.key); }}>
                <Text style={styles.sizeIcon}>{s.icon}</Text>
                <Text style={[styles.sizeLabel, selected && styles.sizeLabelSelected]}>{s.label}</Text>
                <Text style={styles.sizeDesc}>{s.desc}</Text>
                <Text style={[styles.sizeExtra, selected && styles.sizeExtraSelected]}>{s.extra}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.fieldLabel}>Description du colis *</Text>
        <TextInput style={styles.textInput} placeholder={"Ex: Documents importants, v\u00eatements..."} placeholderTextColor={COLORS.textDarkMuted} value={description} onChangeText={setDescription} multiline={true} />
        <TouchableOpacity style={[styles.fragileBtn, isFragile && styles.fragileBtnActive]} onPress={function() { setIsFragile(!isFragile); }}>
          <Text style={styles.fragileIcon}>{isFragile ? '\u2705' : '\u26A0\uFE0F'}</Text>
          <Text style={[styles.fragileText, isFragile && styles.fragileTextActive]}>Colis fragile</Text>
        </TouchableOpacity>
        <Text style={styles.fieldLabel}>Destinataire *</Text>
        <TextInput style={styles.textInputSingle} placeholder="Nom du destinataire" placeholderTextColor={COLORS.textDarkMuted} value={recipientName} onChangeText={setRecipientName} />
        <TextInput style={styles.textInputSingle} placeholder={"T\u00e9l\u00e9phone du destinataire"} placeholderTextColor={COLORS.textDarkMuted} value={recipientPhone} onChangeText={setRecipientPhone} keyboardType="phone-pad" />
        <Text style={styles.fieldLabel}>Instructions (optionnel)</Text>
        <TextInput style={styles.textInput} placeholder="Ex: Sonner 2 fois, appeler en arrivant..." placeholderTextColor={COLORS.textDarkMuted} value={instructions} onChangeText={setInstructions} multiline={true} />
        <TouchableOpacity style={styles.nextBtn} onPress={fetchEstimate} disabled={loading}>
          {loading ? <ActivityIndicator color={COLORS.darkBg} /> : <Text style={styles.nextBtnText}>Voir le prix</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderStep3() {
    if (!estimate) return null;
    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Confirmation</Text>
        <Text style={styles.stepSub}>{"V\u00e9rifiez et confirmez votre envoi"}</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}><View style={styles.dotGreen} /><View style={styles.summaryTextWrap}><Text style={styles.summaryLabel}>Retrait</Text><Text style={styles.summaryAddr} numberOfLines={2}>{pickup.address}</Text></View></View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}><View style={styles.dotRed} /><View style={styles.summaryTextWrap}><Text style={styles.summaryLabel}>Livraison</Text><Text style={styles.summaryAddr} numberOfLines={2}>{dropoff.address}</Text></View></View>
        </View>
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Colis</Text><Text style={styles.detailValue}>{size.charAt(0).toUpperCase() + size.slice(1) + (isFragile ? ' (Fragile)' : '')}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Description</Text><Text style={styles.detailValue} numberOfLines={2}>{description}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Destinataire</Text><Text style={styles.detailValue}>{recipientName}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>{"\u00c9l\u00e9phone"}</Text><Text style={styles.detailValue}>{recipientPhone}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Distance</Text><Text style={styles.detailValue}>{estimate.distance.toFixed(1) + ' km'}</Text></View>
        </View>
        <View style={styles.priceCard}>
          <View style={styles.priceRow}><Text style={styles.priceLabel}>Frais de livraison</Text><Text style={styles.priceValue}>{estimate.deliveryFee.toLocaleString() + ' FCFA'}</Text></View>
          {estimate.sizeSurcharge > 0 && <View style={styles.priceRow}><Text style={styles.priceLabel}>{"Suppl\u00e9ment taille"}</Text><Text style={styles.priceValue}>{estimate.sizeSurcharge.toLocaleString() + ' FCFA'}</Text></View>}
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}><Text style={styles.priceTotalLabel}>Total</Text><Text style={styles.priceTotalValue}>{estimate.fare.toLocaleString() + ' FCFA'}</Text></View>
        </View>
        <View style={styles.paymentRow}><Text style={styles.paymentIcon}>{'\uD83D\uDCB5'}</Text><Text style={styles.paymentText}>{"Paiement en esp\u00e8ces"}</Text></View>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={confirming}>
          {confirming ? <ActivityIndicator color={COLORS.darkBg} /> : <Text style={styles.confirmBtnText}>{'Confirmer \u2022 ' + estimate.fare.toLocaleString() + ' FCFA'}</Text>}
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={function() { if (step > 1) { setStep(step - 1); } else { navigation.goBack(); } }}>
          <Text style={styles.backIcon}>{'\u2190'}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}><Text style={styles.headerTitle}>{'\uD83D\uDCE6 Envoyer un Colis'}</Text></View>
      </View>
      <View style={styles.stepIndicator}>
        {[1,2,3].map(function(s) { return (
          <View key={s} style={styles.stepDotRow}>
            <View style={[styles.stepDot, s <= step && styles.stepDotActive]} />
            {s < 3 && <View style={[styles.stepLine, s < step && styles.stepLineActive]} />}
          </View>
        ); })}
      </View>
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </KeyboardAvoidingView>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: COLORS.darkCard, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderBottomWidth: 1, borderBottomColor: COLORS.darkCardBorder },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backIcon: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight },
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 40 },
  stepDotRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.grayLight },
  stepDotActive: { backgroundColor: COLORS.yellow, width: 14, height: 14, borderRadius: 7 },
  stepLine: { width: 60, height: 2, backgroundColor: COLORS.grayLight, marginHorizontal: 8 },
  stepLineActive: { backgroundColor: COLORS.yellow },
  stepContent: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 22, fontFamily: 'LexendDeca_700Bold', color: COLORS.textDark, marginBottom: 4 },
  stepSub: { fontSize: 14, color: COLORS.textDarkSub, marginBottom: 20, fontFamily: 'LexendDeca_400Regular' },
  addressCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8 },
  dotGreen: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.green, marginRight: 12, marginTop: 4 },
  dotRed: { width: 14, height: 14, backgroundColor: COLORS.red, marginRight: 12, marginTop: 4 },
  dashedLine: { height: 30, marginLeft: 7, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.15)', borderStyle: 'dashed', marginVertical: 4 },
  addressInputWrap: { flex: 1 },
  addressLabel: { fontSize: 12, color: COLORS.textLightMuted, marginBottom: 4, fontFamily: 'LexendDeca_400Regular' },
  addressSet: { fontSize: 15, fontFamily: 'LexendDeca_500Medium', color: COLORS.textLight, backgroundColor: 'rgba(255,255,255,0.08)', padding: 12, borderRadius: 12, overflow: 'hidden' },
  gInput: { fontSize: 15, color: '#000', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', fontFamily: 'LexendDeca_400Regular' },
  gList: { backgroundColor: '#fff', borderRadius: 12, marginTop: 4 },
  fieldLabel: { fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textDarkSub, marginBottom: 10, marginTop: 20 },
  sizeRow: { flexDirection: 'row', gap: 10 },
  sizeCard: { flex: 1, backgroundColor: COLORS.backgroundWhite, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: COLORS.grayLight },
  sizeCardSelected: { borderColor: COLORS.yellow, backgroundColor: 'rgba(212,175,55, 0.1)' },
  sizeIcon: { fontSize: 28, marginBottom: 6, fontFamily: 'LexendDeca_400Regular' },
  sizeLabel: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: COLORS.textDark, marginBottom: 2 },
  sizeLabelSelected: { color: COLORS.darkBg },
  sizeDesc: { fontSize: 10, color: COLORS.textDarkSub, textAlign: 'center', marginBottom: 4, fontFamily: 'LexendDeca_400Regular' },
  sizeExtra: { fontSize: 11, color: COLORS.textDarkSub, fontFamily: 'LexendDeca_600SemiBold' },
  sizeExtraSelected: { color: COLORS.darkBg },
  textInput: { backgroundColor: COLORS.backgroundWhite, borderRadius: 14, padding: 16, color: COLORS.textDark, fontSize: 15, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.grayLight, fontFamily: 'LexendDeca_400Regular' },
  textInputSingle: { backgroundColor: COLORS.backgroundWhite, borderRadius: 14, padding: 16, color: COLORS.textDark, fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: COLORS.grayLight, fontFamily: 'LexendDeca_400Regular' },
  fragileBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundWhite, borderRadius: 14, padding: 16, marginTop: 14, borderWidth: 1, borderColor: COLORS.grayLight },
  fragileBtnActive: { borderColor: '#FF9500', backgroundColor: 'rgba(255, 149, 0, 0.1)' },
  fragileIcon: { fontSize: 20, marginRight: 12, fontFamily: 'LexendDeca_400Regular' },
  fragileText: { fontSize: 15, color: COLORS.textDarkSub, fontFamily: 'LexendDeca_400Regular' },
  fragileTextActive: { color: '#FF9500', fontFamily: 'LexendDeca_600SemiBold' },
  nextBtn: { backgroundColor: COLORS.yellow, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 24 },
  nextBtnText: { fontSize: 17, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  summaryCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start' },
  summaryTextWrap: { flex: 1, marginLeft: 0 },
  summaryLabel: { fontSize: 12, color: COLORS.textLightMuted, marginBottom: 2, fontFamily: 'LexendDeca_400Regular' },
  summaryAddr: { fontSize: 15, fontFamily: 'LexendDeca_500Medium', color: COLORS.textLight },
  summaryDivider: { height: 24, marginLeft: 7, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed', marginVertical: 6 },
  detailsCard: { backgroundColor: COLORS.darkCard, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  detailLabel: { fontSize: 14, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular' },
  detailValue: { fontSize: 14, color: COLORS.textLight, fontFamily: 'LexendDeca_500Medium', maxWidth: '55%', textAlign: 'right' },
  priceCard: { backgroundColor: 'rgba(212,175,55, 0.08)', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(212,175,55, 0.2)' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  priceLabel: { fontSize: 14, color: COLORS.textDarkSub, fontFamily: 'LexendDeca_400Regular' },
  priceValue: { fontSize: 14, color: COLORS.textDark, fontFamily: 'LexendDeca_400Regular' },
  priceDivider: { height: 1, backgroundColor: 'rgba(212,175,55, 0.2)', marginVertical: 8 },
  priceTotalLabel: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.textDark },
  priceTotalValue: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  paymentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.darkCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  paymentIcon: { fontSize: 22, marginRight: 12, fontFamily: 'LexendDeca_400Regular' },
  paymentText: { fontSize: 15, color: COLORS.textLightSub, fontFamily: 'LexendDeca_400Regular' },
  confirmBtn: { backgroundColor: COLORS.yellow, borderRadius: 16, padding: 18, alignItems: 'center' },
  confirmBtnText: { fontSize: 17, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
});

export default ColisScreen;
