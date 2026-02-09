import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Alert,
  Animated,
  Linking,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../constants/colors';
import * as ImagePicker from 'expo-image-picker';
import { driverService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';

var MenuScreen = function(props) {
  var navigation = props.navigation;
  var auth = useAuth();
  var user = auth.user;
  var driver = auth.driver;
  var logout = auth.logout;
  var updateUser = auth.updateUser;

  var earningsState = useState({
    today: 0, todayRides: 0, total: 0, totalRides: 0,
    weekTotal: 0, weekRides: 0,
    weeklyBreakdown: [0, 0, 0, 0, 0, 0, 0],
    weeklyRides: [0, 0, 0, 0, 0, 0, 0],
  });
  var earnings = earningsState[0];
  var setEarnings = earningsState[1];

  var historyState = useState([]);
  var rideHistory = historyState[0];
  var setRideHistory = historyState[1];

  var tabState = useState('menu');
  var activeTab = tabState[0];
  var setActiveTab = tabState[1];

  var animState = useState(new Animated.Value(1));
  var fadeAnim = animState[0];

  var notifState = useState(true);
  var notificationsEnabled = notifState[0];
  var setNotificationsEnabled = notifState[1];

  var soundState = useState(true);
  var soundEnabled = soundState[0];
  var setSoundEnabled = soundState[1];

  var langState = useState('Fran\u00e7ais');
  var language = langState[0];
  var setLanguage = langState[1];

  useEffect(function() {
    fetchEarnings();
    fetchHistory();
  }, []);

  function fetchEarnings() {
    driverService.getEarnings().then(function(response) {
      var e = response.earnings || {};
      setEarnings({
        today: e.today || 0,
        todayRides: e.todayRides || 0,
        total: e.total || 0,
        totalRides: e.totalRides || 0,
        weekTotal: e.weekTotal || 0,
        weekRides: e.weekRides || 0,
        weeklyBreakdown: e.weeklyBreakdown || [0, 0, 0, 0, 0, 0, 0],
        weeklyRides: e.weeklyRides || [0, 0, 0, 0, 0, 0, 0],
      });
    }).catch(function(error) {
      console.log('Earnings error:', error);
    });
  }

  function fetchHistory() {
    driverService.getRideHistory().then(function(response) {
      setRideHistory(response.rides || []);
    }).catch(function(error) {
      console.log('History error:', error);
    });
  }

  // ========== PHOTO LOGIC ==========

  function takeLivePhoto() {
    Alert.alert(
      "Photo d'identit\u00e9",
      "Prenez une photo en direct pour v\u00e9rification. La photo doit montrer clairement votre visage.\n\n\u26A0\uFE0F Les photos de galerie ne sont pas accept\u00e9es.",
      [
        {
          text: 'Prendre la photo',
          onPress: function() {
            ImagePicker.requestCameraPermissionsAsync().then(function(perm) {
              if (perm.status !== 'granted') {
                Alert.alert('Permission requise', "Autorisez l'acc\u00e8s \u00e0 la cam\u00e9ra.");
                return;
              }
              ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
                cameraType: ImagePicker.CameraType.front,
              }).then(function(result) {
                if (!result.canceled) {
                  uploadPhoto(result.assets[0].uri);
                }
              });
            });
          }
        },
        { text: 'Annuler', style: 'cancel' }
      ]
    );
  }

  function uploadPhoto(uri) {
    var formData = new FormData();
    formData.append('photo', {
      uri: uri,
      type: 'image/jpeg',
      name: 'profile.jpg',
    });
    driverService.uploadProfilePhoto(formData).then(function(response) {
      if (response.success) {
        updateUser({
          profilePhoto: response.profilePhoto,
          photoStatus: 'pending',
          photoVerified: false,
          photoUpdatedAt: new Date().toISOString()
        });
        Alert.alert(
          'Photo envoy\u00e9e',
          "Votre photo est en cours de v\u00e9rification par l'\u00e9quipe TeranGO. Cela peut prendre jusqu'\u00e0 24h."
        );
      } else {
        Alert.alert('Erreur', response.message || '\u00c9chec du t\u00e9l\u00e9chargement');
      }
    }).catch(function(error) {
      console.log('Upload error:', error);
      Alert.alert('Erreur', 'Impossible de t\u00e9l\u00e9charger la photo');
    });
  }

  function pickPhoto() {
    if (user && user.profilePhoto) {
      var status = (user.photoStatus) || 'pending';
      if (status === 'expired') {
        takeLivePhoto();
        return;
      }
      if (status === 'approved' || user.photoVerified) {
        Alert.alert(
          'Photo v\u00e9rifi\u00e9e \u2714',
          "Votre photo d'identit\u00e9 est v\u00e9rifi\u00e9e et active.\n\nSeul TeranGO peut demander une mise \u00e0 jour de votre photo.",
          [{ text: 'OK' }]
        );
        return;
      }
      Alert.alert(
        'Photo en attente',
        "Votre photo est en cours de v\u00e9rification par l'\u00e9quipe TeranGO. Vous recevrez une notification une fois approuv\u00e9e.",
        [{ text: 'OK' }]
      );
      return;
    }
    takeLivePhoto();
  }

  // ========== NAVIGATION ==========

  function switchTab(tab) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setTimeout(function() { setActiveTab(tab); }, 120);
  }

  function handleLogout() {
    Alert.alert('D\u00e9connexion', 'Voulez-vous vraiment vous d\u00e9connecter?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'D\u00e9connexion',
        style: 'destructive',
        onPress: function() {
          logout();
        }
      }
    ]);
  }

  // ========== FORMATTERS ==========

  function formatDate(dateStr) {
    if (!dateStr) return '';
    var date = new Date(dateStr);
    var now = new Date();
    var diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return 'Il y a ' + diffDays + ' jours';
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // ========== AVATAR ==========

  function renderAvatar() {
    if (user && user.profilePhoto) {
      return React.createElement(Image, { source: { uri: user.profilePhoto }, style: styles.avatarImg });
    }
    var letter = (user && user.name) ? user.name.charAt(0).toUpperCase() : 'D';
    return (
      <View style={styles.avatar}>
        <Text style={styles.avatarLetter}>{letter}</Text>
      </View>
    );
  }

  function getPhotoBadge() {
    if (user && user.photoVerified) {
      return { style: [styles.editBadge, styles.editBadgeVerified], text: '\u2714' };
    }
    if (user && user.profilePhoto) {
      return { style: [styles.editBadge, styles.editBadgePending], text: '\u23F3' };
    }
    return { style: styles.editBadge, text: '\uD83D\uDCF7' };
  }

  // ========== EARNINGS TAB ==========

  function renderEarningsTab() {
    var days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    var todayIndex = (new Date().getDay() + 6) % 7;
    var progress = Math.min((earnings.today / 25000) * 100, 100);

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.earningsHero}>
          <Text style={styles.earningsHeroLabel}>{"Gains Aujourd'hui"}</Text>
          <View style={styles.earningsHeroRow}>
            <Text style={styles.earningsHeroValue}>{earnings.today.toLocaleString()}</Text>
            <Text style={styles.earningsHeroCurrency}>FCFA</Text>
          </View>
          <View style={styles.progressBarOuter}>
            <View style={[styles.progressBarInner, { width: progress + '%' }]} />
          </View>
          <Text style={styles.progressLabel}>{'Objectif: 25,000 FCFA \u2022 ' + earnings.todayRides + ' course' + (earnings.todayRides !== 1 ? 's' : '') + " aujourd'hui"}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statIcon}>{'\uD83D\uDE97'}</Text>
            <Text style={styles.statNum}>{earnings.totalRides}</Text>
            <Text style={styles.statLbl}>Courses</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statIcon}>{'\uD83D\uDCB0'}</Text>
            <Text style={styles.statNum}>{earnings.total.toLocaleString()}</Text>
            <Text style={styles.statLbl}>Total FCFA</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statIcon}>{'\u2B50'}</Text>
            <Text style={styles.statNum}>{user && user.rating ? user.rating.toFixed(1) : '5.0'}</Text>
            <Text style={styles.statLbl}>Note</Text>
          </View>
        </View>

        <View style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}>
            <Text style={styles.weeklyTitle}>Cette semaine</Text>
            <Text style={styles.weeklyTotal}>{earnings.weekTotal.toLocaleString() + ' FCFA'}</Text>
          </View>
          <Text style={styles.weeklySubtitle}>{earnings.weekRides + ' course' + (earnings.weekRides !== 1 ? 's' : '')}</Text>
          <View style={styles.weeklyBars}>
            {days.map(function(day, i) {
              var isToday = i === todayIndex;
              var dayEarning = earnings.weeklyBreakdown[i] || 0;
              var dayRides = earnings.weeklyRides[i] || 0;
              var maxEarning = Math.max.apply(null, earnings.weeklyBreakdown) || 1;
              var dayHeight = Math.max(dayEarning > 0 ? (dayEarning / maxEarning) * 60 + 10 : 8, 8);
              var hasData = dayEarning > 0;
              return (
                <View key={day} style={styles.barCol}>
                  {hasData && <Text style={styles.barAmount}>{(dayEarning / 1000).toFixed(0) + 'k'}</Text>}
                  <View style={[styles.bar, { height: dayHeight }, (isToday || hasData) && styles.barActive]} />
                  <Text style={[styles.barDay, (isToday || hasData) && styles.barDayActive]}>{day}</Text>
                  {isToday && <View style={styles.todayDot} />}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    );
  }

  // ========== HISTORY TAB ==========

  function renderHistoryTab() {
    if (rideHistory.length === 0) {
      return (
        <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{'\uD83D\uDE97'}</Text>
            <Text style={styles.emptyTitle}>Aucune course</Text>
            <Text style={styles.emptySub}>{"Vos courses compl\u00e9t\u00e9es appara\u00eetront ici"}</Text>
          </View>
        </ScrollView>
      );
    }

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {rideHistory.map(function(ride, index) {
          return (
            <View key={ride._id || index} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <Text style={styles.historyDate}>{formatDate(ride.completedAt || ride.updatedAt)}</Text>
                <Text style={styles.historyFare}>{(ride.driverEarnings || ride.fare || 0).toLocaleString() + ' FCFA'}</Text>
              </View>
              <View style={styles.historyRoute}>
                <View style={styles.dotLine}>
                  <View style={styles.gDot} />
                  <View style={styles.dLine} />
                  <View style={styles.rSquare} />
                </View>
                <View style={styles.addresses}>
                  <Text style={styles.addr} numberOfLines={1}>{ride.pickup ? ride.pickup.address || 'D\u00e9part' : 'D\u00e9part'}</Text>
                  <Text style={styles.addr} numberOfLines={1}>{ride.dropoff ? ride.dropoff.address || 'Arriv\u00e9e' : 'Arriv\u00e9e'}</Text>
                </View>
              </View>
              <View style={styles.historyFooter}>
                <Text style={styles.historyMeta}>{formatTime(ride.completedAt || ride.updatedAt)}</Text>
                <Text style={styles.historyMeta}>{(ride.distance ? ride.distance.toFixed(1) : '0') + ' km'}</Text>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeText}>{ride.rideType || 'standard'}</Text>
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ========== SUPPORT TAB ==========

  function renderSupportTab() {
    var faqs = [
      { q: 'Comment sont calcul\u00e9s mes gains?', a: 'Vous recevez 88-90% du tarif de chaque course. La commission TeranGO est de 10-12%.' },
      { q: 'Quand suis-je pay\u00e9?', a: 'Les paiements sont effectu\u00e9s chaque semaine via Wave ou Orange Money.' },
      { q: 'Comment am\u00e9liorer ma note?', a: 'Soyez ponctuel, conduisez prudemment, et maintenez votre v\u00e9hicule propre.' },
      { q: "Que faire en cas d'accident?", a: "Contactez imm\u00e9diatement le support et les services d'urgence si n\u00e9cessaire." },
    ];

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.supportHero}>
          <Text style={styles.supportIcon}>{'\uD83C\uDFA7'}</Text>
          <Text style={styles.supportTitle}>Comment pouvons-nous vous aider?</Text>
        </View>

        <TouchableOpacity style={styles.supportItem} onPress={function() { Linking.openURL('tel:+221338234567'); }}>
          <View style={[styles.sIconBox, { backgroundColor: 'rgba(76, 217, 100, 0.2)' }]}>
            <Text style={styles.sIcon}>{'\uD83D\uDCDE'}</Text>
          </View>
          <View style={styles.sText}>
            <Text style={styles.sTitle}>Appeler le support</Text>
            <Text style={styles.sDesc}>{"Disponible 7j/7 de 6h \u00e0 22h"}</Text>
          </View>
          <Text style={styles.sChevron}>{'\u203A'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.supportItem} onPress={function() { Linking.openURL('https://wa.me/221778234567'); }}>
          <View style={[styles.sIconBox, { backgroundColor: 'rgba(37, 211, 102, 0.2)' }]}>
            <Text style={styles.sIcon}>{'\uD83D\uDCAC'}</Text>
          </View>
          <View style={styles.sText}>
            <Text style={styles.sTitle}>WhatsApp</Text>
            <Text style={styles.sDesc}>{"R\u00e9ponse rapide par message"}</Text>
          </View>
          <Text style={styles.sChevron}>{'\u203A'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.supportItem} onPress={function() { Linking.openURL('mailto:support@terango.sn'); }}>
          <View style={[styles.sIconBox, { backgroundColor: 'rgba(66, 133, 244, 0.2)' }]}>
            <Text style={styles.sIcon}>{'\uD83D\uDCE7'}</Text>
          </View>
          <View style={styles.sText}>
            <Text style={styles.sTitle}>Email</Text>
            <Text style={styles.sDesc}>support@terango.sn</Text>
          </View>
          <Text style={styles.sChevron}>{'\u203A'}</Text>
        </TouchableOpacity>

        <View style={styles.faqBox}>
          <Text style={styles.faqHeader}>{"Questions fr\u00e9quentes"}</Text>
          {faqs.map(function(faq, i) {
            return (
              <View key={i} style={styles.faqItem}>
                <Text style={styles.faqQ}>{faq.q}</Text>
                <Text style={styles.faqA}>{faq.a}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  // ========== VEHICLE TAB ==========

  function renderVehicleTab() {
    var v = (driver && driver.vehicle) ? driver.vehicle : {};
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.vehicleHero}>
          <Text style={{ fontSize: 60, marginBottom: 12 }}>{'\uD83D\uDE97'}</Text>
          <Text style={styles.vehicleName}>{(v.make || 'Non renseign\u00e9') + ' ' + (v.model || '')}</Text>
          <Text style={styles.vehiclePlate}>{v.licensePlate || 'Aucune plaque'}</Text>
        </View>

        <View style={styles.vehicleGrid}>
          <View style={styles.vehicleItem}>
            <Text style={styles.vLabel}>Marque</Text>
            <Text style={styles.vValue}>{v.make || '-'}</Text>
          </View>
          <View style={styles.vehicleItem}>
            <Text style={styles.vLabel}>{"Mod\u00e8le"}</Text>
            <Text style={styles.vValue}>{v.model || '-'}</Text>
          </View>
          <View style={styles.vehicleItem}>
            <Text style={styles.vLabel}>{"Ann\u00e9e"}</Text>
            <Text style={styles.vValue}>{v.year || '-'}</Text>
          </View>
          <View style={styles.vehicleItem}>
            <Text style={styles.vLabel}>Couleur</Text>
            <Text style={styles.vValue}>{v.color || '-'}</Text>
          </View>
          <View style={styles.vehicleItem}>
            <Text style={styles.vLabel}>Plaque</Text>
            <Text style={styles.vValue}>{v.licensePlate || '-'}</Text>
          </View>
          <View style={styles.vehicleItem}>
            <Text style={styles.vLabel}>Type</Text>
            <Text style={styles.vValue}>{v.type || 'Berline'}</Text>
          </View>
        </View>

        <View style={styles.vehicleNote}>
          <Text style={styles.vehicleNoteIcon}>{"\u2139\uFE0F"}</Text>
          <Text style={styles.vehicleNoteText}>
            {"Pour modifier les informations de votre v\u00e9hicule, contactez le support TeranGO."}
          </Text>
        </View>
      </ScrollView>
    );
  }

  // ========== SETTINGS TAB ==========

  function renderSettingsTab() {
    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.settingsSection}>Notifications</Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity style={styles.settingsRow} onPress={function() { setNotificationsEnabled(!notificationsEnabled); }}>
            <Text style={styles.settingsEmoji}>{'\uD83D\uDD14'}</Text>
            <Text style={styles.settingsLabel}>Notifications push</Text>
            <View style={[styles.toggle, notificationsEnabled && styles.toggleOn]}>
              <View style={[styles.toggleDot, notificationsEnabled && styles.toggleDotOn]} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingsRow, { borderBottomWidth: 0 }]} onPress={function() { setSoundEnabled(!soundEnabled); }}>
            <Text style={styles.settingsEmoji}>{'\uD83D\uDCCA'}</Text>
            <Text style={styles.settingsLabel}>Sons de notification</Text>
            <View style={[styles.toggle, soundEnabled && styles.toggleOn]}>
              <View style={[styles.toggleDot, soundEnabled && styles.toggleDotOn]} />
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.settingsSection}>{"G\u00e9n\u00e9ral"}</Text>
        <View style={styles.settingsGroup}>
          <TouchableOpacity style={styles.settingsRow} onPress={function() {
            Alert.alert('Langue', 'Choisissez votre langue', [
              { text: 'Fran\u00e7ais', onPress: function() { setLanguage('Fran\u00e7ais'); } },
              { text: 'Wolof', onPress: function() { setLanguage('Wolof'); } },
              { text: 'English', onPress: function() { setLanguage('English'); } },
            ]);
          }}>
            <Text style={styles.settingsEmoji}>{'\uD83C\uDF10'}</Text>
            <Text style={styles.settingsLabel}>Langue</Text>
            <Text style={styles.settingsValue}>{language}</Text>
            <Text style={styles.mChevron}>{'\u203A'}</Text>
          </TouchableOpacity>
          <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.settingsEmoji}>{'\uD83D\uDCF1'}</Text>
            <Text style={styles.settingsLabel}>Version</Text>
            <Text style={styles.settingsValue}>1.0.0</Text>
          </View>
        </View>

        <Text style={styles.settingsSection}>Compte</Text>
        <View style={styles.settingsGroup}>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsEmoji}>{'\uD83D\uDCDE'}</Text>
            <Text style={styles.settingsLabel}>{"T\u00e9l\u00e9phone"}</Text>
            <Text style={styles.settingsValue}>{(user && user.phone) ? user.phone : '-'}</Text>
          </View>
          <View style={[styles.settingsRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.settingsEmoji}>{'\uD83D\uDCE7'}</Text>
            <Text style={styles.settingsLabel}>Email</Text>
            <Text style={styles.settingsValue}>{(user && user.email) ? user.email : '-'}</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  // ========== MAIN MENU ==========

  function renderMainMenu() {
    var badge = getPhotoBadge();
    var userName = (user && user.name) ? user.name : 'Chauffeur';
    var userRating = (user && user.rating) ? user.rating.toFixed(1) : '5.0';
    var vehicleMake = (driver && driver.vehicle && driver.vehicle.make) ? driver.vehicle.make : 'Non renseign\u00e9';
    var vehicleModel = (driver && driver.vehicle && driver.vehicle.model) ? driver.vehicle.model : '';

    return (
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto}>
            {renderAvatar()}
            <View style={styles.onlineDot} />
            <View style={badge.style}>
              <Text style={styles.editBadgeText}>{badge.text}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{userName}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.starIcon}>{'\u2B50'}</Text>
              <Text style={styles.ratingVal}>{userRating}</Text>
              <Text style={styles.ratingMeta}>{'\u2022 ' + earnings.totalRides + ' courses'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.earningsSummary}>
          <TouchableOpacity style={styles.earnBox} onPress={function() { switchTab('earnings'); }}>
            <Text style={styles.earnVal}>{earnings.today.toLocaleString()}</Text>
            <Text style={styles.earnLbl}>{"FCFA Aujourd'hui"}</Text>
          </TouchableOpacity>
          <View style={styles.earnDivider} />
          <TouchableOpacity style={styles.earnBox} onPress={function() { switchTab('earnings'); }}>
            <Text style={styles.earnVal}>{earnings.total.toLocaleString()}</Text>
            <Text style={styles.earnLbl}>FCFA Total</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuGroup}>
          <TouchableOpacity style={styles.menuRow} onPress={function() { switchTab('earnings'); }}>
            <View style={[styles.mIcon, { backgroundColor: 'rgba(0, 128, 0, 0.15)' }]}>
              <Text style={styles.mEmoji}>{'\uD83D\uDCB0'}</Text>
            </View>
            <View style={styles.mInfo}>
              <Text style={styles.mTitle}>Mes Gains</Text>
              <Text style={styles.mSub}>Suivez vos revenus</Text>
            </View>
            <Text style={styles.mChevron}>{'\u203A'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={function() { switchTab('history'); }}>
            <View style={[styles.mIcon, { backgroundColor: 'rgba(66, 133, 244, 0.15)' }]}>
              <Text style={styles.mEmoji}>{'\uD83D\uDCCB'}</Text>
            </View>
            <View style={styles.mInfo}>
              <Text style={styles.mTitle}>Historique</Text>
              <Text style={styles.mSub}>{earnings.totalRides + ' courses effectu\u00e9es'}</Text>
            </View>
            <Text style={styles.mChevron}>{'\u203A'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={function() { switchTab('vehicle'); }}>
            <View style={[styles.mIcon, { backgroundColor: 'rgba(252, 209, 22, 0.15)' }]}>
              <Text style={styles.mEmoji}>{'\uD83D\uDE97'}</Text>
            </View>
            <View style={styles.mInfo}>
              <Text style={styles.mTitle}>{"Mon V\u00e9hicule"}</Text>
              <Text style={styles.mSub}>{vehicleMake + ' ' + vehicleModel}</Text>
            </View>
            <Text style={styles.mChevron}>{'\u203A'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuRow} onPress={function() { switchTab('settings'); }}>
            <View style={[styles.mIcon, { backgroundColor: 'rgba(175, 82, 222, 0.15)' }]}>
              <Text style={styles.mEmoji}>{'\u2699\uFE0F'}</Text>
            </View>
            <View style={styles.mInfo}>
              <Text style={styles.mTitle}>{"Param\u00e8tres"}</Text>
              <Text style={styles.mSub}>Notifications, langue</Text>
            </View>
            <Text style={styles.mChevron}>{'\u203A'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.menuRow, { borderBottomWidth: 0 }]} onPress={function() { switchTab('support'); }}>
            <View style={[styles.mIcon, { backgroundColor: 'rgba(0, 199, 190, 0.15)' }]}>
              <Text style={styles.mEmoji}>{'\uD83C\uDFA7'}</Text>
            </View>
            <View style={styles.mInfo}>
              <Text style={styles.mTitle}>Aide & Support</Text>
              <Text style={styles.mSub}>FAQ, contact</Text>
            </View>
            <Text style={styles.mChevron}>{'\u203A'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>{'\uD83D\uDC4B'}</Text>
          <Text style={styles.logoutTxt}>{"Se d\u00e9connecter"}</Text>
        </TouchableOpacity>

        <Text style={styles.versionTxt}>TeranGO Driver v1.0.0</Text>
      </ScrollView>
    );
  }

  // ========== TITLE ==========

  function getTitle() {
    switch (activeTab) {
      case 'earnings': return 'Mes Gains';
      case 'history': return 'Historique';
      case 'support': return 'Aide & Support';
      case 'vehicle': return 'Mon V\u00e9hicule';
      case 'settings': return 'Param\u00e8tres';
      default: return 'Menu';
    }
  }

  // ========== RENDER ==========

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={function() {
          if (activeTab !== 'menu') { switchTab('menu'); } else { navigation.goBack(); }
        }}>
          <Text style={styles.backArrow}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTxt}>{getTitle()}</Text>
        <View style={{ width: 44 }} />
      </View>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        {activeTab === 'menu' && renderMainMenu()}
        {activeTab === 'earnings' && renderEarningsTab()}
        {activeTab === 'history' && renderHistoryTab()}
        {activeTab === 'support' && renderSupportTab()}
        {activeTab === 'vehicle' && renderVehicleTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </Animated.View>
    </View>
  );
};

var MINT = 'rgba(179, 229, 206, 0.95)';
var MINT_LIGHT = 'rgba(179, 229, 206, 0.12)';
var MINT_BORDER = 'rgba(179, 229, 206, 0.25)';
var YELLOW = '#FCD116';
var DARK_BG = '#0a0a0a';

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  tabContent: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: 'rgba(179, 229, 206, 0.06)',
    borderBottomWidth: 1, borderBottomColor: MINT_BORDER,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(179, 229, 206, 0.15)', alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 24, color: '#4CD964' },
  headerTxt: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: MINT, borderRadius: 20, padding: 20,
    marginTop: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  avatarWrap: { position: 'relative', marginRight: 16 },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
  },
  avatarLetter: { fontSize: 26, fontWeight: 'bold', color: '#4CD964' },
  avatarImg: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ccc' },
  editBadge: {
    position: 'absolute', bottom: -2, left: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: YELLOW, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: MINT,
  },
  editBadgeVerified: { backgroundColor: '#4CD964' },
  editBadgePending: { backgroundColor: '#FF9500' },
  editBadgeText: { fontSize: 12 },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#4CD964', borderWidth: 3, borderColor: MINT,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#000', marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  starIcon: { fontSize: 14, marginRight: 4 },
  ratingVal: { fontSize: 15, fontWeight: '700', color: '#000', marginRight: 6 },
  ratingMeta: { fontSize: 13, color: 'rgba(0,0,0,0.5)' },
  earningsSummary: {
    flexDirection: 'row', backgroundColor: 'rgba(252, 209, 22, 0.1)',
    borderRadius: 16, marginBottom: 24, overflow: 'hidden',
    borderWidth: 1.5, borderColor: 'rgba(252, 209, 22, 0.25)',
  },
  earnBox: { flex: 1, padding: 20, alignItems: 'center' },
  earnDivider: { width: 1, backgroundColor: 'rgba(252, 209, 22, 0.2)' },
  earnVal: { fontSize: 22, fontWeight: 'bold', color: YELLOW, marginBottom: 4 },
  earnLbl: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  menuGroup: {
    backgroundColor: MINT_LIGHT, borderRadius: 20, overflow: 'hidden', marginBottom: 24,
    borderWidth: 1, borderColor: MINT_BORDER,
  },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', padding: 18,
    borderBottomWidth: 1, borderBottomColor: 'rgba(179, 229, 206, 0.1)',
  },
  mIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  mEmoji: { fontSize: 22 },
  mInfo: { flex: 1 },
  mTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  mSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  mChevron: { fontSize: 22, color: '#4CD964', fontWeight: '600' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 18, borderRadius: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderWidth: 1, borderColor: 'rgba(255, 59, 48, 0.2)', marginBottom: 16,
  },
  logoutIcon: { fontSize: 20, marginRight: 10 },
  logoutTxt: { fontSize: 16, fontWeight: '600', color: '#FF3B30' },
  versionTxt: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.15)', marginBottom: 40 },
  earningsHero: {
    backgroundColor: MINT, borderRadius: 24, padding: 28,
    marginTop: 20, marginBottom: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  earningsHeroLabel: { fontSize: 14, color: 'rgba(0,0,0,0.5)', marginBottom: 8 },
  earningsHeroRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20 },
  earningsHeroValue: { fontSize: 48, fontWeight: 'bold', color: '#000' },
  earningsHeroCurrency: { fontSize: 18, fontWeight: '600', color: '#000', marginLeft: 8, marginBottom: 8 },
  progressBarOuter: {
    width: '100%', height: 8, backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 4, overflow: 'hidden', marginBottom: 8,
  },
  progressBarInner: { height: '100%', backgroundColor: YELLOW, borderRadius: 4 },
  progressLabel: { fontSize: 12, color: 'rgba(0,0,0,0.4)' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statBox: {
    flex: 1, backgroundColor: MINT_LIGHT, borderRadius: 16, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: MINT_BORDER,
  },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statNum: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
  statLbl: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' },
  weeklyCard: {
    backgroundColor: MINT_LIGHT, borderRadius: 20, padding: 20, marginBottom: 40,
    borderWidth: 1, borderColor: MINT_BORDER,
  },
  weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  weeklyTotal: { fontSize: 16, fontWeight: '700', color: YELLOW },
  weeklySubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20, marginTop: 4 },
  weeklyBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 20, backgroundColor: 'rgba(179, 229, 206, 0.3)', borderRadius: 6, marginBottom: 8 },
  barActive: { backgroundColor: YELLOW },
  barDay: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  barDayActive: { color: YELLOW, fontWeight: '600' },
  barAmount: { fontSize: 9, color: YELLOW, fontWeight: '600', marginBottom: 4 },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: YELLOW, marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 8 },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  historyCard: {
    backgroundColor: MINT_LIGHT, borderRadius: 16, padding: 18, marginTop: 12,
    borderWidth: 1, borderColor: MINT_BORDER,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  historyDate: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  historyFare: { fontSize: 16, fontWeight: 'bold', color: YELLOW },
  historyRoute: { flexDirection: 'row', marginBottom: 14 },
  dotLine: { alignItems: 'center', marginRight: 12, paddingTop: 4 },
  gDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CD964' },
  dLine: { width: 2, height: 24, backgroundColor: 'rgba(179, 229, 206, 0.3)', marginVertical: 4 },
  rSquare: { width: 10, height: 10, backgroundColor: '#FF3B30' },
  addresses: { flex: 1, justifyContent: 'space-between' },
  addr: { fontSize: 14, color: 'rgba(255,255,255,0.7)', paddingVertical: 2 },
  historyFooter: { flexDirection: 'row', alignItems: 'center' },
  historyMeta: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginRight: 12 },
  typeBadge: { backgroundColor: 'rgba(252, 209, 22, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 11, color: YELLOW, fontWeight: '600', textTransform: 'capitalize' },
  supportHero: { alignItems: 'center', marginTop: 20, marginBottom: 28 },
  supportIcon: { fontSize: 50, marginBottom: 12 },
  supportTitle: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center' },
  supportItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: MINT_LIGHT, borderRadius: 16, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: MINT_BORDER,
  },
  sIconBox: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  sIcon: { fontSize: 24 },
  sText: { flex: 1 },
  sTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  sDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  sChevron: { fontSize: 22, color: '#4CD964', fontWeight: '600' },
  faqBox: { marginTop: 28, marginBottom: 40 },
  faqHeader: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 16 },
  faqItem: {
    backgroundColor: MINT_LIGHT, borderRadius: 14, padding: 18, marginBottom: 10,
    borderWidth: 1, borderColor: MINT_BORDER,
  },
  faqQ: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 8 },
  faqA: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },
  vehicleHero: {
    backgroundColor: MINT, borderRadius: 24, padding: 28,
    marginTop: 20, marginBottom: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  vehicleName: { fontSize: 22, fontWeight: 'bold', color: '#000', marginBottom: 4 },
  vehiclePlate: { fontSize: 16, color: 'rgba(0,0,0,0.5)', fontWeight: '600' },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  vehicleItem: {
    width: '47%', backgroundColor: MINT_LIGHT, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: MINT_BORDER,
  },
  vLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase' },
  vValue: { fontSize: 16, fontWeight: '600', color: '#fff' },
  vehicleNote: {
    flexDirection: 'row', backgroundColor: 'rgba(252, 209, 22, 0.1)',
    borderRadius: 14, padding: 16, marginBottom: 40,
    borderWidth: 1, borderColor: 'rgba(252, 209, 22, 0.2)',
  },
  vehicleNoteIcon: { fontSize: 16, marginRight: 10, marginTop: 2 },
  vehicleNoteText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 20 },
  settingsSection: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase', marginTop: 24, marginBottom: 10, marginLeft: 4,
  },
  settingsGroup: {
    backgroundColor: MINT_LIGHT, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: MINT_BORDER, marginBottom: 8,
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(179, 229, 206, 0.1)',
  },
  settingsEmoji: { fontSize: 20, marginRight: 14 },
  settingsLabel: { flex: 1, fontSize: 15, color: '#fff' },
  settingsValue: { fontSize: 14, color: 'rgba(255,255,255,0.4)', marginRight: 8 },
  toggle: {
    width: 48, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 3,
  },
  toggleOn: { backgroundColor: '#4CD964' },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleDotOn: { alignSelf: 'flex-end' },
});

export default MenuScreen;