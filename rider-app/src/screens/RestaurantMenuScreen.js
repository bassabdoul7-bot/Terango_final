import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Image,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import COLORS from '../constants/colors';
import { restaurantService, orderService } from '../services/api.service';

var MINT = 'rgba(179, 229, 206, 0.95)';
var MINT_LIGHT = 'rgba(179, 229, 206, 0.12)';
var MINT_BORDER = 'rgba(179, 229, 206, 0.25)';
var YELLOW = '#FCD116';
var DARK_BG = '#0a0a0a';

function RestaurantMenuScreen(props) {
  var navigation = props.navigation;
  var route = props.route;
  var restaurantId = route.params ? route.params.restaurantId : null;
  var restaurantSlug = route.params ? route.params.restaurantSlug : null;
  var currentLocation = route.params ? route.params.currentLocation : null;

  var restaurantState = useState(null);
  var restaurant = restaurantState[0];
  var setRestaurant = restaurantState[1];

  var loadingState = useState(true);
  var loading = loadingState[0];
  var setLoading = loadingState[1];

  var cartState = useState([]);
  var cart = cartState[0];
  var setCart = cartState[1];

  var categoryState = useState('all');
  var activeCategory = categoryState[0];
  var setActiveCategory = categoryState[1];

  var cartModalState = useState(false);
  var showCart = cartModalState[0];
  var setShowCart = cartModalState[1];

  var checkoutState = useState(false);
  var showCheckout = checkoutState[0];
  var setShowCheckout = checkoutState[1];

  var paymentState = useState('cash');
  var paymentMethod = paymentState[0];
  var setPaymentMethod = paymentState[1];

  var instructionsState = useState('');
  var instructions = instructionsState[0];
  var setInstructions = instructionsState[1];

  var submittingState = useState(false);
  var submitting = submittingState[0];
  var setSubmitting = submittingState[1];

  var addressState = useState('');
  var deliveryAddress = addressState[0];
  var setDeliveryAddress = addressState[1];

  useEffect(function() {
    loadRestaurant();
    getDeliveryAddress();
  }, []);

  function loadRestaurant() {
    setLoading(true);
    var promise = restaurantId
      ? restaurantService.getRestaurantById(restaurantId)
      : restaurantService.getRestaurantBySlug(restaurantSlug);

    promise.then(function(response) {
      if (response.success) {
        setRestaurant(response.restaurant);
      } else {
        Alert.alert('Erreur', 'Restaurant non trouve');
        navigation.goBack();
      }
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
      var url = 'https://maps.googleapis.com/maps/api/geocode/json?latlng=' +
        currentLocation.latitude + ',' + currentLocation.longitude +
        '&key=' + process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY + '&language=fr';
      fetch(url).then(function(r) { return r.json(); }).then(function(data) {
        if (data.results && data.results.length > 0) {
          setDeliveryAddress(data.results[0].formatted_address);
        }
      }).catch(function() {});
    }
  }

  function getCategories() {
    if (!restaurant || !restaurant.menu) return ['all'];
    var cats = ['all'];
    restaurant.menu.forEach(function(item) {
      if (item.category && cats.indexOf(item.category) === -1) {
        cats.push(item.category);
      }
    });
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
      return prev.concat([{
        menuItemId: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        options: []
      }]);
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

  function getCartCount() {
    return cart.reduce(function(sum, item) { return sum + item.quantity; }, 0);
  }

  function getSubtotal() {
    return cart.reduce(function(sum, item) { return sum + (item.price * item.quantity); }, 0);
  }

  function getDeliveryFee() { return 500; }
  function getPlatformFee() { return Math.round(getSubtotal() * 0.05); }
  function getTotal() { return getSubtotal() + getDeliveryFee() + getPlatformFee(); }

  function getItemQuantity(itemId) {
    var found = cart.find(function(c) { return c.menuItemId === itemId; });
    return found ? found.quantity : 0;
  }

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
    if (!deliveryAddress.trim()) {
      Alert.alert('Adresse requise', 'Veuillez entrer votre adresse de livraison');
      return;
    }
    setSubmitting(true);

    var orderData = {
      restaurantId: restaurant._id,
      items: cart,
      deliveryFee: getDeliveryFee(),
      dropoffAddress: deliveryAddress,
      dropoffLat: currentLocation ? currentLocation.latitude : 14.6928,
      dropoffLng: currentLocation ? currentLocation.longitude : -17.4467,
      distance: 3,
      specialInstructions: instructions,
      paymentMethod: paymentMethod
    };

    orderService.createOrder(orderData).then(function(response) {
      setSubmitting(false);
      if (response.success) {
        setShowCheckout(false);
        setCart([]);
        Alert.alert(
          'Commande envoyee! 🎉',
          'Votre commande #' + response.order.orderNumber + ' a ete envoyee au restaurant.',
          [{ text: 'OK', onPress: function() { navigation.goBack(); } }]
        );
      } else {
        Alert.alert('Erreur', response.message || 'Impossible de passer la commande');
      }
    }).catch(function(err) {
      setSubmitting(false);
      console.error('Order error:', err);
      Alert.alert('Erreur', 'Erreur de connexion');
    });
  }

  // ========== LOADING ==========
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={YELLOW} />
        <Text style={styles.loadingText}>Chargement du menu...</Text>
      </View>
    );
  }

  if (!restaurant) return null;

  var categories = getCategories();
  var menuItems = getFilteredMenu();
  var cartCount = getCartCount();

  // ========== PAYMENT OPTIONS ==========
  var PAYMENT_OPTIONS = [
    { key: 'cash', icon: '💵', label: 'Especes' },
    { key: 'wave', icon: '🌊', label: 'Wave' },
    { key: 'orange_money', icon: '🟠', label: 'Orange Money' },
    { key: 'free_money', icon: '💳', label: 'Free Money' },
  ];

  // ========== RENDER ==========
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={function() { navigation.goBack(); }}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{restaurant.name}</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.headerStars}>{'⭐ ' + (restaurant.rating || 0).toFixed(1)}</Text>
            <Text style={styles.headerDot}>•</Text>
            <Text style={styles.headerTime}>{(restaurant.estimatedDeliveryTime || 30) + ' min'}</Text>
            <Text style={styles.headerDot}>•</Text>
            <Text style={styles.headerMin}>{'Min ' + (restaurant.minimumOrder || 1000).toLocaleString() + ' F'}</Text>
          </View>
        </View>
        {restaurant.isOpen ? (
          <View style={styles.openBadge}><Text style={styles.openText}>Ouvert</Text></View>
        ) : (
          <View style={styles.closedBadge}><Text style={styles.closedText}>Ferme</Text></View>
        )}
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContainer}>
        {categories.map(function(cat) {
          var isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, isActive && styles.catChipActive]}
              onPress={function() { setActiveCategory(cat); }}
            >
              <Text style={[styles.catText, isActive && styles.catTextActive]}>
                {cat === 'all' ? 'Tout' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Menu Items */}
      <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false}>
        {menuItems.length === 0 ? (
          <View style={styles.emptyMenu}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyText}>Aucun plat disponible</Text>
          </View>
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
                    {item.preparationTime ? <Text style={styles.menuTime}>{'⏱ ' + item.preparationTime + ' min'}</Text> : null}
                  </View>
                </View>
                <View style={styles.menuActions}>
                  {qty > 0 ? (
                    <View style={styles.qtyControl}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={function() { removeFromCart(item._id); }}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{qty}</Text>
                      <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnAdd]} onPress={function() { addToCart(item); }}>
                        <Text style={styles.qtyBtnAddText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={function() { addToCart(item); }}>
                      <Text style={styles.addBtnText}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Cart Button */}
      {cartCount > 0 && (
        <TouchableOpacity style={styles.cartBar} onPress={function() { setShowCart(true); }} activeOpacity={0.9}>
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
          <Text style={styles.cartBarText}>Voir le panier</Text>
          <Text style={styles.cartBarPrice}>{getSubtotal().toLocaleString() + ' F'}</Text>
        </TouchableOpacity>
      )}

      {/* Cart Modal */}
      <Modal visible={showCart} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.cartModal}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Votre panier</Text>
              <TouchableOpacity onPress={function() { setShowCart(false); }}>
                <Text style={styles.cartClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.cartList}>
              {cart.map(function(item) {
                return (
                  <View key={item.menuItemId} style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemPrice}>{(item.price * item.quantity).toLocaleString() + ' F'}</Text>
                    </View>
                    <View style={styles.cartItemQty}>
                      <TouchableOpacity style={styles.cartQtyBtn} onPress={function() { removeFromCart(item.menuItemId); }}>
                        <Text style={styles.cartQtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.cartQtyText}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.cartQtyBtn} onPress={function() { addToCart({ _id: item.menuItemId, name: item.name, price: item.price }); }}>
                        <Text style={styles.cartQtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.cartSummary}>
              <View style={styles.cartSumRow}>
                <Text style={styles.cartSumLabel}>Sous-total</Text>
                <Text style={styles.cartSumValue}>{getSubtotal().toLocaleString() + ' F'}</Text>
              </View>
              <View style={styles.cartSumRow}>
                <Text style={styles.cartSumLabel}>Livraison</Text>
                <Text style={styles.cartSumValue}>{getDeliveryFee().toLocaleString() + ' F'}</Text>
              </View>
              <View style={styles.cartSumRow}>
                <Text style={styles.cartSumLabel}>Frais de service</Text>
                <Text style={styles.cartSumValue}>{getPlatformFee().toLocaleString() + ' F'}</Text>
              </View>
              <View style={[styles.cartSumRow, styles.cartTotalRow]}>
                <Text style={styles.cartTotalLabel}>Total</Text>
                <Text style={styles.cartTotalValue}>{getTotal().toLocaleString() + ' FCFA'}</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
              <Text style={styles.checkoutBtnText}>{'Commander • ' + getTotal().toLocaleString() + ' F'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Checkout Modal */}
      <Modal visible={showCheckout} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.checkoutModal}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Finaliser la commande</Text>
              <TouchableOpacity onPress={function() { setShowCheckout(false); }}>
                <Text style={styles.cartClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.checkoutScroll}>
              <Text style={styles.checkoutSection}>Adresse de livraison</Text>
              <TextInput
                style={styles.checkoutInput}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Votre adresse..."
                placeholderTextColor="rgba(255,255,255,0.3)"
              />

              <Text style={styles.checkoutSection}>Instructions speciales</Text>
              <TextInput
                style={[styles.checkoutInput, { height: 80, textAlignVertical: 'top' }]}
                value={instructions}
                onChangeText={setInstructions}
                placeholder="Ex: Sans oignon, extra piment..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
              />

              <Text style={styles.checkoutSection}>Moyen de paiement</Text>
              <View style={styles.paymentGrid}>
                {PAYMENT_OPTIONS.map(function(opt) {
                  var isActive = paymentMethod === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.paymentOption, isActive && styles.paymentOptionActive]}
                      onPress={function() { setPaymentMethod(opt.key); }}
                    >
                      <Text style={styles.paymentOptIcon}>{opt.icon}</Text>
                      <Text style={[styles.paymentOptLabel, isActive && styles.paymentOptLabelActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.cartSummary}>
                <View style={styles.cartSumRow}>
                  <Text style={styles.cartSumLabel}>Sous-total</Text>
                  <Text style={styles.cartSumValue}>{getSubtotal().toLocaleString() + ' F'}</Text>
                </View>
                <View style={styles.cartSumRow}>
                  <Text style={styles.cartSumLabel}>Livraison</Text>
                  <Text style={styles.cartSumValue}>{getDeliveryFee().toLocaleString() + ' F'}</Text>
                </View>
                <View style={styles.cartSumRow}>
                  <Text style={styles.cartSumLabel}>Frais de service</Text>
                  <Text style={styles.cartSumValue}>{getPlatformFee().toLocaleString() + ' F'}</Text>
                </View>
                <View style={[styles.cartSumRow, styles.cartTotalRow]}>
                  <Text style={styles.cartTotalLabel}>Total</Text>
                  <Text style={styles.cartTotalValue}>{getTotal().toLocaleString() + ' FCFA'}</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.placeOrderBtn, submitting && styles.placeOrderBtnDisabled]}
              onPress={handlePlaceOrder}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.placeOrderText}>{'Confirmer • ' + getTotal().toLocaleString() + ' F'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  loadingContainer: { flex: 1, backgroundColor: DARK_BG, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.5)', marginTop: 12, fontSize: 14 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20,
    paddingBottom: 16, backgroundColor: DARK_BG, borderBottomWidth: 1, borderBottomColor: MINT_BORDER,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: MINT_LIGHT,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: MINT_BORDER,
  },
  backIcon: { fontSize: 22, color: '#fff', fontWeight: 'bold' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerMeta: { flexDirection: 'row', alignItems: 'center' },
  headerStars: { fontSize: 13, color: YELLOW },
  headerDot: { color: 'rgba(255,255,255,0.3)', marginHorizontal: 6 },
  headerTime: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  headerMin: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  openBadge: { backgroundColor: 'rgba(76, 217, 100, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  openText: { fontSize: 12, fontWeight: '600', color: '#4CD964' },
  closedBadge: { backgroundColor: 'rgba(255, 59, 48, 0.15)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  closedText: { fontSize: 12, fontWeight: '600', color: '#FF3B30' },

  // Categories
  catScroll: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  catContainer: { paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: MINT_LIGHT, borderWidth: 1, borderColor: MINT_BORDER, marginRight: 8,
  },
  catChipActive: { backgroundColor: YELLOW, borderColor: YELLOW },
  catText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  catTextActive: { color: '#000' },

  // Menu
  menuScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  emptyMenu: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 50, marginBottom: 12 },
  emptyText: { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  menuCard: {
    flexDirection: 'row', backgroundColor: MINT_LIGHT, borderRadius: 16,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: MINT_BORDER,
  },
  menuInfo: { flex: 1, marginRight: 12 },
  menuName: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 4 },
  menuDesc: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8, lineHeight: 18 },
  menuBottom: { flexDirection: 'row', alignItems: 'center' },
  menuPrice: { fontSize: 15, fontWeight: '700', color: YELLOW, marginRight: 12 },
  menuTime: { fontSize: 12, color: 'rgba(255,255,255,0.3)' },
  menuActions: { justifyContent: 'center' },
  addBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: YELLOW,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: MINT_BORDER,
  },
  qtyBtnText: { fontSize: 20, color: '#fff', fontWeight: '600' },
  qtyBtnAdd: { backgroundColor: YELLOW, borderColor: YELLOW },
  qtyBtnAddText: { fontSize: 20, color: '#000', fontWeight: '600' },
  qtyText: { fontSize: 16, fontWeight: '700', color: '#fff', minWidth: 24, textAlign: 'center' },

  // Cart bar
  cartBar: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', backgroundColor: YELLOW,
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, elevation: 8,
  },
  cartBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  cartBadgeText: { fontSize: 14, fontWeight: 'bold', color: YELLOW },
  cartBarText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#000' },
  cartBarPrice: { fontSize: 16, fontWeight: '700', color: '#000' },

  // Cart modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  cartModal: {
    backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%', paddingBottom: 34,
  },
  cartHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cartTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  cartClose: { fontSize: 20, color: 'rgba(255,255,255,0.5)', padding: 4 },
  cartList: { paddingHorizontal: 20, paddingVertical: 12 },
  cartItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 2 },
  cartItemPrice: { fontSize: 14, color: YELLOW },
  cartItemQty: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartQtyBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: MINT_LIGHT,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: MINT_BORDER,
  },
  cartQtyBtnText: { fontSize: 18, color: '#fff', fontWeight: '600' },
  cartQtyText: { fontSize: 16, fontWeight: '700', color: '#fff', minWidth: 20, textAlign: 'center' },

  // Cart summary
  cartSummary: { paddingHorizontal: 20, paddingTop: 12 },
  cartSumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cartSumLabel: { fontSize: 14, color: 'rgba(255,255,255,0.5)' },
  cartSumValue: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  cartTotalRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12, marginTop: 4 },
  cartTotalLabel: { fontSize: 17, fontWeight: '700', color: '#fff' },
  cartTotalValue: { fontSize: 17, fontWeight: '700', color: YELLOW },

  // Checkout
  checkoutBtn: {
    marginHorizontal: 20, marginTop: 16, backgroundColor: YELLOW,
    paddingVertical: 16, borderRadius: 14, alignItems: 'center',
  },
  checkoutBtnText: { fontSize: 17, fontWeight: '700', color: '#000' },
  checkoutModal: {
    backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%', paddingBottom: 34,
  },
  checkoutScroll: { paddingHorizontal: 20, paddingTop: 8 },
  checkoutSection: {
    fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase', marginTop: 16, marginBottom: 10,
  },
  checkoutInput: {
    backgroundColor: MINT_LIGHT, borderRadius: 12, padding: 14,
    fontSize: 15, color: '#fff', borderWidth: 1, borderColor: MINT_BORDER,
  },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paymentOption: {
    flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center',
    backgroundColor: MINT_LIGHT, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: MINT_BORDER,
  },
  paymentOptionActive: { borderColor: YELLOW, backgroundColor: 'rgba(252, 209, 22, 0.1)' },
  paymentOptIcon: { fontSize: 20, marginRight: 10 },
  paymentOptLabel: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },
  paymentOptLabelActive: { color: YELLOW, fontWeight: '600' },
  placeOrderBtn: {
    marginHorizontal: 20, marginTop: 16, backgroundColor: YELLOW,
    paddingVertical: 18, borderRadius: 14, alignItems: 'center',
  },
  placeOrderBtnDisabled: { opacity: 0.6 },
  placeOrderText: { fontSize: 18, fontWeight: '700', color: '#000' },
});

export default RestaurantMenuScreen;
