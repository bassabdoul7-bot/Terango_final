import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch, ActivityIndicator } from 'react-native';
import { authService } from '../services/api.service';
import { useAuth } from '../context/AuthContext';
import COLORS from '../constants/colors';

function pad2(n) { return String(n).padStart(2, '0'); }

// Empty slot template
var EMPTY = { name: '', phone: '' };

export default function SafetySettingsScreen(props) {
  var navigation = props.navigation;
  var auth = useAuth();
  var user = (auth && auth.user) || {};

  // Pad contacts up to 3 slots for editing convenience.
  var initialContacts = (Array.isArray(user.emergencyContacts) ? user.emergencyContacts : []).slice(0, 3);
  while (initialContacts.length < 3) initialContacts.push({ name: '', phone: '' });
  var [contacts, setContacts] = useState(initialContacts.map(function(c) { return { name: c.name || '', phone: c.phone || '' }; }));

  // Auto-share config
  var initialAuto = user.autoShare || {};
  var [enabled, setEnabled] = useState(!!initialAuto.enabled);
  var [alwaysOn, setAlwaysOn] = useState(!!initialAuto.alwaysOn);
  var [startHour, setStartHour] = useState(initialAuto.startHour != null ? initialAuto.startHour : 22);
  var [endHour, setEndHour] = useState(initialAuto.endHour != null ? initialAuto.endHour : 6);
  var [contactPhone, setContactPhone] = useState(initialAuto.contactPhone || '');
  var [contactName, setContactName] = useState(initialAuto.contactName || '');

  var [savingContacts, setSavingContacts] = useState(false);
  var [savingAuto, setSavingAuto] = useState(false);

  function updateContact(idx, field, value) {
    setContacts(function(prev) {
      var next = prev.slice();
      next[idx] = Object.assign({}, next[idx], {});
      next[idx][field] = value;
      return next;
    });
  }

  function saveContacts() {
    var valid = contacts.filter(function(c) { return c.name && c.name.trim() && c.phone && c.phone.trim(); }).map(function(c) {
      return { name: c.name.trim(), phone: c.phone.trim() };
    });
    setSavingContacts(true);
    authService.updateEmergencyContacts(valid).then(function(res) {
      if (res && res.success) {
        if (auth.refreshUser) auth.refreshUser();
        Alert.alert('Enregistre', 'Vos contacts de confiance ont ete mis a jour.');
      } else {
        Alert.alert('Erreur', (res && res.message) || 'Echec');
      }
    }).catch(function(e) {
      var msg = (e && e.response && e.response.data && e.response.data.message) || 'Echec';
      Alert.alert('Erreur', msg);
    }).finally(function() { setSavingContacts(false); });
  }

  function saveAutoShare() {
    if (enabled && (!contactPhone || !contactName)) {
      return Alert.alert('Contact requis', 'Choisissez un contact qui recevra le lien de suivi.');
    }
    setSavingAuto(true);
    authService.updateAutoShare({
      enabled: enabled,
      alwaysOn: alwaysOn,
      startHour: parseInt(startHour, 10),
      endHour: parseInt(endHour, 10),
      contactPhone: contactPhone,
      contactName: contactName
    }).then(function(res) {
      if (res && res.success) {
        if (auth.refreshUser) auth.refreshUser();
        Alert.alert('Enregistre', enabled ? 'Le partage automatique est active.' : 'Le partage automatique est desactive.');
      } else {
        Alert.alert('Erreur', (res && res.message) || 'Echec');
      }
    }).catch(function() {
      Alert.alert('Erreur', 'Echec de mise a jour');
    }).finally(function() { setSavingAuto(false); });
  }

  // List of valid contacts (with name + phone) — used to pick the auto-share recipient
  var savedContactsList = contacts.filter(function(c) { return c.name && c.phone; });

  function pickAutoContact(c) {
    setContactName(c.name);
    setContactPhone(c.phone);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={function() { navigation.goBack(); }} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Securite</Text>
          <Text style={styles.headerSub}>Contacts de confiance + partage auto</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* TRUSTED CONTACTS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contacts de confiance</Text>
          <Text style={styles.sectionSub}>
            Jusqu'a 3 personnes. Pendant une course, vous pouvez leur envoyer un lien de suivi en direct en un seul clic.
          </Text>

          {contacts.map(function(c, idx) {
            return (
              <View key={idx} style={styles.contactRow}>
                <View style={styles.contactInputs}>
                  <TextInput
                    style={styles.input}
                    placeholder={'Nom #' + (idx + 1)}
                    placeholderTextColor="#999"
                    value={c.name}
                    onChangeText={function(v) { updateContact(idx, 'name', v); }}
                  />
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    placeholder="Telephone (ex: +221...)"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                    value={c.phone}
                    onChangeText={function(v) { updateContact(idx, 'phone', v); }}
                  />
                </View>
                {(c.name || c.phone) ? (
                  <TouchableOpacity style={styles.clearBtn} onPress={function() { updateContact(idx, 'name', ''); updateContact(idx, 'phone', ''); }}>
                    <Text style={styles.clearBtnText}>{'X'}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}

          <TouchableOpacity style={[styles.saveBtn, savingContacts && { opacity: 0.6 }]} onPress={saveContacts} disabled={savingContacts}>
            {savingContacts ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Enregistrer les contacts</Text>}
          </TouchableOpacity>
        </View>

        {/* AUTO-SHARE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partage automatique</Text>
          <Text style={styles.sectionSub}>
            Envoie un lien de suivi en direct au contact choisi des qu'un chauffeur accepte votre course.
          </Text>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Activer le partage automatique</Text>
              <Text style={styles.toggleSub}>Le lien part par SMS / WhatsApp</Text>
            </View>
            <Switch value={enabled} onValueChange={setEnabled} thumbColor={enabled ? COLORS.green : '#CCC'} trackColor={{ false: '#DDD', true: 'rgba(0,133,63,0.4)' }} />
          </View>

          {enabled ? (
            <View>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>Tout le temps</Text>
                  <Text style={styles.toggleSub}>{alwaysOn ? 'A chaque course, jour et nuit' : "Seulement la nuit (" + pad2(startHour) + 'h - ' + pad2(endHour) + 'h)'}</Text>
                </View>
                <Switch value={alwaysOn} onValueChange={setAlwaysOn} thumbColor={alwaysOn ? COLORS.green : '#CCC'} trackColor={{ false: '#DDD', true: 'rgba(0,133,63,0.4)' }} />
              </View>

              {!alwaysOn ? (
                <View style={styles.hoursRow}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={styles.fieldLabel}>De (heure)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={String(startHour)} onChangeText={function(v) { var n = parseInt(v, 10); if (!isNaN(n) && n >= 0 && n <= 23) setStartHour(n); else if (v === '') setStartHour(0); }} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <Text style={styles.fieldLabel}>A (heure)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={String(endHour)} onChangeText={function(v) { var n = parseInt(v, 10); if (!isNaN(n) && n >= 0 && n <= 23) setEndHour(n); else if (v === '') setEndHour(0); }} />
                  </View>
                </View>
              ) : null}

              <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Destinataire</Text>
              {savedContactsList.length === 0 ? (
                <Text style={styles.helperText}>Enregistrez d'abord au moins un contact ci-dessus pour pouvoir le choisir ici.</Text>
              ) : (
                savedContactsList.map(function(c, i) {
                  var active = contactPhone === c.phone;
                  return (
                    <TouchableOpacity key={i} onPress={function() { pickAutoContact(c); }} style={[styles.contactPick, active && styles.contactPickActive]}>
                      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.contactPickName, active && { color: COLORS.green }]}>{c.name}</Text>
                        <Text style={styles.contactPickPhone}>{c.phone}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          ) : null}

          <TouchableOpacity style={[styles.saveBtn, savingAuto && { opacity: 0.6 }]} onPress={saveAutoShare} disabled={savingAuto}>
            {savingAuto ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Enregistrer le partage auto</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {"Vos contacts ne sont jamais partages avec les chauffeurs. Seul le lien de suivi (carte + position en direct) est envoye, et il expire des que la course se termine."}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8', marginRight: 12 },
  backIcon: { fontSize: 20, color: '#1A1A1A', fontFamily: 'LexendDeca_700Bold' },
  headerTitle: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: '#757575', marginTop: 2, fontFamily: 'LexendDeca_400Regular' },
  section: { padding: 16, borderBottomWidth: 8, borderBottomColor: '#F4F6F8' },
  sectionTitle: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A', marginBottom: 6 },
  sectionSub: { fontSize: 12, color: '#5a5a5a', marginBottom: 14, lineHeight: 18, fontFamily: 'LexendDeca_400Regular' },
  contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  contactInputs: { flex: 1 },
  input: { borderWidth: 1, borderColor: '#EEF0F3', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1A1A1A', backgroundColor: '#FFFFFF', fontFamily: 'LexendDeca_400Regular' },
  clearBtn: { marginLeft: 8, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F6F8' },
  clearBtnText: { fontSize: 14, color: '#757575', fontFamily: 'LexendDeca_700Bold' },
  saveBtn: { backgroundColor: COLORS.green, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#FFF', fontSize: 14, fontFamily: 'LexendDeca_700Bold' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  toggleLabel: { fontSize: 14, color: '#1A1A1A', fontFamily: 'LexendDeca_600SemiBold' },
  toggleSub: { fontSize: 12, color: '#757575', marginTop: 2, fontFamily: 'LexendDeca_400Regular' },
  hoursRow: { flexDirection: 'row', marginTop: 10 },
  fieldLabel: { fontSize: 12, color: '#1A1A1A', marginBottom: 6, fontFamily: 'LexendDeca_600SemiBold' },
  helperText: { fontSize: 13, color: '#9a2222', backgroundColor: 'rgba(220,38,38,0.06)', padding: 10, borderRadius: 8, fontFamily: 'LexendDeca_400Regular' },
  contactPick: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 8, backgroundColor: '#F4F6F8', borderWidth: 2, borderColor: 'transparent' },
  contactPickActive: { backgroundColor: 'rgba(0,133,63,0.08)', borderColor: COLORS.green },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#CCC', marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: COLORS.green },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: COLORS.green },
  contactPickName: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: '#1A1A1A' },
  contactPickPhone: { fontSize: 12, color: '#757575', marginTop: 2, fontFamily: 'LexendDeca_400Regular' },
  notice: { margin: 16, padding: 12, borderRadius: 10, backgroundColor: 'rgba(212,175,55,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
  noticeText: { fontSize: 12, color: '#5a5a5a', lineHeight: 18, fontFamily: 'LexendDeca_400Regular' }
});
