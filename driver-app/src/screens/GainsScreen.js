import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, StatusBar } from "react-native";
import COLORS from "../constants/colors";
import { COMMISSION_WAVE_NUMBER, COMMISSION_CAP } from "../constants/commission";
import { driverService } from "../services/api.service";
import { useAuth } from "../context/AuthContext";

var GainsScreen = function() {
  var auth = useAuth(); var user = auth.user;
  var es = useState({ today: 0, todayRides: 0, total: 0, totalRides: 0, weekTotal: 0, weekRides: 0, weeklyBreakdown: [0,0,0,0,0,0,0] });
  var earnings = es[0]; var setEarnings = es[1];
  var cs = useState(0);
  var commissionBalance = cs[0]; var setCommissionBalance = cs[1];
  useEffect(function() { fetchEarnings(); fetchCommission(); }, []);
  function fetchCommission() { driverService.getProfile().then(function(r) { if (r && r.driver) { setCommissionBalance(r.driver.commissionBalance || 0); } }).catch(function(){}); }
  function fetchEarnings() { driverService.getEarnings().then(function(r) { var e = r.earnings || {}; setEarnings({ today: e.today||0, todayRides: e.todayRides||0, total: e.total||0, totalRides: e.totalRides||0, weekTotal: e.weekTotal||0, weekRides: e.weekRides||0, weeklyBreakdown: e.weeklyBreakdown||[0,0,0,0,0,0,0] }); }).catch(function(){}); }
  var days = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
  var todayIndex = (new Date().getDay()+6)%7;
  var progress = Math.min((earnings.today/25000)*100,100);
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}><Text style={styles.headerTxt}>Mes Gains</Text></View>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{"Gains Aujourd\u0027hui"}</Text>
          <View style={styles.heroRow}><Text style={styles.heroValue}>{earnings.today.toLocaleString()}</Text><Text style={styles.heroCurrency}>FCFA</Text></View>
          <View style={styles.progressOuter}><View style={[styles.progressInner,{width:progress+"%"}]} /></View>
          <Text style={styles.progressLabel}>{"Objectif: 25,000 FCFA \u2022 "+earnings.todayRides+" courses aujourd\u0027hui"}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={{fontSize:24}}>{"\uD83D\uDE97"}</Text><Text style={styles.statNum}>{earnings.totalRides}</Text><Text style={styles.statLbl}>Courses</Text></View>
          <View style={styles.statBox}><Text style={{fontSize:24}}>{"\uD83D\uDCB0"}</Text><Text style={styles.statNum}>{earnings.total.toLocaleString()}</Text><Text style={styles.statLbl}>Total FCFA</Text></View>
          <View style={styles.statBox}><Text style={{fontSize:24}}>{"\u2B50"}</Text><Text style={styles.statNum}>{user&&user.rating?user.rating.toFixed(1):"5.0"}</Text><Text style={styles.statLbl}>Note</Text></View>
        </View>
        <View style={styles.weeklyCard}>
          <View style={styles.weeklyHeader}><Text style={styles.weeklyTitle}>Cette semaine</Text><Text style={styles.weeklyTotal}>{earnings.weekTotal.toLocaleString()+" FCFA"}</Text></View>
          <View style={styles.weeklyBars}>{days.map(function(day,i){var isToday=i===todayIndex;var de=earnings.weeklyBreakdown[i]||0;var maxE=Math.max.apply(null,earnings.weeklyBreakdown)||1;var dh=Math.max(de>0?(de/maxE)*60+10:8,8);return(<View key={day} style={styles.barCol}>{de>0&&<Text style={styles.barAmt}>{(de/1000).toFixed(0)+"k"}</Text>}<View style={[styles.bar,{height:dh},(isToday||de>0)&&styles.barActive]} /><Text style={[styles.barDay,(isToday||de>0)&&styles.barDayActive]}>{day}</Text>{isToday&&<View style={styles.todayDot}/>}</View>);})}</View>
        </View>
        <View style={styles.commissionCard}>
          <View style={styles.commissionHeader}>
            <Text style={styles.commissionTitle}>Commission</Text>
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
        <View style={{height:100}} />
      </ScrollView>
    </View>
  );
};

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: COLORS.darkBg },
  headerTxt: { fontSize: 20, fontFamily: "LexendDeca_700Bold", color: COLORS.textLight, textAlign: "center" },
  content: { flex: 1, paddingHorizontal: 20 },
  hero: { backgroundColor: COLORS.darkCard, borderRadius: 24, padding: 28, marginTop: 20, marginBottom: 24, alignItems: "center", elevation: 8, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  heroLabel: { fontSize: 14, color: COLORS.textLightMuted, marginBottom: 8, fontFamily: "LexendDeca_400Regular" },
  heroRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 20 },
  heroValue: { fontSize: 48, fontFamily: "LexendDeca_700Bold", color: COLORS.textLight },
  heroCurrency: { fontSize: 18, fontFamily: "LexendDeca_600SemiBold", color: COLORS.textLightSub, marginLeft: 8, marginBottom: 8 },
  progressOuter: { width: "100%", height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 4, marginBottom: 12 },
  progressInner: { height: 8, backgroundColor: COLORS.green, borderRadius: 4 },
  progressLabel: { fontSize: 12, color: COLORS.textLightMuted, textAlign: "center", fontFamily: "LexendDeca_400Regular" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  statBox: { flex: 1, alignItems: "center", backgroundColor: COLORS.darkCard, borderRadius: 16, padding: 16, marginHorizontal: 4, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  statNum: { fontSize: 18, fontFamily: "LexendDeca_700Bold", color: COLORS.textLight, marginBottom: 2 },
  statLbl: { fontSize: 11, color: COLORS.textLightMuted, fontFamily: "LexendDeca_400Regular" },
  weeklyCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  weeklyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  weeklyTitle: { fontSize: 16, fontFamily: "LexendDeca_700Bold", color: COLORS.textLight },
  weeklyTotal: { fontSize: 16, fontFamily: "LexendDeca_700Bold", color: COLORS.yellow },
  weeklyBars: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 100 },
  barCol: { alignItems: "center", flex: 1 },
  barAmt: { fontSize: 9, color: COLORS.textLightMuted, marginBottom: 4, fontFamily: "LexendDeca_400Regular" },
  bar: { width: 20, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.08)" },
  barActive: { backgroundColor: COLORS.green },
  barDay: { fontSize: 10, color: COLORS.textLightMuted, marginTop: 6, fontFamily: "LexendDeca_400Regular" },
  barDayActive: { color: COLORS.textLight, fontFamily: "LexendDeca_600SemiBold" },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.yellow, marginTop: 4 },
  commissionCard: { backgroundColor: COLORS.darkCard, borderRadius: 20, padding: 20, marginTop: 24, borderWidth: 1, borderColor: COLORS.darkCardBorder },
  commissionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  commissionTitle: { fontSize: 16, fontFamily: "LexendDeca_700Bold", color: COLORS.textLight },
  commissionAmount: { fontSize: 14, fontFamily: "LexendDeca_600SemiBold", color: COLORS.orange },
  commissionProgressOuter: { width: "100%", height: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 5, marginBottom: 10 },
  commissionProgressInner: { height: 10, borderRadius: 5, backgroundColor: COLORS.orange },
  commissionProgressLabel: { fontSize: 12, color: COLORS.textLightMuted, fontFamily: "LexendDeca_400Regular", marginBottom: 14 },
  commissionWaveRow: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  commissionWaveLabel: { fontSize: 13, color: COLORS.textLightSub, fontFamily: "LexendDeca_400Regular", marginRight: 8 },
  commissionWaveNumber: { fontSize: 15, fontFamily: "LexendDeca_700Bold", color: COLORS.yellow },
});

export default GainsScreen;
