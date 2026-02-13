import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Image,
  TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';

const DocumentUploadScreen = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [vehicleType, setVehicleType] = useState(null);
  const [selfiePhoto, setSelfiePhoto] = useState(null);
  const [nationalIdPhoto, setNationalIdPhoto] = useState(null);
  const [driverLicensePhoto, setDriverLicensePhoto] = useState(null);
  const [vehicleRegPhoto, setVehicleRegPhoto] = useState(null);
  const [vehicleMake, setVehicleMake] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [loading, setLoading] = useState(false);

  const takePhoto = async (setter) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Activez la camera pour continuer.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) setter(result.assets[0]);
  };

  const pickOrTakePhoto = (setter) => {
    Alert.alert('Photo', '', [
      { text: 'Camera', onPress: () => takePhoto(setter) },
      {
        text: 'Galerie', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
          });
          if (!result.canceled) setter(result.assets[0]);
        }
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('selfie', { uri: selfiePhoto.uri, type: 'image/jpeg', name: 'selfie.jpg' });
      formData.append('nationalId', { uri: nationalIdPhoto.uri, type: 'image/jpeg', name: 'cni.jpg' });
      formData.append('driverLicense', { uri: driverLicensePhoto.uri, type: 'image/jpeg', name: 'permis.jpg' });
      if (vehicleRegPhoto) {
        formData.append('vehicleRegistration', { uri: vehicleRegPhoto.uri, type: 'image/jpeg', name: 'carte_grise.jpg' });
      }
      formData.append('vehicleMake', vehicleMake);
      formData.append('vehicleType', vehicleType);
      if (licensePlate) formData.append('licensePlate', licensePlate);

      await driverService.uploadDocuments(formData);
      Alert.alert(
        'Documents soumis !',
        'Votre compte est en cours de verification. Vous recevrez une notification.',
        [{ text: 'OK', onPress: onComplete }]
      );
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Erreur', "Reessayez s'il vous plait.");
    } finally {
      setLoading(false);
    }
  };

  const PhotoBox = ({ label, photo, onPress, icon }) => (
    <TouchableOpacity style={[styles.photoBox, photo && styles.photoBoxDone]} onPress={onPress}>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoIcon}>{icon || '📷'}</Text>
          <Text style={styles.photoLabel}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // ===== STEP 1: VEHICLE TYPE =====
  if (step === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Bienvenue sur TeranGO</Text>
          <Text style={styles.subtitle}>Quel type de vehicule utilisez-vous ?</Text>

          <TouchableOpacity
            style={[styles.typeCard, vehicleType === 'car' && styles.typeCardSelected]}
            onPress={() => setVehicleType('car')}
          >
            <Text style={styles.typeIcon}>🚗</Text>
            <Text style={[styles.typeText, vehicleType === 'car' && styles.typeTextSelected]}>Voiture / Taxi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeCard, vehicleType === 'moto' && styles.typeCardSelected]}
            onPress={() => setVehicleType('moto')}
          >
            <Text style={styles.typeIcon}>🏍️</Text>
            <Text style={[styles.typeText, vehicleType === 'moto' && styles.typeTextSelected]}>Moto / Jakarta</Text>
          </TouchableOpacity>

          {vehicleType && (
            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
              <Text style={styles.nextBtnText}>Continuer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  // ===== STEP 2: PHOTOS =====
  if (step === 2) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Vos documents</Text>
        <Text style={styles.subtitle}>Prenez des photos claires</Text>

        <Text style={styles.sectionLabel}>Selfie</Text>
        <PhotoBox label="Prenez un selfie" photo={selfiePhoto} onPress={() => takePhoto(setSelfiePhoto)} icon="🤳" />

        <Text style={styles.sectionLabel}>Carte Nationale d'Identite (CNI)</Text>
        <PhotoBox label="Photo de votre CNI" photo={nationalIdPhoto} onPress={() => pickOrTakePhoto(setNationalIdPhoto)} icon="🪪" />

        <Text style={styles.sectionLabel}>Permis de conduire</Text>
        <PhotoBox label="Photo de votre permis" photo={driverLicensePhoto} onPress={() => pickOrTakePhoto(setDriverLicensePhoto)} icon="📄" />

        {vehicleType === 'car' && (
          <>
            <Text style={styles.sectionLabel}>Carte grise du vehicule</Text>
            <PhotoBox label="Photo de la carte grise" photo={vehicleRegPhoto} onPress={() => pickOrTakePhoto(setVehicleRegPhoto)} icon="📋" />
          </>
        )}

        <View style={{ height: 16 }} />
        {selfiePhoto && nationalIdPhoto && driverLicensePhoto && (vehicleType === 'moto' || vehicleRegPhoto) ? (
          <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}>
            <Text style={styles.nextBtnText}>Continuer</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hintText}>Ajoutez toutes les photos pour continuer</Text>
        )}

        <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ===== STEP 3: VEHICLE INFO =====
  if (step === 3) {
    const isCar = vehicleType === 'car';
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Votre {isCar ? 'vehicule' : 'moto'}</Text>
        <Text style={styles.subtitle}>Derniere etape !</Text>

        <Text style={styles.sectionLabel}>{isCar ? 'Marque et modele' : 'Marque de la moto'}</Text>
        <TextInput
          style={styles.input}
          placeholder={isCar ? 'Ex: Toyota Corolla' : 'Ex: Jakarta Haojue'}
          placeholderTextColor="#999"
          value={vehicleMake}
          onChangeText={setVehicleMake}
        />

        {isCar ? (
          <>
            <Text style={styles.sectionLabel}>Plaque d'immatriculation</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: DK-1234-AB"
              placeholderTextColor="#999"
              value={licensePlate}
              onChangeText={setLicensePlate}
              autoCapitalize="characters"
            />
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Plaque (si disponible)</Text>
            <TextInput
              style={styles.input}
              placeholder="Optionnel"
              placeholderTextColor="#999"
              value={licensePlate}
              onChangeText={setLicensePlate}
              autoCapitalize="characters"
            />
          </>
        )}

        <View style={{ height: 24 }} />
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.green} />
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, (!vehicleMake.trim() || (isCar && !licensePlate.trim())) && styles.nextBtnDisabled]}
            onPress={handleSubmit}
            disabled={!vehicleMake.trim() || (isCar && !licensePlate.trim())}
          >
            <Text style={styles.nextBtnText}>Soumettre</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => setStep(2)} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Retour</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  title: {
    fontSize: 26, fontWeight: '800', color: '#00853F',
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32,
  },
  typeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 16, padding: 20,
    marginBottom: 12, borderWidth: 2, borderColor: 'transparent',
  },
  typeCardSelected: {
    borderColor: '#00853F', backgroundColor: 'rgba(0,133,63,0.05)',
  },
  typeIcon: { fontSize: 36, marginRight: 16 },
  typeText: { fontSize: 18, fontWeight: '600', color: '#333' },
  typeTextSelected: { color: '#00853F' },
  nextBtn: {
    backgroundColor: '#00853F', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 16,
  },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  backBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 12 },
  backBtnText: { color: '#999', fontSize: 15 },
  sectionLabel: {
    fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 8, marginTop: 16,
  },
  photoBox: {
    height: 150, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
    borderColor: '#DDD', overflow: 'hidden', backgroundColor: '#FAFAFA',
  },
  photoBoxDone: { borderStyle: 'solid', borderColor: '#00853F' },
  photoPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
  },
  photoIcon: { fontSize: 32, marginBottom: 6 },
  photoLabel: { fontSize: 14, color: '#999' },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  input: {
    backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16,
    fontSize: 16, color: '#333', borderWidth: 1, borderColor: '#EEE',
  },
  hintText: {
    fontSize: 13, color: '#999', textAlign: 'center', marginTop: 8,
  },
});

export default DocumentUploadScreen;