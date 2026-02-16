import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Animated } from 'react-native';
import { useAuth } from '../context/AuthContext';
import COLORS from '../constants/colors';

function ThiakThiakScreen(props) {
  var navigation = props.navigation;
  var route = props.route;
  var currentLocation = route.params ? route.params.currentLocation : null;
  var auth = useAuth();
  var user = auth.user;

  var fadeAnim = useState(new Animated.Value(0))[0];
  var slideAnim1 = useState(new Animated.Value(50))[0];
  var slideAnim2 = useState(new Animated.Value(50))[0];
  var slideAnim3 = useState(new Animated.Value(50))[0];

  useEffect(function() {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim1, { toValue: 0, duration: 500, delay: 100, useNativeDriver: true }),
      Animated.timing(slideAnim2, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
      Animated.timing(slideAnim3, { toValue: 0, duration: 500, delay: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  function handleServicePress(serviceType) {
    if (serviceType === 'colis') { navigation.navigate('Colis', { currentLocation: currentLocation }); }
    else if (serviceType === 'commande') { navigation.navigate('Commande', { currentLocation: currentLocation }); }
    else if (serviceType === 'resto') { navigation.navigate('RestaurantList', { currentLocation: currentLocation }); }
  }

  var services = [
    { type: 'colis', icon: '📦', title: 'Envoyer un Colis', description: 'Envoyez vos colis partout à Dakar. Petit, moyen ou grand format.', priceLabel: 'À partir de 500 FCFA', color: COLORS.green, anim: slideAnim1 },
    { type: 'commande', icon: '🛒', title: 'Faire une Commande', description: 'Pharmacie, supermarché, boutique... on va chercher pour vous!', priceLabel: 'À partir de 1000 FCFA', color: '#FF9500', anim: slideAnim2 },
    { type: 'resto', icon: '🍽️', title: 'Commander un Repas', description: 'Vos restaurants préférés livrés chez vous. Thiéboudienne, yassa...', priceLabel: 'Frais de livraison inclus', color: '#FF3B30', anim: slideAnim3 },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={function() { navigation.goBack(); }}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <View style={styles.headerTitleWrap}><Text style={styles.headerTitle}>Thiak Thiak</Text><Text style={styles.headerSub}>Livraison et Commandes</Text></View>
      </View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeEmoji}>🛵</Text>
            <Text style={styles.welcomeTitle}>{'Salut ' + ((user && user.name) ? user.name.split(' ')[0] : '') + '!'}</Text>
            <Text style={styles.welcomeSub}>Que souhaitez-vous envoyer ou commander?</Text>
          </View>
        </Animated.View>
        {services.map(function(service) { return (
          <Animated.View key={service.type} style={{ transform: [{ translateY: service.anim }], opacity: fadeAnim }}>
            <TouchableOpacity style={styles.serviceCard} onPress={function() { handleServicePress(service.type); }} activeOpacity={0.85}>
              <View style={styles.serviceIconWrap}><View style={[styles.serviceIconBg, { backgroundColor: service.color + '20' }]}><Text style={styles.serviceIcon}>{service.icon}</Text></View></View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.serviceDesc}>{service.description}</Text>
                <View style={styles.priceRow}><View style={[styles.priceBadge, { backgroundColor: service.color + '20' }]}><Text style={[styles.priceText, { color: service.color }]}>{service.priceLabel}</Text></View></View>
              </View>
              <View style={styles.serviceArrow}><Text style={styles.arrowText}>›</Text></View>
            </TouchableOpacity>
          </Animated.View>
        ); })}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Comment ça marche?</Text>
          <View style={styles.infoStep}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View><Text style={styles.stepText}>Choisissez votre service</Text></View>
          <View style={styles.infoStep}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View><Text style={styles.stepText}>Indiquez les détails et adresses</Text></View>
          <View style={styles.infoStep}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View><Text style={styles.stepText}>Un livreur prend en charge votre demande</Text></View>
          <View style={styles.infoStep}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View><Text style={styles.stepText}>Suivez en temps réel et recevez!</Text></View>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: COLORS.darkCard, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderBottomWidth: 1, borderBottomColor: COLORS.darkCardBorder },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backIcon: { fontSize: 20, fontWeight: 'bold', color: COLORS.textLight },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: COLORS.textLight },
  headerSub: { fontSize: 13, color: COLORS.textLightSub, marginTop: 2 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  welcomeCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  welcomeEmoji: { fontSize: 48, marginBottom: 12 },
  welcomeTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textLight, marginBottom: 6 },
  welcomeSub: { fontSize: 14, color: COLORS.textLightSub, textAlign: 'center' },
  serviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundWhite, borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.grayLight, elevation: 2 },
  serviceIconWrap: { marginRight: 16 },
  serviceIconBg: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  serviceIcon: { fontSize: 30 },
  serviceInfo: { flex: 1 },
  serviceTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textDark, marginBottom: 4 },
  serviceDesc: { fontSize: 13, color: COLORS.textDarkSub, lineHeight: 18, marginBottom: 8 },
  priceRow: { flexDirection: 'row' },
  priceBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  priceText: { fontSize: 12, fontWeight: '600' },
  serviceArrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.darkCard, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  arrowText: { fontSize: 22, color: COLORS.textLight, fontWeight: 'bold' },
  infoCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 20, marginTop: 10, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  infoTitle: { fontSize: 16, fontWeight: '700', color: COLORS.yellow, marginBottom: 16 },
  infoStep: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  stepNumberText: { fontSize: 14, fontWeight: 'bold', color: COLORS.darkBg },
  stepText: { fontSize: 14, color: COLORS.textLightSub, flex: 1 },
});

export default ThiakThiakScreen;
