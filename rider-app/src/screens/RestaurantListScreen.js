import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, TextInput, Image } from 'react-native';
import COLORS from '../constants/colors';
import { restaurantService } from '../services/api.service';

var CUISINE_FILTERS = [
  { key: 'all', label: 'Tout', icon: '🍽️' },
  { key: 'senegalais', label: 'Sénégalais', icon: '🇸🇳' },
  { key: 'grillades', label: 'Grillades', icon: '🔥' },
  { key: 'fast-food', label: 'Fast Food', icon: '🍔' },
  { key: 'cafe', label: 'Café', icon: '☕' },
  { key: 'patisserie', label: 'Pâtisserie', icon: '🥐' },
];

function RestaurantListScreen(props) {
  var navigation = props.navigation;
  var route = props.route;
  var currentLocation = route.params ? route.params.currentLocation : null;

  var restaurantsState = useState([]); var restaurants = restaurantsState[0]; var setRestaurants = restaurantsState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];
  var searchState = useState(''); var search = searchState[0]; var setSearch = searchState[1];
  var filterState = useState('all'); var activeFilter = filterState[0]; var setActiveFilter = filterState[1];

  useEffect(function() { fetchRestaurants(); }, []);

  function fetchRestaurants() {
    setLoading(true);
    restaurantService.getRestaurants().then(function(response) { setLoading(false); if (response.success) { setRestaurants(response.restaurants || []); } }).catch(function() { setLoading(false); });
  }

  function getFilteredRestaurants() {
    var filtered = restaurants;
    if (activeFilter !== 'all') { filtered = filtered.filter(function(r) { return r.cuisine && r.cuisine.some(function(c) { return c.toLowerCase().indexOf(activeFilter) !== -1; }); }); }
    if (search.trim()) { var q = search.toLowerCase(); filtered = filtered.filter(function(r) { return r.name.toLowerCase().indexOf(q) !== -1 || (r.cuisine && r.cuisine.join(' ').toLowerCase().indexOf(q) !== -1); }); }
    return filtered;
  }

  function renderStars(rating) { var stars = ''; for (var i = 0; i < 5; i++) { stars += i < Math.floor(rating || 0) ? '★' : '☆'; } return stars; }

  function handleRestaurantPress(restaurant) { navigation.navigate('RestaurantMenuScreen', { restaurantId: restaurant._id, restaurantSlug: restaurant.slug, currentLocation: currentLocation }); }

  var filtered = getFilteredRestaurants();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={function() { navigation.goBack(); }}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <View style={styles.headerTitleWrap}><Text style={styles.headerTitle}>🍽️ Restaurants</Text><Text style={styles.headerSub}>{restaurants.length + ' restaurants disponibles'}</Text></View>
      </View>
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput style={styles.searchInput} placeholder="Chercher un restaurant..." placeholderTextColor={COLORS.textDarkMuted} value={search} onChangeText={setSearch} />
          {search.length > 0 && <TouchableOpacity onPress={function() { setSearch(''); }}><Text style={styles.clearIcon}>✕</Text></TouchableOpacity>}
        </View>
      </View>
      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {CUISINE_FILTERS.map(function(f) { var active = activeFilter === f.key; return (
            <TouchableOpacity key={f.key} style={[styles.filterChip, active && styles.filterChipActive]} onPress={function() { setActiveFilter(f.key); }}>
              <Text style={styles.filterIcon}>{f.icon}</Text>
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f.label}</Text>
            </TouchableOpacity>
          ); })}
        </ScrollView>
      </View>
      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={COLORS.yellow} /><Text style={styles.loadingText}>Chargement des restaurants...</Text></View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🍽️</Text><Text style={styles.emptyTitle}>Aucun restaurant</Text>
          <Text style={styles.emptySub}>{search ? 'Aucun résultat pour "' + search + '"' : 'Les restaurants apparaîtront ici bientôt!'}</Text>
          {restaurants.length === 0 && <TouchableOpacity style={styles.retryBtn} onPress={fetchRestaurants}><Text style={styles.retryBtnText}>Actualiser</Text></TouchableOpacity>}
        </View>
      ) : (
        <ScrollView style={styles.listWrap} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
          {filtered.map(function(restaurant) { var isOpen = restaurant.isOpen; return (
            <TouchableOpacity key={restaurant._id} style={[styles.restoCard, !isOpen && styles.restoCardClosed]} onPress={function() { handleRestaurantPress(restaurant); }} activeOpacity={0.85} disabled={!isOpen}>
              <View style={styles.restoImageWrap}>
                {restaurant.coverImage ? <Image source={{ uri: restaurant.coverImage }} style={styles.restoImage} /> : <View style={styles.restoImagePlaceholder}><Text style={styles.restoImageEmoji}>🍽️</Text></View>}
                {!isOpen && <View style={styles.closedOverlay}><Text style={styles.closedText}>Fermé</Text></View>}
                {restaurant.isFeatured && <View style={styles.featuredBadge}><Text style={styles.featuredText}>⭐ Populaire</Text></View>}
              </View>
              <View style={styles.restoInfo}>
                <View style={styles.restoNameRow}><Text style={styles.restoName} numberOfLines={1}>{restaurant.name}</Text>{isOpen && <View style={styles.openDot} />}</View>
                <View style={styles.restoMeta}><Text style={styles.restoStars}>{renderStars(restaurant.rating)}</Text><Text style={styles.restoRating}>{(restaurant.rating || 0).toFixed(1)}</Text><Text style={styles.restoDot}>•</Text><Text style={styles.restoTime}>{(restaurant.estimatedDeliveryTime || 30) + ' min'}</Text></View>
                {restaurant.cuisine && restaurant.cuisine.length > 0 && <View style={styles.cuisineRow}>{restaurant.cuisine.slice(0, 3).map(function(c, i) { return <View key={i} style={styles.cuisineChip}><Text style={styles.cuisineText}>{c}</Text></View>; })}</View>}
                <View style={styles.restoFooter}><Text style={styles.restoMin}>{'Min. ' + (restaurant.minimumOrder || 1000).toLocaleString() + ' FCFA'}</Text><Text style={styles.restoDelivery}>🛵 Livraison incluse</Text></View>
              </View>
            </TouchableOpacity>
          ); })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: COLORS.darkCard, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderBottomWidth: 1, borderBottomColor: COLORS.darkCardBorder },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backIcon: { fontSize: 20, fontWeight: 'bold', color: COLORS.textLight },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textLight },
  headerSub: { fontSize: 12, color: COLORS.textLightSub, marginTop: 2 },
  searchWrap: { paddingHorizontal: 20, paddingTop: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundWhite, borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.grayLight },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchInput: { flex: 1, color: COLORS.textDark, fontSize: 15, paddingVertical: 14 },
  clearIcon: { fontSize: 16, color: COLORS.textDarkMuted, padding: 4 },
  filtersWrap: { paddingTop: 14 },
  filtersScroll: { paddingHorizontal: 20, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.backgroundWhite, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.grayLight, marginRight: 8 },
  filterChipActive: { backgroundColor: COLORS.darkCard, borderColor: COLORS.darkCardBorder },
  filterIcon: { fontSize: 16, marginRight: 6 },
  filterLabel: { fontSize: 13, color: COLORS.textDarkSub, fontWeight: '600' },
  filterLabelActive: { color: COLORS.yellow },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textDarkSub, marginTop: 12, fontSize: 14 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textDark, marginBottom: 8 },
  emptySub: { fontSize: 14, color: COLORS.textDarkSub, textAlign: 'center' },
  retryBtn: { marginTop: 20, backgroundColor: COLORS.yellow, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { fontSize: 15, fontWeight: 'bold', color: COLORS.darkBg },
  listWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  restoCard: { backgroundColor: COLORS.backgroundWhite, borderRadius: 20, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.grayLight, elevation: 2 },
  restoCardClosed: { opacity: 0.6 },
  restoImageWrap: { height: 140, backgroundColor: '#F0F0F0' },
  restoImage: { width: '100%', height: '100%' },
  restoImagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F0' },
  restoImageEmoji: { fontSize: 48 },
  closedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  closedText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  featuredBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: COLORS.yellow, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  featuredText: { fontSize: 11, fontWeight: 'bold', color: COLORS.darkBg },
  restoInfo: { padding: 16 },
  restoNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  restoName: { fontSize: 18, fontWeight: '700', color: COLORS.textDark, flex: 1 },
  openDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green, marginLeft: 8 },
  restoMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  restoStars: { fontSize: 12, color: COLORS.yellow, marginRight: 4 },
  restoRating: { fontSize: 13, fontWeight: '600', color: COLORS.textDark, marginRight: 6 },
  restoDot: { color: COLORS.textDarkMuted, marginRight: 6 },
  restoTime: { fontSize: 13, color: COLORS.textDarkSub },
  cuisineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  cuisineChip: { backgroundColor: COLORS.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  cuisineText: { fontSize: 11, color: COLORS.textDarkSub },
  restoFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  restoMin: { fontSize: 12, color: COLORS.textDarkMuted },
  restoDelivery: { fontSize: 12, color: COLORS.green, fontWeight: '500' },
});

export default RestaurantListScreen;
