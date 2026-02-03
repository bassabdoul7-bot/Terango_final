import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import COLORS from '../constants/colors';
import { driverService } from '../services/api.service';

const MenuScreen = ({ navigation }) => {
  const [earnings, setEarnings] = useState({ today: 0, total: 0, totalRides: 0 });

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      const response = await driverService.getEarnings();
      setEarnings({
        today: response.earnings.today || 0,
        total: response.earnings.total || 0,
        totalRides: response.earnings.totalRides || 0,
      });
    } catch (error) {
      console.log('Earnings error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Menu</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Earnings Summary */}
        <View style={styles.earningsCard}>
          <Text style={styles.cardTitle}>Gains</Text>
          
          <View style={styles.earningsRow}>
            <View style={styles.earningItem}>
              <Text style={styles.earningValue}>{earnings.today.toLocaleString()}</Text>
              <Text style={styles.earningLabel}>FCFA Aujourd'hui</Text>
            </View>
            
            <View style={styles.earningDivider} />
            
            <View style={styles.earningItem}>
              <Text style={styles.earningValue}>{earnings.total.toLocaleString()}</Text>
              <Text style={styles.earningLabel}>FCFA Total</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.viewDetailsButton}
            onPress={() => navigation.navigate('Earnings')}
          >
            <Text style={styles.viewDetailsText}>Voir détails</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Menu Options */}
        <View style={styles.menuSection}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => navigation.navigate('RideHistory')}
          >
            <Text style={styles.menuIcon}>📜</Text>
            <Text style={styles.menuText}>Historique des courses</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {}}
          >
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text style={styles.menuText}>Paramètres</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => {}}
          >
            <Text style={styles.menuIcon}>❓</Text>
            <Text style={styles.menuText}>Aide & Support</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 28,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  earningsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  earningsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  earningItem: {
    flex: 1,
    alignItems: 'center',
  },
  earningValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.green,
    marginBottom: 4,
  },
  earningLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  earningDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 16,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  viewDetailsText: {
    fontSize: 16,
    color: COLORS.green,
    fontWeight: '600',
    marginRight: 8,
  },
  chevron: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.4)',
  },
  menuSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
});

export default MenuScreen;
