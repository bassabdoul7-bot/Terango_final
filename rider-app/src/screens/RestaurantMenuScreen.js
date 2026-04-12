import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, StatusBar, Image, Alert, Modal, TextInput } from 'react-native';
import * as Location from 'expo-location';
import COLORS from '../constants/colors';
import { restaurantService, orderService } from '../services/api.service';

function RestaurantMenuScreen(props) {
  var navigation = props.navigation;
  var route = props.route;
  var restaurantId = route.params ? route.params.restaurantId : null;
  var restaurantSlug = route.params ? route.params.restaurantSlug : null;
  var currentLocation = route.params ? route.params.currentLocation : null;

  var restaurantState = useState(null); var restaurant = restaurantState[0]; var setRestaurant = restaurantState[1];
  var loadingState = useState(true); var loading = loadingState[0]; var setLoading = loadingState[1];
  var cartState = useState([]); var cart = cartState[0]; var setCart = cartState[1];
  var categoryState = useState('all'); var activeCategory = categoryState[0]; var setActiveCategory = categoryState[1];
  var cartModalState = useState(false); var showCart = cartModalState[0]; var setShowCart = cartModalState[1];
  var checkoutState = useState(false); var showCheckout = checkoutState[0]; var setShowCheckout = checkoutState[1];
  var paymentState = useState('cash'); var paymentMethod = paymentState[0]; var setPaymentMethod = paymentState[1];
  var instructionsState = useState(''); var instructions = instructionsState[0]; var setInstructions = instructionsState[1];
  var submittingState = useState(false); var submitting = submittingState[0]; var setSubmitting = submittingState[1];
  var addressState = useState(''); var deliveryAddress = addressState[0]; var setDeliveryAddress = addressState[1];
  var deliveryFeeState = useState(500); var calculatedDeliveryFee = deliveryFeeState[0]; var setCalculatedDeliveryFee = deliveryFeeState[1];

  var GOOGLE_MAPS_KEY = 'AIzaSyCwm1J7ULt8EnKX-0Gyj6Y_AxISDkbRSkw';

  useEffect(function() { loadRestaurant(); getDeliveryAddress(); }, []);

  function loadRestaurant() {
    setLoading(true);
    var promise = restaurantId ? restaurantService.getRestaurantById(restaurantId) : restaurantService.getRestaurantBySlug(restaurantSlug);
    promise.then(function(response) {
      if (response.success) { setRestaurant(response.restaurant); calculateDeliveryFeeFromDistance(response.restaurant); }
      else { Alert.alert('Erreur', 'Restaurant non trouv\u00e9'); navigation.goBack(); }
      setLoading(false);
    }).catch(function(err) {
      console.error('Load restaurant error:', err);
      setLoading(false);
      Alert.alert('Erreur', 'Impossible de charger le restaurant');
      navigation.goBack();
    });
  }

  function getDeliveryAddress() {
    if (currentLocation) {
      var url = 'https://geocode.terango.sn/reverse?lat=' + currentLocation.latitude + '&lon=' + currentLocation.longitude + '&format=json&accept-language=fr';
      fetch(url, { headers: { 'User-Agent': 'TeranGO/1.0' } }).then(function(r) { return r.json(); }).then(function(data) {
        if (data && data.display_name) { setDeliveryAddress(data.display_name); }
      }).catch(function() {});
    }
  }

  function haversineDistance(lat1, lon1, lat2, lon2) {
    var R = 6371; var dLat = (lat2 - lat1) * Math.PI / 180; var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function calculateDeliveryFeeFromDistance(rest) {
    if (!currentLocation || !rest || !rest.location || !rest.location.coordinates) return;
    var restLat = rest.location.coordinates[1] || rest.location.latitude;
    var restLng = rest.location.coordinates[0] || rest.location.longitude;
    if (!restLat || !restLng) return;

    var googleUrl = 'https://maps.googleapis.com/maps/api/directions/json?origin=' + restLat + ',' + restLng + '&destination=' + currentLocation.latitude + ',' + currentLocation.longitude + '&key=' + GOOGLE_MAPS_KEY;
    fetch(googleUrl).then(function(r) { return r.json(); }).then(function(data) {
      if (data.status === 'OK' && data.routes.length > 0) {
        var dist = data.routes[0].legs[0].distance.value / 1000;
        var fee = Math.max(500, Math.ceil((500 + dist * 150) / 100) * 100);
        setCalculatedDeliveryFee(fee);
        return;
      }
      throw new Error('Google failed');
    }).catch(function() {
      var osrmUrl = 'https://osrm.terango.sn/route/v1/driving/' + restLng + ',' + restLat + ';' + currentLocation.longitude + ',' + currentLocation.latitude + '?overview=false';
      fetch(osrmUrl).then(function(r) { return r.json(); }).then(function(data) {
        if (data.code === 'Ok' && data.routes.length > 0) {
          var dist = data.routes[0].legs[0].distance / 1000;
          var fee = Math.max(500, Math.ceil((500 + dist * 150) / 100) * 100);
          setCalculatedDeliveryFee(fee);
          return;
        }
        throw new Error('OSRM failed');
      }).catch(function() {
        var dist = haversineDistance(restLat, restLng, currentLocation.latitude, currentLocation.longitude) * 1.3;
        var fee = Math.max(500, Math.ceil((500 + dist * 150) / 100) * 100);
        setCalculatedDeliveryFee(fee);
      });
    });
  }

  function getCategories() {
    if (!restaurant || !restaurant.menu) return ['all'];
    var cats = ['all'];
    restaurant.menu.forEach(function(item) { if (item.category && cats.indexOf(item.category) === -1) { cats.push(item.category); } });
    return cats;
  }

  function getFilteredMenu() {
    if (!restaurant || !restaurant.menu) return [];
    if (activeCategory === 'all') return restaurant.menu.filter(function(i) { return i.isAvailable; });
    return restaurant.menu.filter(function(i) { return i.isAvailable && i.category === activeCategory; });
  }

  function addToCart(item) {
    setCart(function(prev) {
      var existing = prev.findIndex(function(c) { return c.menuItemId === item._id; });
      if (existing !== -1) {
        var updated = prev.slice();
        updated[existing] = Object.assign({}, updated[existing], { quantity: updated[existing].quantity + 1 });
        return updated;
      }
      return prev.concat([{ menuItemId: item._id, name: item.name, price: item.price, quantity: 1, options: [] }]);
    });
  }

  function removeFromCart(menuItemId) {
    setCart(function(prev) {
      var existing = prev.findIndex(function(c) { return c.menuItemId === menuItemId; });
      if (existing !== -1 && prev[existing].quantity > 1) {
        var updated = prev.slice();
        updated[existing] = Object.assign({}, updated[existing], { quantity: updated[existing].quantity - 1 });
        return updated;
      }
      return prev.filter(function(c) { return c.menuItemId !== menuItemId; });
    });
  }

  function getCartCount() { return cart.reduce(function(sum, item) { return sum + item.quantity; }, 0); }
  function getSubtotal() { return cart.reduce(function(sum, item) { return sum + (item.price * item.quantity); }, 0); }
  function getDeliveryFee() { return calculatedDeliveryFee; }
  function getPlatformFee() { return Math.round(getSubtotal() * 0.05); }
  function getTotal() { return getSubtotal() + getDeliveryFee() + getPlatformFee(); }
  function getItemQuantity(itemId) { var found = cart.find(function(c) { return c.menuItemId === itemId; }); return found ? found.quantity : 0; }

  function handleCheckout() {
    if (!restaurant) return;
    if (getSubtotal() < restaurant.minimumOrder) {
      Alert.alert('Commande minimum', 'Le minimum est de ' + restaurant.minimumOrder.toLocaleString() + ' FCFA');
      return;
    }
    setShowCart(false);
    setShowCheckout(true);
  }

  function handlePlaceOrder() {
    if (!deliveryAddress.trim()) { Alert.alert('Adresse requise', 'Veuillez entrer votre adresse de livraison'); return; }
    setSubmitting(true);
    var orderData = {
      restaurantId: restaurant._id, items: cart, deliveryFee: getDeliveryFee(),
      dropoffAddress: deliveryAddress,
      dropoffLat: currentLocation ? currentLocation.latitude : 14.6928,
      dropoffLng: currentLocation ? currentLocation.longitude : -17.4467,
      distance: 3, specialInstructions: instructions, paymentMethod: paymentMethod
    };
    orderService.createOrder(orderData).then(function(response) {
      setSubmitting(false);
      if (response.success) {
        setShowCheckout(false); setCart([]);
        Alert.alert('Commande envoy\u00e9e! \uD83C\uDF89', 'Votre commande #' + response.order.orderNumber + ' a \u00e9t\u00e9 envoy\u00e9e au restaurant.', [{ text: 'OK', onPress: function() { navigation.goBack(); } }]);
      } else { Alert.alert('Erreur', response.message || 'Impossible de passer la commande'); }
    }).catch(function(err) { setSubmitting(false); console.error('Order error:', err); Alert.alert('Erreur', 'Erreur de connexion'); });
  }

  if (loading) {
    return (<View style={styles.loadingContainer}><StatusBar barStyle="dark-content" /><ActivityIndicator size="large" color={COLORS.yellow} /><Text style={styles.loadingText}>Chargement du menu...</Text></View>);
  }
  if (!restaurant) return null;

  var categories = getCategories();
  var menuItems = getFilteredMenu();
  var cartCount = getCartCount();
  var PAYMENT_OPTIONS = [
    { key: 'cash', icon: '\uD83D\uDCB5', label: 'Esp\u00e8ces' },
    { key: 'wave', icon: '\uD83C\uDF0A', label: 'Wave' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={function() { navigation.goBack(); }}>
          <Text style={styles.backIcon}>{'\u2190'}</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{restaurant.name}</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.headerStars}>{'\u2B50 ' + (restaurant.rating || 0).toFixed(1)}</Text>
            <Text style={styles.headerDot}>{'\u2022'}</Text>
            <Text style={styles.headerTime}>{(restaurant.estimatedDeliveryTime || 30) + ' min'}</Text>
            <Text style={styles.headerDot}>{'\u2022'}</Text>
            <Text style={styles.headerMin}>{'Min ' + (restaurant.minimumOrder || 1000).toLocaleString() + ' F'}</Text>
          </View>
        </View>
        {restaurant.isOpen ? (
          <View style={styles.openBadge}><Text style={styles.openText}>Ouvert</Text></View>
        ) : (
          <View style={styles.closedBadge}><Text style={styles.closedBadgeText}>{"Ferm\u00e9"}</Text></View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContainer}>
        {categories.map(function(cat) {
          var isActive = activeCategory === cat;
          return (
            <TouchableOpacity key={cat} style={[styles.catChip, isActive && styles.catChipActive]} onPress={function() { setActiveCategory(cat); }}>
              <Text style={[styles.catText, isActive && styles.catTextActive]}>{cat === 'all' ? 'Tout' : cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.menuScroll} nestedScrollEnabled={true} showsVerticalScrollIndicator={false}>
        {menuItems.length === 0 ? (
          <View style={styles.emptyMenu}><Text style={styles.emptyIcon}>{'\uD83C\uDF7D\uFE0F'}</Text><Text style={styles.emptyText}>Aucun plat disponible</Text></View>
        ) : (
          menuItems.map(function(item) {
            var qty = getItemQuantity(item._id);
            return (
              <View key={item._id} style={styles.menuCard}>
                <View style={styles.menuInfo}>
                  <Text style={styles.menuName}>{item.name}</Text>
                  {item.description ? <Text style={styles.menuDesc} numberOfLines={2}>{item.description}</Text> : null}
                  <View style={styles.menuBottom}>
                    <Text style={styles.menuPrice}>{item.price.toLocaleString() + ' FCFA'}</Text>
                    {item.preparationTime ? <Text style={styles.menuTime}>{'\u23F1 ' + item.preparationTime + ' min'}</Text> : null}
                  </View>
                </View>
                <View style={styles.menuActions}>
                  {qty > 0 ? (
                    <View style={styles.qtyControl}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={function() { removeFromCart(item._id); }}><Text style={styles.qtyBtnText}>{'\u2212'}</Text></TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnAdd]} onPress={function() { addToCart(item); }}><Text style={styles.qtyBtnAddText}>+</Text></TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={function() { addToCart(item); }}><Text style={styles.addBtnText}>+</Text></TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {cartCount > 0 && (
        <TouchableOpacity style={styles.cartBar} onPress={function() { setShowCart(true); }} activeOpacity={0.9}>
          <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>
          <Text style={styles.cartBarText}>Voir le panier</Text>
          <Text style={styles.cartBarPrice}>{getSubtotal().toLocaleString() + ' F'}</Text>
        </TouchableOpacity>
      )}

      <Modal visible={showCart} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.cartModal}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Votre panier</Text>
              <TouchableOpacity onPress={function() { setShowCart(false); }}><Text style={styles.cartClose}>{'\u2715'}</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.cartList} nestedScrollEnabled={true}>
              {cart.map(function(item) {
                return (
                  <View key={item.menuItemId} style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemPrice}>{(item.price * item.quantity).toLocaleString() + ' F'}</Text>
                    </View>
                    <View style={styles.cartItemQty}>
                      <TouchableOpacity style={styles.cartQtyBtn} onPress={function() { removeFromCart(item.menuItemId); }}><Text style={styles.cartQtyBtnText}>{'\u2212'}</Text></TouchableOpacity>
                      <Text style={styles.cartQtyText}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.cartQtyBtn} onPress={function() { addToCart({ _id: item.menuItemId, name: item.name, price: item.price }); }}><Text style={styles.cartQtyBtnText}>+</Text></TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.cartSummary}>
              <View style={styles.cartSumRow}><Text style={styles.cartSumLabel}>Sous-total</Text><Text style={styles.cartSumValue}>{getSubtotal().toLocaleString() + ' F'}</Text></View>
              <View style={styles.cartSumRow}><Text style={styles.cartSumLabel}>Livraison</Text><Text style={styles.cartSumValue}>{getDeliveryFee().toLocaleString() + ' F'}</Text></View>
              <View style={styles.cartSumRow}><Text style={styles.cartSumLabel}>Frais de service</Text><Text style={styles.cartSumValue}>{getPlatformFee().toLocaleString() + ' F'}</Text></View>
              <View style={[styles.cartSumRow, styles.cartTotalRow]}><Text style={styles.cartTotalLabel}>Total</Text><Text style={styles.cartTotalValue}>{getTotal().toLocaleString() + ' FCFA'}</Text></View>
            </View>
            <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
              <Text style={styles.checkoutBtnText}>{'Commander \u2022 ' + getTotal().toLocaleString() + ' F'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCheckout} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.checkoutModal}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Finaliser la commande</Text>
              <TouchableOpacity onPress={function() { setShowCheckout(false); }}><Text style={styles.cartClose}>{'\u2715'}</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.checkoutScroll} nestedScrollEnabled={true}>
              <Text style={styles.checkoutSection}>Adresse de livraison</Text>
              <TextInput style={styles.checkoutInput} value={deliveryAddress} onChangeText={setDeliveryAddress} placeholder="Votre adresse..." placeholderTextColor={COLORS.textLightMuted} />
              <Text style={styles.checkoutSection}>{"Instructions sp\u00e9ciales"}</Text>
              <TextInput style={[styles.checkoutInput, { height: 80, textAlignVertical: 'top' }]} value={instructions} onChangeText={setInstructions} placeholder="Ex: Sans oignon, extra piment..." placeholderTextColor={COLORS.textLightMuted} multiline />
              <Text style={styles.checkoutSection}>Moyen de paiement</Text>
              <View style={styles.paymentGrid}>
                <TouchableOpacity style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionActive]} onPress={function() { setPaymentMethod('cash'); }}>
                  <Text style={styles.paymentOptIcon}>{'\uD83D\uDCB5'}</Text>
                  <Text style={[styles.paymentOptLabel, paymentMethod === 'cash' && styles.paymentOptLabelActive]}>{"\u00c9sp\u00e8ces"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.paymentOption, paymentMethod === 'wave' && { borderColor: COLORS.wave, backgroundColor: 'rgba(29,195,225,0.12)' }]} onPress={function() { setPaymentMethod('wave'); }}>
                  <Text style={styles.paymentOptIcon}>{'\uD83C\uDF0A'}</Text>
                  <Text style={[styles.paymentOptLabel, paymentMethod === 'wave' && { color: COLORS.wave, fontFamily: 'LexendDeca_600SemiBold' }]}>Wave</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.cartSummary}>
                <View style={styles.cartSumRow}><Text style={styles.cartSumLabel}>Sous-total</Text><Text style={styles.cartSumValue}>{getSubtotal().toLocaleString() + ' F'}</Text></View>
                <View style={styles.cartSumRow}><Text style={styles.cartSumLabel}>Livraison</Text><Text style={styles.cartSumValue}>{getDeliveryFee().toLocaleString() + ' F'}</Text></View>
                <View style={styles.cartSumRow}><Text style={styles.cartSumLabel}>Frais de service</Text><Text style={styles.cartSumValue}>{getPlatformFee().toLocaleString() + ' F'}</Text></View>
                <View style={[styles.cartSumRow, styles.cartTotalRow]}><Text style={styles.cartTotalLabel}>Total</Text><Text style={styles.cartTotalValue}>{getTotal().toLocaleString() + ' FCFA'}</Text></View>
              </View>
            </ScrollView>
            <TouchableOpacity style={[styles.placeOrderBtn, submitting && styles.placeOrderBtnDisabled]} onPress={handlePlaceOrder} disabled={submitting}>
              {submitting ? <ActivityIndicator color={COLORS.darkBg} /> : <Text style={styles.placeOrderText}>{'Confirmer \u2022 ' + getTotal().toLocaleString() + ' F'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: COLORS.textDarkSub, marginTop: 12, fontSize: 14, fontFamily: 'LexendDeca_400Regular' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: COLORS.darkCard, borderBottomWidth: 1, borderBottomColor: COLORS.darkCardBorder },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backIcon: { fontSize: 22, color: COLORS.textLight, fontFamily: 'LexendDeca_700Bold' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, marginBottom: 4 },
  headerMeta: { flexDirection: 'row', alignItems: 'center' },
  headerStars: { fontSize: 13, color: COLORS.yellow, fontFamily: 'LexendDeca_400Regular' },
  headerDot: { color: COLORS.textLightMuted, marginHorizontal: 6 },
  headerTime: { fontSize: 13, color: COLORS.textLightSub, fontFamily: 'LexendDeca_400Regular' },
  headerMin: { fontSize: 13, color: COLORS.textLightSub, fontFamily: 'LexendDeca_400Regular' },
  openBadge: { backgroundColor: 'rgba(76, 217, 100, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  openText: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.green },
  closedBadge: { backgroundColor: 'rgba(255, 59, 48, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  closedBadgeText: { fontSize: 12, fontFamily: 'LexendDeca_600SemiBold', color: '#FF3B30' },
  catScroll: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  catContainer: { paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  catChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.backgroundWhite, borderWidth: 1, borderColor: COLORS.grayLight, marginRight: 8 },
  catChipActive: { backgroundColor: COLORS.darkCard, borderColor: COLORS.darkCardBorder },
  catText: { fontSize: 13, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textDarkSub },
  catTextActive: { color: COLORS.yellow },
  menuScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  emptyMenu: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 50, marginBottom: 12, fontFamily: 'LexendDeca_400Regular' },
  emptyText: { fontSize: 16, color: COLORS.textDarkSub, fontFamily: 'LexendDeca_400Regular' },
  menuCard: { flexDirection: 'row', backgroundColor: COLORS.backgroundWhite, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.grayLight, elevation: 1 },
  menuInfo: { flex: 1, marginRight: 12 },
  menuName: { fontSize: 16, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textDark, marginBottom: 4 },
  menuDesc: { fontSize: 13, color: COLORS.textDarkSub, marginBottom: 8, lineHeight: 18, fontFamily: 'LexendDeca_400Regular' },
  menuBottom: { flexDirection: 'row', alignItems: 'center' },
  menuPrice: { fontSize: 15, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg, marginRight: 12 },
  menuTime: { fontSize: 12, color: COLORS.textDarkMuted, fontFamily: 'LexendDeca_400Regular' },
  menuActions: { justifyContent: 'center' },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 24, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.grayLight, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 20, color: COLORS.textDark, fontFamily: 'LexendDeca_600SemiBold' },
  qtyBtnAdd: { backgroundColor: COLORS.yellow },
  qtyBtnAddText: { fontSize: 20, color: COLORS.darkBg, fontFamily: 'LexendDeca_600SemiBold' },
  qtyText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.textDark, minWidth: 24, textAlign: 'center' },
  cartBar: { position: 'absolute', bottom: 30, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.yellow, paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, elevation: 8 },
  cartBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.darkBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cartBadgeText: { fontSize: 14, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },
  cartBarText: { flex: 1, fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  cartBarPrice: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  cartModal: { backgroundColor: COLORS.darkCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 34 },
  cartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  cartTitle: { fontSize: 20, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight },
  cartClose: { fontSize: 20, color: COLORS.textLightMuted, padding: 4, fontFamily: 'LexendDeca_400Regular' },
  cartList: { paddingHorizontal: 20, paddingVertical: 12 },
  cartItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 15, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLight, marginBottom: 2 },
  cartItemPrice: { fontSize: 14, color: COLORS.yellow, fontFamily: 'LexendDeca_400Regular' },
  cartItemQty: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartQtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  cartQtyBtnText: { fontSize: 18, color: COLORS.textLight, fontFamily: 'LexendDeca_600SemiBold' },
  cartQtyText: { fontSize: 16, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight, minWidth: 20, textAlign: 'center' },
  cartSummary: { paddingHorizontal: 20, paddingTop: 12 },
  cartSumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cartSumLabel: { fontSize: 14, color: COLORS.textLightMuted, fontFamily: 'LexendDeca_400Regular' },
  cartSumValue: { fontSize: 14, color: COLORS.textLightSub, fontFamily: 'LexendDeca_400Regular' },
  cartTotalRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 4 },
  cartTotalLabel: { fontSize: 17, fontFamily: 'LexendDeca_700Bold', color: COLORS.textLight },
  cartTotalValue: { fontSize: 17, fontFamily: 'LexendDeca_700Bold', color: COLORS.yellow },
  checkoutBtn: { marginHorizontal: 20, marginTop: 16, backgroundColor: COLORS.yellow, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  checkoutBtnText: { fontSize: 17, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
  checkoutModal: { backgroundColor: COLORS.darkCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 34 },
  checkoutScroll: { paddingHorizontal: 20, paddingTop: 8 },
  checkoutSection: { fontSize: 14, fontFamily: 'LexendDeca_600SemiBold', color: COLORS.textLightMuted, textTransform: 'uppercase', marginTop: 16, marginBottom: 10 },
  checkoutInput: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.textLight, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', fontFamily: 'LexendDeca_400Regular' },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paymentOption: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  paymentOptionActive: { borderColor: COLORS.yellow, backgroundColor: 'rgba(212,175,55, 0.1)' },
  paymentOptIcon: { fontSize: 20, marginRight: 10, fontFamily: 'LexendDeca_400Regular' },
  paymentOptLabel: { fontSize: 14, fontFamily: 'LexendDeca_500Medium', color: COLORS.textLightSub },
  paymentOptLabelActive: { color: COLORS.yellow, fontFamily: 'LexendDeca_600SemiBold' },
  placeOrderBtn: { marginHorizontal: 20, marginTop: 16, backgroundColor: COLORS.yellow, paddingVertical: 18, borderRadius: 14, alignItems: 'center' },
  placeOrderBtnDisabled: { opacity: 0.6 },
  placeOrderText: { fontSize: 18, fontFamily: 'LexendDeca_700Bold', color: COLORS.darkBg },
});

export default RestaurantMenuScreen;
