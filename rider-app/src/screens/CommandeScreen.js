import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  Alert, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';
import COLORS from '../constants/colors';
import { deliveryService } from '../services/api.service';

var GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

var STORE_TYPES = [
  { key: 'pharmacie', icon: '💊', label: 'Pharmacie' },
  { key: 'supermarche', icon: '🛒', label: 'Supermarché' },
  { key: 'boutique', icon: '👕', label: 'Boutique' },
  { key: 'restaurant', icon: '🍽️', label: 'Restaurant' },
  { key: 'autre', icon: '📍', label: 'Autre' },
];

function CommandeScreen(props) {
  var navigation = props.navigation;
  var route = props.route;
  var currentLocation = route.params ? route.params.currentLocation : null;

  var stepState = useState(1); var step = stepState[0]; var setStep = stepState[1];
  var storeTypeState = useState(''); var storeType = storeTypeState[0]; var setStoreType = storeTypeState[1];
  var storeNameState = useState(''); var storeName = storeNameState[0]; var setStoreName = storeNameState[1];
  var itemsListState = useState(''); var itemsList = itemsListState[0]; var setItemsList = itemsListState[1];
  var estimatedCostState = useState(''); var estimatedCost = estimatedCostState[0]; var setEstimatedCost = estimatedCostState[1];
  var pickupState = useState(null); var pickup = pickupState[0]; var setPickup = pickupState[1];
  var dropoffState = useState(null); var dropoff = dropoffState[0]; var setDropoff = dropoffState[1];
  var instructionsState = useState(''); var instructions = instructionsState[0]; var setInstructions = instructionsState[1];
  var estimateState = useState(null); var estimate = estimateState[0]; var setEstimate = estimateState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var confirmingState = useState(false); var confirming = confirmingState[0]; var setConfirming = confirmingState[1];

  useEffect(function() {
    if (currentLocation) {
      Location.reverseGeocodeAsync({ latitude: currentLocation.latitude, longitude: currentLocation.longitude }).then(function(result) {
        if (result && result[0]) { var addr = result[0]; var address = (addr.street || '') + ' ' + (addr.city || '') + ', ' + (addr.region || ''); setDropoff({ address: address.trim() || 'Ma position', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } }); }
      }).catch(function() { setDropoff({ address: 'Ma position', coordinates: { latitude: currentLocation.latitude, longitude: currentLocation.longitude } }); });
    }
  }, []);

  function haversineDistance(lat1, lon1, lat2, lon2) { var R = 6371; var dLat = (lat2 - lat1) * Math.PI / 180; var dLon = (lon2 - lon1) * Math.PI / 180; var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); }

  function fetchEstimate() {
    if (!pickup || !dropoff) { Alert.alert('Erreur', 'Veuillez indiquer les adresses.'); return; }
    if (!itemsList.trim()) { Alert.alert('Erreur', 'Veuillez décrire ce que vous voulez commander.'); return; }
    setLoading(true);
    var dist = haversineDistance(pickup.coordinates.latitude, pickup.coordinates.longitude, dropoff.coordinates.latitude, dropoff.coordinates.longitude);
    deliveryService.getEstimate('commande', dist, 'petit').then(function(response) { setLoading(false); if (response.success) { setEstimate(response.estimate); setStep(3); } else { Alert.alert('Erreur', 'Impossible de calculer le prix.'); } }).catch(function() { setLoading(false); Alert.alert('Erreur', 'Erreur de connexion.'); });
  }

  function handleConfirm() {
    setConfirming(true);
    var dist = haversineDistance(pickup.coordinates.latitude, pickup.coordinates.longitude, dropoff.coordinates.latitude, dropoff.coordinates.longitude);
    var data = { serviceType: 'commande', pickup: { address: pickup.address, coordinates: pickup.coordinates, instructions: 'Magasin: ' + storeName }, dropoff: { address: dropoff.address, coordinates: dropoff.coordinates, contactName: 'Moi', contactPhone: '' }, distance: dist, estimatedDuration: Math.round((dist / 30) * 60), paymentMethod: 'cash', commandeDetails: { storeName: storeName, storeType: storeType, itemsList: itemsList, estimatedItemsCost: parseInt(estimatedCost) || 0 } };
    deliveryService.createDelivery(data).then(function(response) { setConfirming(false); if (response.success) { navigation.replace('ActiveDeliveryScreen', { deliveryId: response.delivery._id }); } else { Alert.alert('Info', response.message || 'Aucun livreur disponible.'); } }).catch(function() { setConfirming(false); Alert.alert('Erreur', 'Impossible de créer la commande.'); });
  }

  function renderStep1() {
    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled={true}>
        <Text style={styles.stepTitle}>Type de magasin</Text>
        <Text style={styles.stepSub}>Où voulez-vous commander?</Text>
        <View style={styles.storeGrid}>
          {STORE_TYPES.map(function(st) { var selected = storeType === st.key; return (
            <TouchableOpacity key={st.key} style={[styles.storeCard, selected && styles.storeCardSelected]} onPress={function() { setStoreType(st.key); }}>
              <Text style={styles.storeIcon}>{st.icon}</Text>
              <Text style={[styles.storeLabel, selected && styles.storeLabelSelected]}>{st.label}</Text>
            </TouchableOpacity>
          ); })}
        </View>
        {storeType !== '' && (
          <View>
            <Text style={styles.fieldLabel}>Nom du magasin</Text>
            <TextInput style={styles.textInputSingle} placeholder="Ex: Pharmacie Mame Diarra, Auchan Sacré Cœur..." placeholderTextColor={COLORS.textDarkMuted} value={storeName} onChangeText={setStoreName} />
            <Text style={styles.fieldLabel}>Adresse du magasin</Text>
            <View style={styles.addressCard}>
              {pickup ? (
                <TouchableOpacity onPress={function() { setPickup(null); }}><View style={styles.addressSetRow}><View style={styles.dotOrange} /><Text style={styles.addressSetText} numberOfLines={1}>{pickup.address}</Text><Text style={styles.changeText}>Changer</Text></View></TouchableOpacity>
              ) : (
                <GooglePlacesAutocomplete placeholder="Adresse du magasin" fetchDetails={true} onPress={function(data, details) { setPickup({ address: data.description, coordinates: { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng } }); }} query={{ key: GOOGLE_MAPS_KEY, language: 'fr', components: 'country:us' }} styles={{ textInput: styles.gInput, listView: styles.gList, container: { flex: 0 } }} enablePoweredByContainer={false} debounce={300} minLength={2} />
              )}
            </View>
            <Text style={styles.fieldLabel}>Livrer à</Text>
            <View style={styles.addressCard}>
              {dropoff ? (
                <TouchableOpacity onPress={function() { setDropoff(null); }}><View style={styles.addressSetRow}><View style={styles.dotGreen} /><Text style={styles.addressSetText} numberOfLines={1}>{dropoff.address}</Text><Text style={styles.changeText}>Changer</Text></View></TouchableOpacity>
              ) : (
                <GooglePlacesAutocomplete placeholder="Adresse de livraison" fetchDetails={true} onPress={function(data, details) { setDropoff({ address: data.description, coordinates: { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng } }); }} query={{ key: GOOGLE_MAPS_KEY, language: 'fr', components: 'country:us' }} styles={{ textInput: styles.gInput, listView: styles.gList, container: { flex: 0 } }} enablePoweredByContainer={false} debounce={300} minLength={2} />
              )}
            </View>
            {pickup && dropoff && <TouchableOpacity style={styles.nextBtn} onPress={function() { setStep(2); }}><Text style={styles.nextBtnText}>Continuer</Text></TouchableOpacity>}
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderStep2() {
    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Votre commande</Text>
        <Text style={styles.stepSub}>Décrivez ce que vous voulez</Text>
        <View style={styles.storeInfoCard}><Text style={styles.storeInfoIcon}>{STORE_TYPES.find(function(s) { return s.key === storeType; }) ? STORE_TYPES.find(function(s) { return s.key === storeType; }).icon : '📍'}</Text><View style={styles.storeInfoText}><Text style={styles.storeInfoName}>{storeName || 'Magasin'}</Text><Text style={styles.storeInfoAddr} numberOfLines={1}>{pickup ? pickup.address : ''}</Text></View></View>
        <Text style={styles.fieldLabel}>Liste des articles *</Text>
        <TextInput style={styles.textInputLarge} placeholder={"Ex:\n- 1 boîte de Doliprane 500mg\n- 2 bouteilles d'eau 1.5L\n- 1 sac de riz 5kg"} placeholderTextColor={COLORS.textDarkMuted} value={itemsList} onChangeText={setItemsList} multiline={true} textAlignVertical="top" />
        <Text style={styles.fieldLabel}>Coût estimé des articles (FCFA)</Text>
        <TextInput style={styles.textInputSingle} placeholder="Ex: 5000" placeholderTextColor={COLORS.textDarkMuted} value={estimatedCost} onChangeText={setEstimatedCost} keyboardType="numeric" />
        <Text style={styles.helperText}>Le livreur paiera et vous rembourserez à la livraison</Text>
        <Text style={styles.fieldLabel}>Instructions spéciales (optionnel)</Text>
        <TextInput style={styles.textInput} placeholder="Ex: Prendre la marque Kirène, pas d'autre..." placeholderTextColor={COLORS.textDarkMuted} value={instructions} onChangeText={setInstructions} multiline={true} />
        <TouchableOpacity style={styles.nextBtn} onPress={fetchEstimate} disabled={loading}>{loading ? <ActivityIndicator color={COLORS.darkBg} /> : <Text style={styles.nextBtnText}>Voir le prix</Text>}</TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  function renderStep3() {
    if (!estimate) return null;
    var itemsCost = parseInt(estimatedCost) || 0;
    var totalWithItems = estimate.fare + itemsCost;
    return (
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Récapitulatif</Text>
        <Text style={styles.stepSub}>Vérifiez votre commande</Text>
        <View style={styles.summaryCard}><View style={styles.summaryRow}><View style={styles.dotOrange} /><View style={styles.summaryTextWrap}><Text style={styles.summaryLabel}>{storeName || 'Magasin'}</Text><Text style={styles.summaryAddr} numberOfLines={2}>{pickup.address}</Text></View></View><View style={styles.summaryDivider} /><View style={styles.summaryRow}><View style={styles.dotGreen} /><View style={styles.summaryTextWrap}><Text style={styles.summaryLabel}>Livraison</Text><Text style={styles.summaryAddr} numberOfLines={2}>{dropoff.address}</Text></View></View></View>
        <View style={styles.itemsCard}><Text style={styles.itemsTitle}>Articles commandés</Text><Text style={styles.itemsText}>{itemsList}</Text></View>
        <View style={styles.priceCard}>
          <View style={styles.priceRow}><Text style={styles.priceLabel}>Coût articles (estimé)</Text><Text style={styles.priceValue}>{itemsCost.toLocaleString() + ' FCFA'}</Text></View>
          <View style={styles.priceRow}><Text style={styles.priceLabel}>Frais de livraison</Text><Text style={styles.priceValue}>{estimate.fare.toLocaleString() + ' FCFA'}</Text></View>
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}><Text style={styles.priceTotalLabel}>Total estimé</Text><Text style={styles.priceTotalValue}>{totalWithItems.toLocaleString() + ' FCFA'}</Text></View>
        </View>
        <View style={styles.noteCard}><Text style={styles.noteIcon}>💡</Text><Text style={styles.noteText}>Le livreur achète vos articles et vous payez le tout à la livraison en espèces.</Text></View>
        <View style={styles.paymentRow}><Text style={styles.paymentIcon}>💵</Text><Text style={styles.paymentText}>Paiement en espèces à la livraison</Text></View>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={confirming}>{confirming ? <ActivityIndicator color={COLORS.darkBg} /> : <Text style={styles.confirmBtnText}>Confirmer la commande</Text>}</TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}><TouchableOpacity style={styles.backBtn} onPress={function() { if (step > 1) { setStep(step - 1); } else { navigation.goBack(); } }}><Text style={styles.backIcon}>←</Text></TouchableOpacity><View style={styles.headerTitleWrap}><Text style={styles.headerTitle}>🛒 Faire une Commande</Text></View></View>
      <View style={styles.stepIndicator}>{[1,2,3].map(function(s) { return (<View key={s} style={styles.stepDotRow}><View style={[styles.stepDot, s <= step && styles.stepDotActive]} />{s < 3 && <View style={[styles.stepLine, s < step && styles.stepLineActive]} />}</View>); })}</View>
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
  backIcon: { fontSize: 20, fontWeight: 'bold', color: COLORS.textLight },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textLight },
  stepIndicator: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 40 },
  stepDotRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.grayLight },
  stepDotActive: { backgroundColor: COLORS.yellow, width: 14, height: 14, borderRadius: 7 },
  stepLine: { width: 60, height: 2, backgroundColor: COLORS.grayLight, marginHorizontal: 8 },
  stepLineActive: { backgroundColor: COLORS.yellow },
  stepContent: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textDark, marginBottom: 4 },
  stepSub: { fontSize: 14, color: COLORS.textDarkSub, marginBottom: 20 },
  storeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  storeCard: { width: '30%', backgroundColor: COLORS.backgroundWhite, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: COLORS.grayLight },
  storeCardSelected: { borderColor: '#FF9500', backgroundColor: 'rgba(255, 149, 0, 0.1)' },
  storeIcon: { fontSize: 32, marginBottom: 8 },
  storeLabel: { fontSize: 12, color: COLORS.textDarkSub, fontWeight: '600', textAlign: 'center' },
  storeLabelSelected: { color: '#FF9500' },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textDarkSub, marginBottom: 10, marginTop: 16 },
  textInputSingle: { backgroundColor: COLORS.backgroundWhite, borderRadius: 14, padding: 16, color: COLORS.textDark, fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: COLORS.grayLight },
  textInput: { backgroundColor: COLORS.backgroundWhite, borderRadius: 14, padding: 16, color: COLORS.textDark, fontSize: 15, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.grayLight },
  textInputLarge: { backgroundColor: COLORS.backgroundWhite, borderRadius: 14, padding: 16, color: COLORS.textDark, fontSize: 15, minHeight: 140, textAlignVertical: 'top', borderWidth: 1, borderColor: COLORS.grayLight },
  helperText: { fontSize: 12, color: COLORS.textDarkMuted, marginTop: 4, marginBottom: 6, fontStyle: 'italic' },
  addressCard: { backgroundColor: COLORS.darkCard, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  addressSetRow: { flexDirection: 'row', alignItems: 'center' },
  addressSetText: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.textLight, marginLeft: 10 },
  changeText: { fontSize: 12, color: COLORS.green, fontWeight: '600' },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.green },
  dotOrange: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF9500' },
  dotRed: { width: 12, height: 12, backgroundColor: COLORS.red },
  gInput: { fontSize: 15, color: '#000', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  gList: { backgroundColor: '#fff', borderRadius: 12, marginTop: 4 },
  storeInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.darkCard, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  storeInfoIcon: { fontSize: 36, marginRight: 14 },
  storeInfoText: { flex: 1 },
  storeInfoName: { fontSize: 16, fontWeight: '700', color: COLORS.textLight, marginBottom: 2 },
  storeInfoAddr: { fontSize: 13, color: COLORS.textLightMuted },
  nextBtn: { backgroundColor: COLORS.yellow, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 24 },
  nextBtnText: { fontSize: 17, fontWeight: 'bold', color: COLORS.darkBg },
  summaryCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start' },
  summaryTextWrap: { flex: 1, marginLeft: 12 },
  summaryLabel: { fontSize: 12, color: COLORS.textLightMuted, marginBottom: 2 },
  summaryAddr: { fontSize: 15, fontWeight: '500', color: COLORS.textLight },
  summaryDivider: { height: 24, marginLeft: 6, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed', marginVertical: 6 },
  itemsCard: { backgroundColor: COLORS.darkCard, borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  itemsTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textLightMuted, marginBottom: 8 },
  itemsText: { fontSize: 14, color: COLORS.textLight, lineHeight: 22 },
  priceCard: { backgroundColor: 'rgba(252, 209, 22, 0.08)', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(252, 209, 22, 0.2)' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  priceLabel: { fontSize: 14, color: COLORS.textDarkSub },
  priceValue: { fontSize: 14, color: COLORS.textDark },
  priceDivider: { height: 1, backgroundColor: 'rgba(252, 209, 22, 0.2)', marginVertical: 8 },
  priceTotalLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  priceTotalValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.darkBg },
  noteCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(255, 149, 0, 0.08)', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255, 149, 0, 0.2)' },
  noteIcon: { fontSize: 18, marginRight: 10, marginTop: 2 },
  noteText: { flex: 1, fontSize: 13, color: COLORS.textDarkSub, lineHeight: 19 },
  paymentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.darkCard, borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  paymentIcon: { fontSize: 22, marginRight: 12 },
  paymentText: { fontSize: 15, color: COLORS.textLightSub },
  confirmBtn: { backgroundColor: COLORS.yellow, borderRadius: 16, padding: 18, alignItems: 'center' },
  confirmBtnText: { fontSize: 17, fontWeight: 'bold', color: COLORS.darkBg },
});

export default CommandeScreen;
