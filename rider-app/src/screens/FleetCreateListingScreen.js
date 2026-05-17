import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { fleetService } from '../services/api.service';
import COLORS from '../constants/colors';

var VEHICLE_TYPES = [
  { value: 'car', label: 'Voiture' },
  { value: 'moto', label: 'Moto' }
];
var RENTAL_TYPES = [
  { value: 'both', label: 'Les deux', sub: 'Chauffeurs TeranGO + privé' },
  { value: 'driver', label: 'Chauffeur TeranGO', sub: 'Conducteurs vérifiés uniquement' },
  { value: 'private', label: 'Location privée', sub: 'Particuliers uniquement' }
];

// One photo tile — tap to pick + upload. Photos are stored as URLs.
function PhotoTile(props) {
  var [uploading, setUploading] = useState(false);
  function pick() {
    ImagePicker.requestMediaLibraryPermissionsAsync().then(function(perm) {
      if (perm.status !== 'granted') { Alert.alert('Permission', "Autorisez l'accès aux photos."); return; }
      ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.85 }).then(function(res) {
        if (res.canceled || !res.assets || !res.assets[0]) return;
        setUploading(true);
        fleetService.uploadPhoto(res.assets[0].uri)
          .then(function(r) {
            if (r && r.success && r.url) props.onUploaded(r.url);
            else Alert.alert('Erreur', 'Téléversement échoué');
          })
          .catch(function() { Alert.alert('Erreur', "Téléversement échoué"); })
          .finally(function() { setUploading(false); });
      });
    });
  }
  return (
    <TouchableOpacity style={[styles.photoTile, props.large && styles.photoTileLarge]} onPress={props.url ? props.onRemove : pick} disabled={uploading}>
      {uploading ? <ActivityIndicator color={COLORS.green} /> : props.url ? (
        <View style={{ width: '100%', height: '100%' }}>
          <Image source={{ uri: props.url }} style={{ width: '100%', height: '100%' }} />
          <View style={styles.removeBadge}><Text style={styles.removeBadgeText}>✕</Text></View>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 24 }}>{props.icon || '📷'}</Text>
          <Text style={styles.photoTileLabel}>{props.label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function FleetCreateListingScreen(props) {
  var navigation = props.navigation;
  var [title, setTitle] = useState('');
  var [description, setDescription] = useState('');
  var [vehicleType, setVehicleType] = useState('car');
  var [make, setMake] = useState('');
  var [model, setModel] = useState('');
  var [year, setYear] = useState('');
  var [color, setColor] = useState('');
  var [licensePlate, setLicensePlate] = useState('');
  var [neighborhood, setNeighborhood] = useState('');
  var [photos, setPhotos] = useState([]); // array of urls, up to 6
  var [registrationPhoto, setRegistrationPhoto] = useState('');
  var [insurancePhoto, setInsurancePhoto] = useState('');
  var [dailyRate, setDailyRate] = useState('');
  var [depositRequired, setDepositRequired] = useState('');
  var [minRentalDays, setMinRentalDays] = useState('1');
  var [maxRentalDays, setMaxRentalDays] = useState('30');
  var [rentalType, setRentalType] = useState('both');
  var [conditions, setConditions] = useState('');
  var [submitting, setSubmitting] = useState(false);

  function addPhoto(url) { setPhotos(function(p) { return p.concat([url]); }); }
  function removePhoto(idx) { setPhotos(function(p) { return p.filter(function(_, i) { return i !== idx; }); }); }

  function submit() {
    if (!title.trim()) return Alert.alert('Manquant', 'Donnez un titre à votre annonce');
    if (!dailyRate || isNaN(parseInt(dailyRate, 10))) return Alert.alert('Manquant', 'Tarif journalier requis');
    if (photos.length === 0) return Alert.alert('Photos', 'Ajoutez au moins une photo du véhicule');
    if (!registrationPhoto || !insurancePhoto) return Alert.alert('Documents', 'Carte grise + assurance requises pour la vérification');
    var minD = parseInt(minRentalDays, 10) || 1;
    var maxD = parseInt(maxRentalDays, 10) || 30;
    if (minD > maxD) return Alert.alert('Durée', 'Durée minimum supérieure au maximum');

    setSubmitting(true);
    var payload = {
      title: title.trim(),
      description: description.trim(),
      vehicleType: vehicleType,
      make: make.trim(),
      model: model.trim(),
      year: year ? parseInt(year, 10) : undefined,
      color: color.trim(),
      licensePlate: licensePlate.trim(),
      photos: photos,
      registrationPhoto: registrationPhoto,
      insurancePhoto: insurancePhoto,
      dailyRate: parseInt(dailyRate, 10),
      depositRequired: depositRequired ? parseInt(depositRequired, 10) : 0,
      minRentalDays: minD,
      maxRentalDays: maxD,
      rentalType: rentalType,
      location: neighborhood ? { neighborhood: neighborhood.trim() } : undefined,
      conditions: conditions.trim()
    };
    fleetService.createListing(payload)
      .then(function(res) {
        if (res && res.success) {
          Alert.alert('Annonce soumise', "Votre annonce est en cours de vérification. Vous serez notifié dès qu'elle est approuvée.", [
            { text: 'OK', onPress: function() { navigation.replace('FleetMyListings'); } }
          ]);
        } else {
          Alert.alert('Erreur', (res && res.message) || 'Création échouée');
        }
      })
      .catch(function(err) {
        var msg = (err && err.response && err.response.data && err.response.data.message) || 'Création échouée';
        Alert.alert('Erreur', msg);
      })
      .finally(function() { setSubmitting(false); });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={function() { navigation.goBack(); }} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Nouvelle annonce</Text>
          <Text style={styles.headerSub}>Mettez votre véhicule en location</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Le véhicule</Text>
          <Text style={styles.fieldLabel}>Titre de l'annonce</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Ex: Toyota Corolla 2019 — Mermoz" placeholderTextColor="#999" />

          <Text style={styles.fieldLabel}>Type</Text>
          <View style={styles.choiceRow}>
            {VEHICLE_TYPES.map(function(t) {
              var active = vehicleType === t.value;
              return (
                <TouchableOpacity key={t.value} onPress={function() { setVehicleType(t.value); }} style={[styles.choicePill, active && styles.choicePillActive]}>
                  <Text style={[styles.choicePillText, active && styles.choicePillTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.fieldLabel}>Marque</Text>
              <TextInput style={styles.input} value={make} onChangeText={setMake} placeholder="Toyota" placeholderTextColor="#999" />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.fieldLabel}>Modèle</Text>
              <TextInput style={styles.input} value={model} onChangeText={setModel} placeholder="Corolla" placeholderTextColor="#999" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.fieldLabel}>Année</Text>
              <TextInput style={styles.input} value={year} onChangeText={setYear} placeholder="2019" placeholderTextColor="#999" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.fieldLabel}>Couleur</Text>
              <TextInput style={styles.input} value={color} onChangeText={setColor} placeholder="Blanc" placeholderTextColor="#999" />
            </View>
          </View>
          <Text style={styles.fieldLabel}>Plaque d'immatriculation</Text>
          <TextInput style={styles.input} value={licensePlate} onChangeText={setLicensePlate} placeholder="DK 1234 AB" placeholderTextColor="#999" autoCapitalize="characters" />
          <Text style={styles.fieldLabel}>Quartier</Text>
          <TextInput style={styles.input} value={neighborhood} onChangeText={setNeighborhood} placeholder="Mermoz, Almadies, Plateau..." placeholderTextColor="#999" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Photos du véhicule</Text>
          <Text style={styles.sectionSub}>Au moins 1, jusqu'à 6. Première photo = vignette de l'annonce.</Text>
          <View style={styles.photoGrid}>
            {photos.map(function(url, i) {
              return <PhotoTile key={i} url={url} onRemove={function() { removePhoto(i); }} />;
            })}
            {photos.length < 6 ? <PhotoTile icon="➕" label="Ajouter" onUploaded={addPhoto} /> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Documents (vérification)</Text>
          <Text style={styles.sectionSub}>Carte grise + assurance. Vus uniquement par l'équipe TeranGO.</Text>
          <View style={styles.docRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.docHeader}>Carte grise</Text>
              <PhotoTile large icon="📄" label="Téléverser" url={registrationPhoto} onUploaded={setRegistrationPhoto} onRemove={function() { setRegistrationPhoto(''); }} />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.docHeader}>Assurance</Text>
              <PhotoTile large icon="📄" label="Téléverser" url={insurancePhoto} onUploaded={setInsurancePhoto} onRemove={function() { setInsurancePhoto(''); }} />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Tarif et conditions</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.fieldLabel}>Tarif / jour (FCFA)</Text>
              <TextInput style={styles.input} value={dailyRate} onChangeText={setDailyRate} keyboardType="numeric" placeholder="15000" placeholderTextColor="#999" />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.fieldLabel}>Caution (FCFA)</Text>
              <TextInput style={styles.input} value={depositRequired} onChangeText={setDepositRequired} keyboardType="numeric" placeholder="50000" placeholderTextColor="#999" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 6 }}>
              <Text style={styles.fieldLabel}>Durée min (jours)</Text>
              <TextInput style={styles.input} value={minRentalDays} onChangeText={setMinRentalDays} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1, marginLeft: 6 }}>
              <Text style={styles.fieldLabel}>Durée max (jours)</Text>
              <TextInput style={styles.input} value={maxRentalDays} onChangeText={setMaxRentalDays} keyboardType="numeric" />
            </View>
          </View>
          <Text style={styles.fieldLabel}>Conditions (optionnel)</Text>
          <TextInput style={[styles.input, styles.inputMultiline]} value={conditions} onChangeText={setConditions} multiline placeholder="Ex: non-fumeur, restituer avec plein de carburant..." placeholderTextColor="#999" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. À qui louez-vous?</Text>
          {RENTAL_TYPES.map(function(t) {
            var active = rentalType === t.value;
            return (
              <TouchableOpacity key={t.value} onPress={function() { setRentalType(t.value); }} style={[styles.audienceCard, active && styles.audienceCardActive]}>
                <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.audienceLabel, active && { color: COLORS.green }]}>{t.label}</Text>
                  <Text style={styles.audienceSub}>{t.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {"Votre annonce passera par une vérification (24h max). Vous recevrez 15 000 FCFA de frais d'agence à chaque mise en relation acceptée et payée par le locataire."}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Publier l'annonce</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8', marginRight: 12 },
  backIcon: { fontSize: 28, color: '#1A1A1A', marginTop: -4, fontFamily: 'LexendDeca_700Bold' },
  headerTitle: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: '#757575', marginTop: 2, fontFamily: 'LexendDeca_400Regular' },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 4 },
  sectionSub: { fontSize: 12, color: '#5a5a5a', marginBottom: 12, fontFamily: 'LexendDeca_400Regular' },
  fieldLabel: { fontSize: 12, color: '#1A1A1A', marginTop: 12, marginBottom: 6, fontFamily: 'LexendDeca_600SemiBold' },
  input: { borderWidth: 1, borderColor: '#EEF0F3', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: 'LexendDeca_400Regular' },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  choiceRow: { flexDirection: 'row', marginTop: 4 },
  choicePill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: '#F4F6F8', marginRight: 8, borderWidth: 1, borderColor: '#EEF0F3' },
  choicePillActive: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  choicePillText: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold', color: '#757575' },
  choicePillTextActive: { color: '#FFF' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  photoTile: { width: '31%', aspectRatio: 1, marginRight: '2%', marginBottom: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#EEF0F3', borderStyle: 'dashed', backgroundColor: '#FAFBFC', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoTileLarge: { width: '100%', aspectRatio: 1.6, marginRight: 0 },
  photoTileLabel: { fontSize: 11, color: '#5a5a5a', marginTop: 4, fontFamily: 'LexendDeca_400Regular' },
  removeBadge: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  removeBadgeText: { color: '#FFF', fontSize: 11, fontFamily: 'LexendDeca_700Bold' },
  docRow: { flexDirection: 'row', marginTop: 8 },
  docHeader: { fontSize: 11, color: '#5a5a5a', marginBottom: 6, fontFamily: 'LexendDeca_600SemiBold' },
  audienceCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8, backgroundColor: '#F4F6F8', borderWidth: 2, borderColor: 'transparent' },
  audienceCardActive: { backgroundColor: 'rgba(0,133,63,0.08)', borderColor: COLORS.green },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#CCC', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: COLORS.green },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  audienceLabel: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  audienceSub: { fontSize: 12, color: '#5a5a5a', marginTop: 2, fontFamily: 'LexendDeca_400Regular' },
  notice: { padding: 12, borderRadius: 10, backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  noticeText: { fontSize: 12, color: '#5a5a5a', lineHeight: 18, fontFamily: 'LexendDeca_400Regular' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  submitBtn: { backgroundColor: COLORS.green, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'LexendDeca_700Bold' }
});
