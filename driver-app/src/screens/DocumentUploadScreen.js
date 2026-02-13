import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Image,
  TouchableOpacity, TextInput, ActivityIndicator, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import GlassButton from '../components/GlassButton';
import GlassCard from '../components/GlassCard';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';

const DocumentUploadScreen = ({ onComplete }) => {
  const [selfiePhoto, setSelfiePhoto] = useState(null);
  const [nationalIdPhoto, setNationalIdPhoto] = useState(null);
  const [driverLicensePhoto, setDriverLicensePhoto] = useState(null);
  const [vehicleRegPhoto, setVehicleRegPhoto] = useState(null);
  const [insurancePhoto, setInsurancePhoto] = useState(null);
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [driverLicenseNumber, setDriverLicenseNumber] = useState('');
  const [licenseExpiryDate, setLicenseExpiryDate] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [loading, setLoading] = useState(false);

  const pickImage = async (setter) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de votre permission pour les photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) setter(result.assets[0]);
  };

  const takePhoto = async (setter) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Nous avons besoin de la camera.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) setter(result.assets[0]);
  };

  const showImageOptions = (setter, cameraOnly) => {
    if (cameraOnly) {
      takePhoto(setter);
      return;
    }
    Alert.alert('Ajouter une photo', 'Choisissez une option', [
      { text: 'Prendre une photo', onPress: () => takePhoto(setter) },
      { text: 'Galerie', onPress: () => pickImage(setter) },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!selfiePhoto) {
      Alert.alert('Erreur', 'Prenez un selfie pour verifier votre identite');
      return;
    }
    if (!nationalIdPhoto) {
      Alert.alert('Erreur', "Photo de la Carte Nationale d'Identite requise");
      return;
    }
    if (!nationalIdNumber.trim()) {
      Alert.alert('Erreur', "Numero de la Carte Nationale d'Identite requis");
      return;
    }
    if (!driverLicensePhoto) {
      Alert.alert('Erreur', 'Photo du Permis de conduire requise');
      return;
    }
    if (!driverLicenseNumber.trim()) {
      Alert.alert('Erreur', 'Numero du Permis de conduire requis');
      return;
    }
    if (!licenseExpiryDate.trim()) {
      Alert.alert('Erreur', "Date d'expiration du permis requise");
      return;
    }
    if (!vehicleMake.trim() || !licensePlate.trim()) {
      Alert.alert('Erreur', 'Marque du vehicule et plaque requises');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();

      formData.append('selfie', {
        uri: selfiePhoto.uri,
        type: 'image/jpeg',
        name: 'selfie.jpg',
      });
      formData.append('nationalId', {
        uri: nationalIdPhoto.uri,
        type: 'image/jpeg',
        name: 'national_id.jpg',
      });
      formData.append('driverLicense', {
        uri: driverLicensePhoto.uri,
        type: 'image/jpeg',
        name: 'driver_license.jpg',
      });
      if (vehicleRegPhoto) {
        formData.append('vehicleRegistration', {
          uri: vehicleRegPhoto.uri,
          type: 'image/jpeg',
          name: 'vehicle_reg.jpg',
        });
      }
      if (insurancePhoto) {
        formData.append('insurance', {
          uri: insurancePhoto.uri,
          type: 'image/jpeg',
          name: 'insurance.jpg',
        });
      }

      formData.append('nationalIdNumber', nationalIdNumber);
      formData.append('driverLicenseNumber', driverLicenseNumber);
      formData.append('licenseExpiryDate', licenseExpiryDate);
      formData.append('vehicleMake', vehicleMake);
      formData.append('vehicleModel', vehicleModel);
      formData.append('vehicleYear', vehicleYear || '2020');
      formData.append('vehicleColor', vehicleColor);
      formData.append('licensePlate', licensePlate);

      await driverService.uploadDocuments(formData);
      Alert.alert(
        'Documents soumis!',
        'Vos documents sont en cours de verification. Vous serez notifie une fois approuve.',
        [{ text: 'OK', onPress: onComplete }]
      );
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Erreur', "Erreur lors de l'envoi. Reessayez.");
    } finally {
      setLoading(false);
    }
  };

  const renderImagePicker = (label, photo, setter, required, cameraOnly) => (
    <View style={styles.imageSection}>
      <Text style={styles.imageLabel}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TouchableOpacity
        style={[styles.imagePicker, photo && styles.imagePickerWithPhoto]}
        onPress={() => showImageOptions(setter, cameraOnly)}
      >
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.previewImage} />
        ) : (
          <View style={styles.imagePickerInner}>
            <Text style={styles.imagePickerIcon}>{cameraOnly ? '🤳' : '📷'}</Text>
            <Text style={styles.imagePickerText}>
              {cameraOnly ? 'Prendre un selfie' : 'Appuyez pour ajouter'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.logoCircle}>
        <Text style={styles.logoText}>📋</Text>
      </View>
      <Text style={styles.appTitle}>TeranGO Chauffeur</Text>
      <Text style={styles.subtitle}>Soumettez vos documents pour verification</Text>

      {/* SELFIE SECTION */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Verification d'identite</Text>
        {renderImagePicker("Selfie (photo de vous)", selfiePhoto, setSelfiePhoto, true, true)}
        <Text style={styles.hintText}>Prenez une photo claire de votre visage. Elle sera comparee avec votre CNI.</Text>
      </GlassCard>

      {/* DOCUMENTS SECTION */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Documents requis</Text>

        {renderImagePicker("Carte Nationale d'Identite (CNI)", nationalIdPhoto, setNationalIdPhoto, true, false)}

        <Text style={styles.label}>Numero CNI <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="Ex: 1234567890123" placeholderTextColor={COLORS.grayLight}
          value={nationalIdNumber} onChangeText={setNationalIdNumber} keyboardType="number-pad" />

        {renderImagePicker("Permis de conduire", driverLicensePhoto, setDriverLicensePhoto, true, false)}

        <Text style={styles.label}>Numero du permis <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="Ex: PC-12345" placeholderTextColor={COLORS.grayLight}
          value={driverLicenseNumber} onChangeText={setDriverLicenseNumber} autoCapitalize="characters" />

        <Text style={styles.label}>Date d'expiration du permis <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="JJ/MM/AAAA" placeholderTextColor={COLORS.grayLight}
          value={licenseExpiryDate} onChangeText={setLicenseExpiryDate} keyboardType="number-pad" maxLength={10} />
      </GlassCard>

      {/* VEHICLE SECTION */}
      <GlassCard style={styles.card}>
        <Text style={styles.sectionTitle}>Informations du vehicule</Text>

        <Text style={styles.label}>Marque <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="Ex: Toyota" placeholderTextColor={COLORS.grayLight}
          value={vehicleMake} onChangeText={setVehicleMake} />

        <Text style={styles.label}>Modele</Text>
        <TextInput style={styles.input} placeholder="Ex: Corolla" placeholderTextColor={COLORS.grayLight}
          value={vehicleModel} onChangeText={setVehicleModel} />

        <Text style={styles.label}>Annee</Text>
        <TextInput style={styles.input} placeholder="Ex: 2020" placeholderTextColor={COLORS.grayLight}
          value={vehicleYear} onChangeText={setVehicleYear} keyboardType="number-pad" maxLength={4} />

        <Text style={styles.label}>Couleur</Text>
        <TextInput style={styles.input} placeholder="Ex: Blanc" placeholderTextColor={COLORS.grayLight}
          value={vehicleColor} onChangeText={setVehicleColor} />

        <Text style={styles.label}>Plaque d'immatriculation <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="Ex: DK-1234-AB" placeholderTextColor={COLORS.grayLight}
          value={licensePlate} onChangeText={setLicensePlate} autoCapitalize="characters" />

        {renderImagePicker("Carte grise du vehicule", vehicleRegPhoto, setVehicleRegPhoto, false, false)}
        {renderImagePicker("Assurance du vehicule", insurancePhoto, setInsurancePhoto, false, false)}
      </GlassCard>

      <View style={styles.buttonContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.green} />
        ) : (
          <GlassButton title="Soumettre les documents" onPress={handleSubmit} />
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,133,63,0.15)', alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  logoText: { fontSize: 36 },
  appTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.green, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.gray, textAlign: 'center', marginBottom: 24 },
  card: {
    backgroundColor: 'rgba(0, 133, 63, 0.08)', borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: 'rgba(0, 133, 63, 0.2)', marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.black, marginBottom: 16 },
  imageSection: { marginBottom: 20 },
  imageLabel: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 8 },
  required: { color: COLORS.red },
  imagePicker: {
    height: 160, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
    borderColor: COLORS.grayLight, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.white, overflow: 'hidden',
  },
  imagePickerWithPhoto: { borderStyle: 'solid', borderColor: COLORS.green },
  imagePickerInner: { alignItems: 'center' },
  imagePickerIcon: { fontSize: 32, marginBottom: 8 },
  imagePickerText: { fontSize: 14, color: COLORS.gray },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.black, marginBottom: 8, marginTop: 4 },
  input: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
    fontSize: 16, color: COLORS.black, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.grayLight,
  },
  hintText: { fontSize: 12, color: COLORS.gray, marginTop: -12, marginBottom: 8, fontStyle: 'italic' },
  buttonContainer: { marginTop: 8, marginBottom: 16 },
});

export default DocumentUploadScreen;