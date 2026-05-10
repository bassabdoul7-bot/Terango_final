import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, StatusBar } from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from "@react-navigation/native";
import COLORS from "../constants/colors";
import { COMMISSION_WAVE_NUMBER, COMMISSION_CAP } from "../constants/commission";
import { driverService } from "../services/api.service";
import { useAuth } from "../context/AuthContext";

// Renders a Yango-style bold italic outlined display amount. RN's Text has
// no real stroke, so we stack 4 offset copies in the stroke colour and a
// fill copy on top — gives a 1px outline regardless of font.
function StrokedAmount(props) {
  var fontSize = props.fontSize || 52;
  var color = props.color || '#FFFFFF';
  var strokeColor = props.strokeColor || '#000000';
  var amount = props.amount || 0;
  var text = amount.toLocaleString() + ' FCFA';
  var base = {
    fontFamily: 'Anton_400Regular',
    fontSize: fontSize,
    color: color,
    fontStyle: 'italic',
    letterSpacing: 1,
  };
  var stroke = Object.assign({}, base, { color: strokeColor, position: 'absolute' });
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

var GainsScreen = function() {
  var auth = useAuth(); var user = auth.user;
  var es = useState({ today: 0, todayRides: 0, total: 0, totalRides: 0, weekTotal: 0, weekRides: 0, weeklyBreakdown: [0,0,0,0,0,0,0] });
  var earnings = es[0]; var setEarnings = es[1];
  var cs = useState(0);
  var commissionBalance = cs[0]; var setCommissionBalance = cs[1];
  var hs = useState([]);
  var history = hs[0]; var setHistory = hs[1];
  useEffect(function() { fetchEarnings(); fetchCommission(); fetchHistory(); }, []);
  // Empty dep: fetchDriverProfile is recreated on every AuthProvider render.
  // Including it caused an infinite focus-loop that hammered /drivers/profile
  // and tripped the rate limiter (HTTP 429 on the dashboard).
  useFocusEffect(useCallback(function() { fetchEarnings(); fetchHistory(); if (auth.fetchDriverProfile) auth.fetchDriverProfile(); }, []));
  function fetchCommission() { driverService.getProfile().then(function(r) { if (r && r.driver) { setCommissionBalance(r.driver.commissionBalance || 0); } }).catch(function(){}); }
  function fetchEarnings() { driverService.getEarnings().then(function(r) { var e = r.earnings || {}; setEarnings({ today: e.today||0, todayRides: e.todayRides||0, total: e.total||0, totalRides: e.totalRides||0, weekTotal: e.weekTotal||0, weekRides: e.weekRides||0, weeklyBreakdown: e.weeklyBreakdown||[0,0,0,0,0,0,0] }); }).catch(function(){}); }
  function fetchHistory() { driverService.getRideHistory().then(function(r) { var list = (r && (r.history || r.rides)) || []; setHistory(list); }).catch(function(){}); }
  function typeLabel(t) { if (t === 'ride') return 'Course'; if (t === 'colis') return 'Colis'; if (t === 'commande') return 'Commande'; if (t === 'resto' || t === 'restaurant') return 'Resto'; return 'Trajet'; }
  function typeIcon(t) { if (t === 'ride') return '🚗'; if (t === 'colis') return '📦'; if (t === 'commande') return '🛒'; if (t === 'resto' || t === 'restaurant') return '🍴'; return '📍'; }
  function formatDate(iso) { if (!iso) return ''; var d = new Date(iso); var today = new Date(); var sameDay = d.toDateString() === today.toDateString(); var yest = new Date(today); yest.setDate(today.getDate() - 1); if (sameDay) return "Aujourd'hui " + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0'); if (d.toDateString() === yest.toDateString()) return 'Hier ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0'); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' ' + d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0'); }
  var days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  var todayIndex = (new Date().getDay()+6)%7;
  var goal = 25000;
  var progress = Math.min((earnings.today/goal)*100, 100);
  var remaining = Math.max(goal - earnings.today, 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <LinearGradient
          colors={['#000000', '#003322', '#00853F']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroGradient}
        >
          <Text style={styles.heroEyebrow}>GAINS AUJOURD'HUI</Text>
          <View style={{ marginTop: 6, marginBottom: 12 }}>
            <StrokedAmount amount={earnings.today} fontSize={56} />
          </View>
          <Text style={styles.heroSubtitle}>{'pour ' + earnings.todayRides + ' course' + (earnings.todayRides === 1 ? '' : 's')}</Text>
          <Text style={styles.heroSubtitleSmall}>{remaining > 0 ? "objectif " + goal.toLocaleString() + " FCFA · reste " + remaining.toLocaleString() + " FCFA" : "objectif " + goal.toLocaleString() + " FCFA atteint ✓"}</Text>
          <View style={styles.progressOuter}>
            <View style={[styles.progressInner, { width: progress + "%" }]} />
          </View>
        </LinearGradient>

        <View style={styles.contentArea}>
          <View style={styles.statsRow}>
            <View style={styles.statBox}><Text style={styles.statIcon}>{"🚗"}</Text><Text style={styles.statNum}>{earnings.totalRides}</Text><Text style={styles.statLbl}>Courses</Text></View>
            <View style={styles.statBox}><Text style={styles.statIcon}>{"💰"}</Text><Text style={styles.statNum}>{earnings.total.toLocaleString()}</Text><Text style={styles.statLbl}>Total FCFA</Text></View>
            <View style={styles.statBox}><Text style={styles.statIcon}>{"⭐"}</Text><Text style={styles.statNum}>{user&&user.rating?user.rating.toFixed(1):"5.0"}</Text><Text style={styles.statLbl}>Note</Text></View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Cette semaine</Text>
              <View style={styles.weekBadgeWrap}>
                <Text style={[styles.weekBadgeStroke, { top: -1 }]}>{earnings.weekTotal.toLocaleString() + ' FCFA'}</Text>
                <Text style={[styles.weekBadgeStroke, { top: 1 }]}>{earnings.weekTotal.toLocaleString() + ' FCFA'}</Text>
                <Text style={[styles.weekBadgeStroke, { left: -1 }]}>{earnings.weekTotal.toLocaleString() + ' FCFA'}</Text>
                <Text style={[styles.weekBadgeStroke, { left: 1 }]}>{earnings.weekTotal.toLocaleString() + ' FCFA'}</Text>
                <Text style={styles.weekBadgeText}>{earnings.weekTotal.toLocaleString() + ' FCFA'}</Text>
              </View>
            </View>
            <View style={styles.weeklyBars}>{days.map(function(day,i){var isToday=i===todayIndex;var de=earnings.weeklyBreakdown[i]||0;var maxE=Math.max.apply(null,earnings.weeklyBreakdown)||1;var dh=Math.max(de>0?(de/maxE)*60+10:8,8);return(<View key={day} style={styles.barCol}>{de>0&&<Text style={styles.barAmt}>{(de/1000).toFixed(0)+"k"}</Text>}<View style={[styles.bar,{height:dh},(isToday||de>0)&&styles.barActive]} /><Text style={[styles.barDay,(isToday||de>0)&&styles.barDayActive]}>{day}</Text>{isToday&&<View style={styles.todayDot}/>}</View>);})}</View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Historique des trajets</Text>
            {history.length === 0 ? (
              <Text style={styles.historyEmpty}>Aucun trajet pour l'instant</Text>
            ) : history.map(function(item, idx) {
              var earningsText = (item.driverEarnings || 0).toLocaleString() + ' FCFA';
              return (
                <View key={String(item._id)} style={[styles.historyRow, idx === 0 && { borderTopWidth: 0, paddingTop: 8 }]}>
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyType}>{typeIcon(item.type) + '  ' + typeLabel(item.type)}</Text>
                    <Text style={styles.historyDate}>{formatDate(item.completedAt)}</Text>
                    {item.dropoffAddress ? <Text style={styles.historyAddr} numberOfLines={1}>{item.dropoffAddress}</Text> : null}
                    <View style={styles.historyMetaRow}>
                      <Text style={styles.historyMeta}>{'Client a payé ' + (item.fare || 0).toLocaleString() + ' F'}</Text>
                      <Text style={styles.historyMeta}>{' · -' + (item.platformCommission || 0).toLocaleString() + ' F commission'}</Text>
                    </View>
                    <Text style={styles.historyPay}>{item.paymentMethod === 'wave' ? '🌊 Wave' : '💵 Espèces'}</Text>
                  </View>
                  <View style={styles.historyBadge}>
                    <Text style={[styles.historyBadgeStroke, { top: -1 }]} numberOfLines={1}>{earningsText}</Text>
                    <Text style={[styles.historyBadgeStroke, { top: 1 }]} numberOfLines={1}>{earningsText}</Text>
                    <Text style={[styles.historyBadgeStroke, { left: -1 }]} numberOfLines={1}>{earningsText}</Text>
                    <Text style={[styles.historyBadgeStroke, { left: 1 }]} numberOfLines={1}>{earningsText}</Text>
                    <Text style={styles.historyBadgeText} numberOfLines={1}>{earningsText}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Commission</Text>
              <Text style={styles.commissionAmount}>{commissionBalance.toLocaleString()+" / "+COMMISSION_CAP+" FCFA"}</Text>
            </View>
            <View style={styles.commissionProgressOuter}>
              <View style={[styles.commissionProgressInner,{width:Math.min((commissionBalance/COMMISSION_CAP)*100,100)+"%"}]} />
            </View>
            <Text style={styles.commissionProgressLabel}>{commissionBalance>=COMMISSION_CAP?"Plafond atteint - paiement requis":"Restant avant plafond : "+(COMMISSION_CAP-commissionBalance)+" FCFA"}</Text>
            <View style={styles.commissionWaveRow}>
              <Text style={styles.commissionWaveLabel}>Paiement Wave :</Text>
              <Text style={styles.commissionWaveNumber}>{COMMISSION_WAVE_NUMBER}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F4F7' },

  heroGradient: { paddingTop: 70, paddingBottom: 36, paddingHorizontal: 24, alignItems: 'center' },
  heroEyebrow: { fontSize: 12, fontFamily: 'LexendDeca_700Bold', color: 'rgba(255,255,255,0.85)', letterSpacing: 2, marginBottom: 4 },
  heroSubtitle: { fontSize: 14, fontFamily: 'LexendDeca_500Medium', color: '#FFFFFF', marginTop: 6 },
  heroSubtitleSmall: { fontSize: 12, fontFamily: 'LexendDeca_400Regular', color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  progressOuter: { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 4, marginTop: 16 },
  progressInner: { height: 8, backgroundColor: COLORS.yellow, borderRadius: 4 },

  contentArea: { paddingHorizontal: 16, paddingTop: 18, marginTop: -18, backgroundColor: '#F2F4F7', borderTopLeftRadius: 28, borderTopRightRadius: 28 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, paddingVertical: 14, marginHorizontal: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statNum: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 2 },
  statLbl: { fontSize: 11, color: '#757575', fontFamily: 'LexendDeca_400Regular' },

  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },

  weekBadgeWrap: { alignItems: 'center', justifyContent: 'center' },
  weekBadgeText: { fontFamily: 'Anton_400Regular', fontSize: 22, color: '#FFFFFF', fontStyle: 'italic', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  weekBadgeStroke: { fontFamily: 'Anton_400Regular', fontSize: 22, color: '#000000', fontStyle: 'italic', letterSpacing: 0.5, position: 'absolute' },

  weeklyBars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
  barCol: { alignItems: 'center', flex: 1 },
  barAmt: { fontSize: 9, color: '#757575', marginBottom: 4, fontFamily: 'LexendDeca_400Regular' },
  bar: { width: 20, borderRadius: 6, backgroundColor: '#E8EAEE' },
  barActive: { backgroundColor: COLORS.green },
  barDay: { fontSize: 10, color: '#757575', marginTop: 6, fontFamily: 'LexendDeca_400Regular' },
  barDayActive: { color: '#1A1A1A', fontFamily: 'LexendDeca_600SemiBold' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.yellow, marginTop: 4 },

  historyEmpty: { fontSize: 13, color: '#757575', fontFamily: 'LexendDeca_400Regular', textAlign: 'center', paddingVertical: 14 },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#EEF0F3' },
  historyLeft: { flex: 1, paddingRight: 12 },
  historyType: { fontSize: 13, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  historyDate: { fontSize: 11, color: '#757575', fontFamily: 'LexendDeca_400Regular', marginTop: 2 },
  historyAddr: { fontSize: 12, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular', marginTop: 4 },
  historyMetaRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
  historyMeta: { fontSize: 11, color: '#757575', fontFamily: 'LexendDeca_400Regular' },
  historyPay: { fontSize: 11, color: '#757575', fontFamily: 'LexendDeca_400Regular', marginTop: 4 },
  historyBadge: { alignItems: 'center', justifyContent: 'center', minWidth: 100 },
  historyBadgeText: { fontFamily: 'Anton_400Regular', fontSize: 22, color: '#FFFFFF', fontStyle: 'italic', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  historyBadgeStroke: { fontFamily: 'Anton_400Regular', fontSize: 22, color: '#000000', fontStyle: 'italic', letterSpacing: 0.5, position: 'absolute' },

  commissionAmount: { fontSize: 13, fontFamily: 'LexendDeca_700Bold', color: COLORS.orange },
  commissionProgressOuter: { width: '100%', height: 10, backgroundColor: '#EEF0F3', borderRadius: 5, marginBottom: 10 },
  commissionProgressInner: { height: 10, borderRadius: 5, backgroundColor: COLORS.orange },
  commissionProgressLabel: { fontSize: 12, color: '#757575', fontFamily: 'LexendDeca_400Regular', marginBottom: 14 },
  commissionWaveRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#EEF0F3' },
  commissionWaveLabel: { fontSize: 13, color: '#5a5a5a', fontFamily: 'LexendDeca_400Regular', marginRight: 8 },
  commissionWaveNumber: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: COLORS.green },
});

export default GainsScreen;
