import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Animated, Linking, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import COLORS from '../constants/colors';
import * as ImagePicker from 'expo-image-picker';
import { driverService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';

var MenuScreen = function(props) {
  var navigation = props.navigation;
  var auth = useAuth(); var user = auth.user; var driver = auth.driver; var logout = auth.logout; var updateUser = auth.updateUser;
  var earningsState = useState({ today: 0, todayRides: 0, total: 0, totalRides: 0, weekTotal: 0, weekRides: 0, weeklyBreakdown: [0,0,0,0,0,0,0], weeklyRides: [0,0,0,0,0,0,0] });
  var earnings = earningsState[0]; var setEarnings = earningsState[1];
  var historyState = useState([]); var rideHistory = historyState[0]; var setRideHistory = historyState[1];
  var tabState = useState('menu'); var activeTab = tabState[0]; var setActiveTab = tabState[1];
  var animState = useState(new Animated.Value(1)); var fadeAnim = animState[0];
  var notifState = useState(true); var notificationsEnabled = notifState[0]; var setNotificationsEnabled = notifState[1];
  var soundState = useState(true); var soundEnabled = soundState[0]; var setSoundEnabled = soundState[1];
  var pinState = useState(user?.securityPinEnabled || false); var securityPinEnabled = pinState[0]; var setSecurityPinEnabled = pinState[1];
  var langState = useState('Fran\u00e7ais'); var language = langState[0]; var setLanguage = langState[1];

  useEffect(function() { fetchEarnings(); fetchHistory(); }, []);
  function fetchEarnings() { driverService.getEarnings().then(function(r) { var e = r.earnings || {}; setEarnings({ today: e.today||0, todayRides: e.todayRides||0, total: e.total||0, totalRides: e.totalRides||0, weekTotal: e.weekTotal||0, weekRides: e.weekRides||0, weeklyBreakdown: e.weeklyBreakdown||[0,0,0,0,0,0,0], weeklyRides: e.weeklyRides||[0,0,0,0,0,0,0] }); }).catch(function(){}); }
  function fetchHistory() { driverService.getRideHistory().then(function(r) { setRideHistory(r.rides||[]); }).catch(function(){}); }

  function takeLivePhoto() { Alert.alert("Photo d'identité", "Prenez une photo en direct pour vérification.\n\n\u26A0\uFE0F Les photos de galerie ne sont pas acceptées.", [{ text: 'Prendre la photo', onPress: function() { ImagePicker.requestCameraPermissionsAsync().then(function(perm) { if (perm.status !== 'granted') { Alert.alert('Permission requise', "Autorisez l'acc\u00e8s à la caméra."); return; } ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1,1], quality: 0.8, cameraType: ImagePicker.CameraType.front }).then(function(result) { if (!result.canceled) { uploadPhoto(result.assets[0].uri); } }); }); } }, { text: 'Annuler', style: 'cancel' }]); }
  function uploadPhoto(uri) { var formData = new FormData(); formData.append('photo', { uri: uri, type: 'image/jpeg', name: 'profile.jpg' }); driverService.uploadProfilePhoto(formData).then(function(r) { if (r.success) { updateUser({ profilePhoto: r.profilePhoto, photoStatus: 'pending', photoVerified: false, photoUpdatedAt: new Date().toISOString() }); Alert.alert('Photo envoyée', "Votre photo est en cours de vérification."); } else { Alert.alert('Erreur', r.message || '\u00c9chec'); } }).catch(function() { Alert.alert('Erreur', 'Impossible de télécharger'); }); }
  function pickPhoto() { if (user && user.profilePhoto) { var status = user.photoStatus || 'pending'; if (status === 'expired') { takeLivePhoto(); return; } if (status === 'approved' || user.photoVerified) { Alert.alert('Photo vérifiée \u2714', "Votre photo est active.", [{ text: 'OK' }]); return; } Alert.alert('Photo en attente', "En cours de vérification.", [{ text: 'OK' }]); return; } takeLivePhoto(); }
    function toggleSecurityPin() {
    var newVal = !securityPinEnabled;
    setSecurityPinEnabled(newVal);
    driverService.updateSecurityPin(newVal).catch(function() { setSecurityPinEnabled(!newVal); });
  }
  function switchTab(tab) { Animated.sequence([Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }), Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true })]).start(); setTimeout(function() { setActiveTab(tab); }, 120); }
  function handleLogout() { Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter?', [{ text: 'Annuler', style: 'cancel' }, { text: 'Déconnexion', style: 'destructive', onPress: function() { logout(); } }]); }
  function formatDate(d) { if (!d) return ''; var date = new Date(d); var now = new Date(); var diff = Math.floor((now-date)/(1000*60*60*24)); if (diff===0) return "Aujourd'hui"; if (diff===1) return 'Hier'; if (diff<7) return 'Il y a '+diff+' jours'; return date.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }
  function formatTime(d) { if (!d) return ''; return new Date(d).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }

  function renderAvatar() { if (user && user.profilePhoto) { return React.createElement(Image, { source: { uri: user.profilePhoto }, style: styles.avatarImg }); } var letter = (user && user.name) ? user.name.charAt(0).toUpperCase() : 'D'; return (<View style={styles.avatar}><Text style={styles.avatarLetter}>{letter}</Text></View>); }
  function getPhotoBadge() { if (user && user.photoVerified) return { style: [styles.editBadge, styles.editBadgeVerified], text: '\u2714' }; if (user && user.profilePhoto) return { style: [styles.editBadge, styles.editBadgePending], text: '\u23F3' }; return { style: styles.editBadge, text: '\uD83D\uDCF7' }; }

  function renderEarningsTab() {
    var days = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']; var todayIndex = (new Date().getDay()+6)%7; var progress = Math.min((earnings.today/25000)*100,100);
    return (<ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.earningsHero}><Text style={styles.earningsHeroLabel}>{"Gains Aujourd'hui"}</Text><View style={styles.earningsHeroRow}><Text style={styles.earningsHeroValue}>{earnings.today.toLocaleString()}</Text><Text style={styles.earningsHeroCurrency}>FCFA</Text></View><View style={styles.progressBarOuter}><View style={[styles.progressBarInner,{width:progress+'%'}]} /></View><Text style={styles.progressLabel}>{'Objectif: 25,000 FCFA \u2022 '+earnings.todayRides+" course"+(earnings.todayRides!==1?'s':'')+" aujourd'hui"}</Text></View>
      <View style={styles.statsRow}><View style={styles.statBox}><Text style={styles.statIcon}>{'\uD83D\uDE97'}</Text><Text style={styles.statNum}>{earnings.totalRides}</Text><Text style={styles.statLbl}>Courses</Text></View><View style={styles.statBox}><Text style={styles.statIcon}>{'\uD83D\uDCB0'}</Text><Text style={styles.statNum}>{earnings.total.toLocaleString()}</Text><Text style={styles.statLbl}>Total FCFA</Text></View><View style={styles.statBox}><Text style={styles.statIcon}>{'\u2B50'}</Text><Text style={styles.statNum}>{user&&user.rating?user.rating.toFixed(1):'5.0'}</Text><Text style={styles.statLbl}>Note</Text></View></View>
      <View style={styles.weeklyCard}><View style={styles.weeklyHeader}><Text style={styles.weeklyTitle}>Cette semaine</Text><Text style={styles.weeklyTotal}>{earnings.weekTotal.toLocaleString()+' FCFA'}</Text></View><Text style={styles.weeklySubtitle}>{earnings.weekRides+' course'+(earnings.weekRides!==1?'s':'')}</Text><View style={styles.weeklyBars}>{days.map(function(day,i){var isToday=i===todayIndex;var de=earnings.weeklyBreakdown[i]||0;var maxE=Math.max.apply(null,earnings.weeklyBreakdown)||1;var dh=Math.max(de>0?(de/maxE)*60+10:8,8);return(<View key={day} style={styles.barCol}>{de>0&&<Text style={styles.barAmount}>{(de/1000).toFixed(0)+'k'}</Text>}<View style={[styles.bar,{height:dh},(isToday||de>0)&&styles.barActive]} /><Text style={[styles.barDay,(isToday||de>0)&&styles.barDayActive]}>{day}</Text>{isToday&&<View style={styles.todayDot}/>}</View>);})}</View></View>
    </ScrollView>);
  }

  function renderHistoryTab() {
    if (rideHistory.length===0) return (<ScrollView style={styles.tabContent}><View style={styles.emptyState}><Text style={styles.emptyIcon}>{'\uD83D\uDE97'}</Text><Text style={styles.emptyTitle}>Aucune course</Text><Text style={styles.emptySub}>{"Vos courses appara\u00eetront ici"}</Text></View></ScrollView>);
    return (<ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>{rideHistory.map(function(ride,index){return(<View key={ride._id||index} style={styles.historyCard}><View style={styles.historyHeader}><Text style={styles.historyDate}>{formatDate(ride.completedAt||ride.updatedAt)}</Text><Text style={styles.historyFare}>{(ride.driverEarnings||ride.fare||0).toLocaleString()+' FCFA'}</Text></View><View style={styles.historyRoute}><View style={styles.dotLine}><View style={styles.gDot}/><View style={styles.dLine}/><View style={styles.rSquare}/></View><View style={styles.addresses}><Text style={styles.addr} numberOfLines={1}>{ride.pickup?ride.pickup.address||'Départ':'Départ'}</Text><Text style={styles.addr} numberOfLines={1}>{ride.dropoff?ride.dropoff.address||'Arrivée':'Arrivée'}</Text></View></View><View style={styles.historyFooter}><Text style={styles.historyMeta}>{formatTime(ride.completedAt||ride.updatedAt)}</Text><Text style={styles.historyMeta}>{(ride.distance?ride.distance.toFixed(1):'0')+' km'}</Text><View style={styles.typeBadge}><Text style={styles.typeText}>{ride.rideType||'standard'}</Text></View></View></View>);})}
    <View style={{height:40}}/></ScrollView>);
  }

  function renderSupportTab() {
    var faqs = [{q:'Comment sont calculés mes gains?',a:'Vous recevez 88-90% du tarif. Commission TeranGO: 10-12%.'},{q:'Quand suis-je payé?',a:'Paiements chaque semaine via Wave ou Orange Money.'},{q:'Comment améliorer ma note?',a:'Ponctualité, conduite prudente, véhicule propre.'},{q:"Que faire en cas d'accident?",a:"Contactez le support et les urgences."}];
    return (<ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.supportHero}><Text style={styles.supportIcon}>{'\uD83C\uDFA7'}</Text><Text style={styles.supportTitle}>Comment pouvons-nous vous aider?</Text></View>
      <TouchableOpacity style={styles.supportItem} onPress={function(){Linking.openURL('tel:+221338234567');}}><View style={[styles.sIconBox,{backgroundColor:'rgba(76,217,100,0.15)'}]}><Text style={styles.sIcon}>{'\uD83D\uDCDE'}</Text></View><View style={styles.sText}><Text style={styles.sTitle}>Appeler le support</Text><Text style={styles.sDesc}>{"Disponible 7j/7 de 6h à 22h"}</Text></View><Text style={styles.sChevron}>{'\u203A'}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.supportItem} onPress={function(){Linking.openURL('https://wa.me/221778234567');}}><View style={[styles.sIconBox,{backgroundColor:'rgba(37,211,102,0.15)'}]}><Text style={styles.sIcon}>{'\uD83D\uDCAC'}</Text></View><View style={styles.sText}><Text style={styles.sTitle}>WhatsApp</Text><Text style={styles.sDesc}>{"Réponse rapide"}</Text></View><Text style={styles.sChevron}>{'\u203A'}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.supportItem} onPress={function(){Linking.openURL('mailto:support@terango.sn');}}><View style={[styles.sIconBox,{backgroundColor:'rgba(66,133,244,0.15)'}]}><Text style={styles.sIcon}>{'\uD83D\uDCE7'}</Text></View><View style={styles.sText}><Text style={styles.sTitle}>Email</Text><Text style={styles.sDesc}>support@terango.sn</Text></View><Text style={styles.sChevron}>{'\u203A'}</Text></TouchableOpacity>
      <View style={styles.faqBox}><Text style={styles.faqHeader}>{"Questions fréquentes"}</Text>{faqs.map(function(faq,i){return(<View key={i} style={styles.faqItem}><Text style={styles.faqQ}>{faq.q}</Text><Text style={styles.faqA}>{faq.a}</Text></View>);})}</View>
    </ScrollView>);
  }

  function renderVehicleTab() {
    var v = (driver&&driver.vehicle)?driver.vehicle:{};
    return (<ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.vehicleHero}><Text style={{fontSize:60,marginBottom:12}}>{'\uD83D\uDE97'}</Text><Text style={styles.vehicleName}>{(v.make||'Non renseigné')+' '+(v.model||'')}</Text><Text style={styles.vehiclePlate}>{v.licensePlate||'Aucune plaque'}</Text></View>
      <View style={styles.vehicleGrid}><View style={styles.vehicleItem}><Text style={styles.vLabel}>Marque</Text><Text style={styles.vValue}>{v.make||'-'}</Text></View><View style={styles.vehicleItem}><Text style={styles.vLabel}>{"Mod\u00e8le"}</Text><Text style={styles.vValue}>{v.model||'-'}</Text></View><View style={styles.vehicleItem}><Text style={styles.vLabel}>{"Année"}</Text><Text style={styles.vValue}>{v.year||'-'}</Text></View><View style={styles.vehicleItem}><Text style={styles.vLabel}>Couleur</Text><Text style={styles.vValue}>{v.color||'-'}</Text></View><View style={styles.vehicleItem}><Text style={styles.vLabel}>Plaque</Text><Text style={styles.vValue}>{v.licensePlate||'-'}</Text></View><View style={styles.vehicleItem}><Text style={styles.vLabel}>Type</Text><Text style={styles.vValue}>{v.type||'Berline'}</Text></View></View>
      <View style={styles.vehicleNote}><Text style={styles.vehicleNoteIcon}>{"\u2139\uFE0F"}</Text><Text style={styles.vehicleNoteText}>{"Pour modifier, contactez le support TeranGO."}</Text></View>
    </ScrollView>);
  }

  function renderSettingsTab() {
    return (<ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.settingsSection}>Notifications</Text>
      <View style={styles.settingsGroup}><TouchableOpacity style={styles.settingsRow} onPress={function(){setNotificationsEnabled(!notificationsEnabled);}}><Text style={styles.settingsEmoji}>{'\uD83D\uDD14'}</Text><Text style={styles.settingsLabel}>Notifications push</Text><View style={[styles.toggle,notificationsEnabled&&styles.toggleOn]}><View style={[styles.toggleDot,notificationsEnabled&&styles.toggleDotOn]}/></View></TouchableOpacity><TouchableOpacity style={[styles.settingsRow,{borderBottomWidth:0}]} onPress={function(){setSoundEnabled(!soundEnabled);}}><Text style={styles.settingsEmoji}>{'\uD83D\uDCCA'}</Text><Text style={styles.settingsLabel}>Sons</Text><View style={[styles.toggle,soundEnabled&&styles.toggleOn]}><View style={[styles.toggleDot,soundEnabled&&styles.toggleDotOn]}/></View></TouchableOpacity></View>
      <Text style={styles.settingsSection}>{"Général"}</Text>
      <View style={styles.settingsGroup}><TouchableOpacity style={styles.settingsRow} onPress={function(){Alert.alert('Langue','Choisissez',[{text:'Fran\u00e7ais',onPress:function(){setLanguage('Fran\u00e7ais');}},{text:'Wolof',onPress:function(){setLanguage('Wolof');}},{text:'English',onPress:function(){setLanguage('English');}}]);}}><Text style={styles.settingsEmoji}>{'\uD83C\uDF10'}</Text><Text style={styles.settingsLabel}>Langue</Text><Text style={styles.settingsValue}>{language}</Text><Text style={styles.mChevron}>{'\u203A'}</Text></TouchableOpacity><View style={[styles.settingsRow,{borderBottomWidth:0}]}><Text style={styles.settingsEmoji}>{'\uD83D\uDCF1'}</Text><Text style={styles.settingsLabel}>Version</Text><Text style={styles.settingsValue}>1.0.0</Text></View></View>
      <Text style={styles.settingsSection}>{'Sécurité'}</Text>
      <View style={styles.settingsGroup}><TouchableOpacity style={[styles.settingsRow,{borderBottomWidth:0}]} onPress={toggleSecurityPin}><Text style={styles.settingsEmoji}>{'\uD83D\uDD12'}</Text><Text style={styles.settingsLabel}>Code de sécurité</Text><View style={[styles.toggle,securityPinEnabled&&styles.toggleOn]}><View style={[styles.toggleDot,securityPinEnabled&&styles.toggleDotOn]}/></View></TouchableOpacity></View>
      <Text style={styles.settingsSection}>Compte</Text>
      <View style={styles.settingsGroup}><View style={styles.settingsRow}><Text style={styles.settingsEmoji}>{'\uD83D\uDCDE'}</Text><Text style={styles.settingsLabel}>{"Téléphone"}</Text><Text style={styles.settingsValue}>{(user&&user.phone)?user.phone:'-'}</Text></View><View style={[styles.settingsRow,{borderBottomWidth:0}]}><Text style={styles.settingsEmoji}>{'\uD83D\uDCE7'}</Text><Text style={styles.settingsLabel}>Email</Text><Text style={styles.settingsValue}>{(user&&user.email)?user.email:'-'}</Text></View></View>
    </ScrollView>);
  }

  function renderMainMenu() {
    var badge = getPhotoBadge(); var userName=(user&&user.name)?user.name:'Chauffeur'; var userRating=(user&&user.rating)?user.rating.toFixed(1):'5.0'; var vehicleMake=(driver&&driver.vehicle&&driver.vehicle.make)?driver.vehicle.make:'Non renseigné'; var vehicleModel=(driver&&driver.vehicle&&driver.vehicle.model)?driver.vehicle.model:'';
    return (<ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}><TouchableOpacity style={styles.avatarWrap} onPress={pickPhoto}>{renderAvatar()}<View style={styles.onlineDot}/><View style={badge.style}><Text style={styles.editBadgeText}>{badge.text}</Text></View></TouchableOpacity><View style={styles.profileInfo}><Text style={styles.profileName}>{userName}</Text><View style={styles.ratingRow}><Text style={styles.starIcon}>{'\u2B50'}</Text><Text style={styles.ratingVal}>{userRating}</Text><Text style={styles.ratingMeta}>{'\u2022 '+earnings.totalRides+' courses'}</Text></View></View></View>
      <View style={styles.earningsSummary}><TouchableOpacity style={styles.earnBox} onPress={function(){switchTab('earnings');}}><Text style={styles.earnVal}>{earnings.today.toLocaleString()}</Text><Text style={styles.earnLbl}>{"FCFA Aujourd'hui"}</Text></TouchableOpacity><View style={styles.earnDivider}/><TouchableOpacity style={styles.earnBox} onPress={function(){switchTab('earnings');}}><Text style={styles.earnVal}>{earnings.total.toLocaleString()}</Text><Text style={styles.earnLbl}>FCFA Total</Text></TouchableOpacity></View>
      <View style={styles.menuGroup}>
        <TouchableOpacity style={styles.menuRow} onPress={function(){switchTab('earnings');}}><View style={[styles.mIcon,{backgroundColor:'rgba(0,133,63,0.12)'}]}><Text style={styles.mEmoji}>{'\uD83D\uDCB0'}</Text></View><View style={styles.mInfo}><Text style={styles.mTitle}>Mes Gains</Text><Text style={styles.mSub}>Suivez vos revenus</Text></View><Text style={styles.mChevron}>{'\u203A'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.menuRow} onPress={function(){switchTab('history');}}><View style={[styles.mIcon,{backgroundColor:'rgba(66,133,244,0.12)'}]}><Text style={styles.mEmoji}>{'\uD83D\uDCCB'}</Text></View><View style={styles.mInfo}><Text style={styles.mTitle}>Historique</Text><Text style={styles.mSub}>{earnings.totalRides+' courses'}</Text></View><Text style={styles.mChevron}>{'\u203A'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.menuRow} onPress={function(){switchTab('vehicle');}}><View style={[styles.mIcon,{backgroundColor:'rgba(252,209,22,0.12)'}]}><Text style={styles.mEmoji}>{'\uD83D\uDE97'}</Text></View><View style={styles.mInfo}><Text style={styles.mTitle}>{"Mon Véhicule"}</Text><Text style={styles.mSub}>{vehicleMake+' '+vehicleModel}</Text></View><Text style={styles.mChevron}>{'\u203A'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.menuRow} onPress={function(){switchTab('settings');}}><View style={[styles.mIcon,{backgroundColor:'rgba(175,82,222,0.12)'}]}><Text style={styles.mEmoji}>{'\u2699\uFE0F'}</Text></View><View style={styles.mInfo}><Text style={styles.mTitle}>{"Param\u00e8tres"}</Text><Text style={styles.mSub}>Notifications, langue</Text></View><Text style={styles.mChevron}>{'\u203A'}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.menuRow,{borderBottomWidth:0}]} onPress={function(){switchTab('support');}}><View style={[styles.mIcon,{backgroundColor:'rgba(0,199,190,0.12)'}]}><Text style={styles.mEmoji}>{'\uD83C\uDFA7'}</Text></View><View style={styles.mInfo}><Text style={styles.mTitle}>Aide & Support</Text><Text style={styles.mSub}>FAQ, contact</Text></View><Text style={styles.mChevron}>{'\u203A'}</Text></TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}><Text style={styles.logoutIcon}>{'\uD83D\uDC4B'}</Text><Text style={styles.logoutTxt}>{"Se déconnecter"}</Text></TouchableOpacity>
      <Text style={styles.versionTxt}>TeranGO Driver v1.0.0</Text>
    </ScrollView>);
  }

  function getTitle() { switch(activeTab){case 'earnings':return 'Mes Gains';case 'history':return 'Historique';case 'support':return 'Aide & Support';case 'vehicle':return 'Mon Véhicule';case 'settings':return 'Param\u00e8tres';default:return 'Menu';} }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}><TouchableOpacity style={styles.backBtn} onPress={function(){if(activeTab!=='menu'){switchTab('menu');}else{navigation.goBack();}}}><Text style={styles.backArrow}>{'\u2190'}</Text></TouchableOpacity><Text style={styles.headerTxt}>{getTitle()}</Text><View style={{width:44}}/></View>
      <Animated.View style={{flex:1,opacity:fadeAnim}}>
        {activeTab==='menu'&&renderMainMenu()}{activeTab==='earnings'&&renderEarningsTab()}{activeTab==='history'&&renderHistoryTab()}{activeTab==='support'&&renderSupportTab()}{activeTab==='vehicle'&&renderVehicleTab()}{activeTab==='settings'&&renderSettingsTab()}
      </Animated.View>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabContent: { flex: 1, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: COLORS.darkCard, borderBottomWidth: 1, borderBottomColor: COLORS.darkCardBorder },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backArrow: { fontSize: 24, color: COLORS.green },
  headerTxt: { fontSize: 20, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.3 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 20, marginTop: 20, marginBottom: 16, elevation: 8, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  avatarWrap: { position: 'relative', marginRight: 16 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  avatarImg: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ccc' },
  editBadge: { position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.darkCard },
  editBadgeVerified: { backgroundColor: COLORS.green },
  editBadgePending: { backgroundColor: '#FF9500' },
  editBadgeText: { fontSize: 12 },
  onlineDot: { position: 'absolute', bottom: 2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.green, borderWidth: 3, borderColor: COLORS.darkCard },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700', color: COLORS.textLight, marginBottom: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center' },
  starIcon: { fontSize: 14, marginRight: 4 },
  ratingVal: { fontSize: 15, fontWeight: '700', color: COLORS.textLight, marginRight: 6 },
  ratingMeta: { fontSize: 13, color: COLORS.textLightMuted },
  earningsSummary: { flexDirection: 'row', backgroundColor: 'rgba(252,209,22,0.08)', borderRadius: 16, marginBottom: 24, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(252,209,22,0.2)' },
  earnBox: { flex: 1, padding: 20, alignItems: 'center' },
  earnDivider: { width: 1, backgroundColor: 'rgba(252,209,22,0.15)' },
  earnVal: { fontSize: 22, fontWeight: 'bold', color: COLORS.yellow, marginBottom: 4 },
  earnLbl: { fontSize: 12, color: COLORS.textDarkSub },
  menuGroup: { backgroundColor: COLORS.backgroundWhite, borderRadius: 20, overflow: 'hidden', marginBottom: 24, borderWidth: 1, borderColor: COLORS.grayLight },
  menuRow: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  mIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  mEmoji: { fontSize: 22 },
  mInfo: { flex: 1 },
  mTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textDark, marginBottom: 2 },
  mSub: { fontSize: 12, color: COLORS.textDarkMuted },
  mChevron: { fontSize: 22, color: COLORS.green, fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, backgroundColor: 'rgba(255,59,48,0.08)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.2)', marginBottom: 16 },
  logoutIcon: { fontSize: 20, marginRight: 10 },
  logoutTxt: { fontSize: 16, fontWeight: '600', color: '#FF3B30' },
  versionTxt: { textAlign: 'center', fontSize: 12, color: COLORS.textDarkMuted, marginBottom: 40 },
  earningsHero: { backgroundColor: COLORS.darkCard, borderRadius: 24, padding: 28, marginTop: 20, marginBottom: 24, alignItems: 'center', elevation: 8, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  earningsHeroLabel: { fontSize: 14, color: COLORS.textLightMuted, marginBottom: 8 },
  earningsHeroRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20 },
  earningsHeroValue: { fontSize: 48, fontWeight: 'bold', color: COLORS.textLight },
  earningsHeroCurrency: { fontSize: 18, fontWeight: '600', color: COLORS.textLightSub, marginLeft: 8, marginBottom: 8 },
  progressBarOuter: { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressBarInner: { height: '100%', backgroundColor: COLORS.yellow, borderRadius: 4 },
  progressLabel: { fontSize: 12, color: COLORS.textLightMuted },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: COLORS.backgroundWhite, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.grayLight },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statNum: { fontSize: 20, fontWeight: 'bold', color: COLORS.textDark, marginBottom: 4 },
  statLbl: { fontSize: 11, color: COLORS.textDarkMuted, textTransform: 'uppercase' },
  weeklyCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 20, marginBottom: 40, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weeklyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textLight },
  weeklyTotal: { fontSize: 16, fontWeight: '700', color: COLORS.yellow },
  weeklySubtitle: { fontSize: 12, color: COLORS.textLightMuted, marginBottom: 20, marginTop: 4 },
  weeklyBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
  barCol: { alignItems: 'center', flex: 1 },
  bar: { width: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, marginBottom: 8 },
  barActive: { backgroundColor: COLORS.yellow },
  barDay: { fontSize: 11, color: COLORS.textLightMuted },
  barDayActive: { color: COLORS.yellow, fontWeight: '600' },
  barAmount: { fontSize: 9, color: COLORS.yellow, fontWeight: '600', marginBottom: 4 },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.yellow, marginTop: 4 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textDark, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.textDarkMuted },
  historyCard: { backgroundColor: COLORS.darkCard, borderRadius: 16, padding: 18, marginTop: 12, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  historyDate: { fontSize: 13, color: COLORS.textLightMuted },
  historyFare: { fontSize: 16, fontWeight: 'bold', color: COLORS.yellow },
  historyRoute: { flexDirection: 'row', marginBottom: 14 },
  dotLine: { alignItems: 'center', marginRight: 12, paddingTop: 4 },
  gDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.green },
  dLine: { width: 2, height: 24, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },
  rSquare: { width: 10, height: 10, backgroundColor: COLORS.red },
  addresses: { flex: 1, justifyContent: 'space-between' },
  addr: { fontSize: 14, color: COLORS.textLightSub, paddingVertical: 2 },
  historyFooter: { flexDirection: 'row', alignItems: 'center' },
  historyMeta: { fontSize: 12, color: COLORS.textLightMuted, marginRight: 12 },
  typeBadge: { backgroundColor: 'rgba(252,209,22,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText: { fontSize: 11, color: COLORS.yellow, fontWeight: '600', textTransform: 'capitalize' },
  supportHero: { alignItems: 'center', marginTop: 20, marginBottom: 28 },
  supportIcon: { fontSize: 50, marginBottom: 12 },
  supportTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textDark, textAlign: 'center' },
  supportItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundWhite, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: COLORS.grayLight },
  sIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  sIcon: { fontSize: 24 },
  sText: { flex: 1 },
  sTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textDark, marginBottom: 2 },
  sDesc: { fontSize: 12, color: COLORS.textDarkMuted },
  sChevron: { fontSize: 22, color: COLORS.green, fontWeight: '600' },
  faqBox: { marginTop: 28, marginBottom: 40 },
  faqHeader: { fontSize: 18, fontWeight: '700', color: COLORS.textDark, marginBottom: 16 },
  faqItem: { backgroundColor: COLORS.backgroundWhite, borderRadius: 14, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: COLORS.grayLight },
  faqQ: { fontSize: 15, fontWeight: '600', color: COLORS.textDark, marginBottom: 8 },
  faqA: { fontSize: 13, color: COLORS.textDarkSub, lineHeight: 20 },
  vehicleHero: { backgroundColor: COLORS.darkCard, borderRadius: 24, padding: 28, marginTop: 20, marginBottom: 24, alignItems: 'center', elevation: 8, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  vehicleName: { fontSize: 22, fontWeight: 'bold', color: COLORS.textLight, marginBottom: 4 },
  vehiclePlate: { fontSize: 16, color: COLORS.textLightMuted, fontWeight: '600' },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  vehicleItem: { width: '47%', backgroundColor: COLORS.backgroundWhite, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.grayLight },
  vLabel: { fontSize: 12, color: COLORS.textDarkMuted, marginBottom: 6, textTransform: 'uppercase' },
  vValue: { fontSize: 16, fontWeight: '600', color: COLORS.textDark },
  vehicleNote: { flexDirection: 'row', backgroundColor: 'rgba(252,209,22,0.08)', borderRadius: 14, padding: 16, marginBottom: 40, borderWidth: 1, borderColor: 'rgba(252,209,22,0.2)' },
  vehicleNoteIcon: { fontSize: 16, marginRight: 10, marginTop: 2 },
  vehicleNoteText: { flex: 1, fontSize: 13, color: COLORS.textDarkSub, lineHeight: 20 },
  settingsSection: { fontSize: 13, fontWeight: '600', color: COLORS.textDarkMuted, textTransform: 'uppercase', marginTop: 24, marginBottom: 10, marginLeft: 4 },
  settingsGroup: { backgroundColor: COLORS.backgroundWhite, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.grayLight, marginBottom: 8 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  settingsEmoji: { fontSize: 20, marginRight: 14 },
  settingsLabel: { flex: 1, fontSize: 15, color: COLORS.textDark },
  settingsValue: { fontSize: 14, color: COLORS.textDarkMuted, marginRight: 8 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: COLORS.grayLight, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: COLORS.green },
  toggleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  toggleDotOn: { alignSelf: 'flex-end' },
});

export default MenuScreen;
