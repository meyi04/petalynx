import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export default function CartScreen({ navigation }) {
  const [cartItems, setCartItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [deliveryFormVisible, setDeliveryFormVisible] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [userAddresses, setUserAddresses] = useState([]);

  useEffect(() => {
    fetchCart();
    fetchUserAddresses();
  }, []);

  const fetchCart = async () => {
    if (!auth.currentUser) return;

    try {
      const q = query(
        collection(db, "cart"),
        where("userId", "==", auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCartItems(items);
    } catch (error) {
      console.error("Error fetching cart:", error);
    }
  };

  const fetchUserAddresses = async () => {
    if (!auth.currentUser) return;

    try {
      const q = query(
        collection(db, "addresses"),
        where("userId", "==", auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const addresses = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUserAddresses(addresses);

      // Set default address if available
      const defaultAddress = addresses.find(addr => addr.isDefault);
      if (defaultAddress) {
        setSelectedAddress(defaultAddress);
        setRecipient(auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || "");
      }
    } catch (error) {
      console.error("Error fetching addresses:", error);
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const updateQuantity = async (id, newQuantity) => {
    if (newQuantity < 1) {
      // If quantity becomes 0, remove the item
      handleRemoveItem(id);
      return;
    }

    try {
      // Update in Firestore
      const itemRef = doc(db, "cart", id);
      await updateDoc(itemRef, {
        quantity: newQuantity
      });

      // Update local state
      setCartItems(prev =>
        prev.map(item =>
          item.id === id ? { ...item, quantity: newQuantity } : item
        )
      );
    } catch (error) {
      console.error("Error updating quantity:", error);
      Alert.alert("Error", "Failed to update quantity");
    }
  };

  const incrementQuantity = (id) => {
    const item = cartItems.find(item => item.id === id);
    if (item) {
      updateQuantity(id, (item.quantity || 1) + 1);
    }
  };

  const decrementQuantity = (id) => {
    const item = cartItems.find(item => item.id === id);
    if (item) {
      updateQuantity(id, Math.max(0, (item.quantity || 1) - 1));
    }
  };

  const handleRemoveItem = async (id) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to remove this item from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "cart", id));
              // Update local state immediately
              setCartItems(prev => prev.filter(item => item.id !== id));
              // Remove from selected items if it was selected
              setSelectedItems(prev => prev.filter(itemId => itemId !== id));
            } catch (error) {
              console.error("Error removing item:", error);
              Alert.alert("Error", "Failed to remove item from cart");
              // Refresh cart as fallback
              fetchCart();
            }
          },
        },
      ]
    );
  };

  const openCheckout = () => {
    if (selectedItems.length === 0) {
      Alert.alert("No items selected", "Please select items to continue.");
      return;
    }
    setCheckoutVisible(true);
  };

  const placeOrder = async (deliveryType, deliveryInfo = null) => {
    try {
      const selectedProducts = cartItems.filter((item) =>
        selectedItems.includes(item.id)
      );

      // Calculate total with quantities
      const total = selectedProducts.reduce(
        (sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)),
        0
      );

      await addDoc(collection(db, "orders"), {
        userId: auth.currentUser.uid,
        items: selectedProducts,
        total: total,
        status: "Pending",
        deliveryType,
        deliveryInfo,
        createdAt: new Date().toISOString(),
      });

      // Remove ordered items from cart
      for (const id of selectedItems) {
        await deleteDoc(doc(db, "cart", id));
      }

      setSelectedItems([]);
      fetchCart();
      setCheckoutVisible(false);
      setDeliveryFormVisible(false);
      setRecipient("");
      setSelectedAddress(userAddresses.find(addr => addr.isDefault) || null);

      Alert.alert("Order Placed", "Your order has been placed successfully!");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const handleDeliverySubmit = () => {
    if (!recipient || !selectedAddress) {
      Alert.alert("Missing Fields", "Please select an address and enter recipient name.");
      return;
    }

    const deliveryInfo = {
      recipient,
      address: selectedAddress,
    };

    placeOrder("delivery", deliveryInfo);
  };

  const renderAddressItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.addressItem,
        selectedAddress?.id === item.id && styles.selectedAddressItem
      ]}
      onPress={() => setSelectedAddress(item)}
    >
      <View style={styles.addressHeader}>
        <Text style={styles.addressName}>{item.name}</Text>
        {item.isDefault && (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        )}
      </View>
      <Text style={styles.addressText}>
        {item.street}, {item.city}, {item.province} {item.zipCode}
      </Text>
      {item.phone && (
        <Text style={styles.addressPhone}>📞 {item.phone}</Text>
      )}
      <View style={styles.addressSelector}>
        <Ionicons
          name={selectedAddress?.id === item.id ? "radio-button-on" : "radio-button-off"}
          size={20}
          color={selectedAddress?.id === item.id ? "#e91e63" : "#ccc"}
        />
        <Text style={styles.selectAddressText}>
          {selectedAddress?.id === item.id ? "Selected" : "Select this address"}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    const isSelected = selectedItems.includes(item.id);
    const quantity = item.quantity || 1;
    const itemTotal = parseFloat(item.price) * quantity;

    return (
      <View style={styles.itemCard}>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => toggleSelectItem(item.id)}
        >
          <Ionicons
            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
            size={24}
            color={isSelected ? "#e91e63" : "#ccc"}
          />
        </TouchableOpacity>

        <Image source={{ uri: item.image }} style={styles.itemImage} />

        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.itemPrice}>₱{parseFloat(item.price).toFixed(2)} each</Text>

          {/* Quantity Controls */}
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Quantity:</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={[styles.quantityButton, quantity === 1 && styles.quantityButtonDisabled]}
                onPress={() => decrementQuantity(item.id)}
                disabled={quantity === 1}
              >
                <Ionicons name="remove" size={16} color={quantity === 1 ? "#ccc" : "#e91e63"} />
              </TouchableOpacity>

              <Text style={styles.quantityText}>{quantity}</Text>

              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => incrementQuantity(item.id)}
              >
                <Ionicons name="add" size={16} color="#e91e63" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.itemTotal}>Total: ₱{itemTotal.toFixed(2)}</Text>
        </View>

        
      </View>
    );
  };

  // Calculate total with quantities
  const totalSelected = cartItems
    .filter((item) => selectedItems.includes(item.id))
    .reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0);

  const selectedCount = selectedItems.length;

  // Calculate total items count (considering quantities)
  const totalItemsCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Your Cart</Text>
          <Text style={styles.subtitle}>{totalItemsCount} item{totalItemsCount !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={80} color="#ddd" />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyText}>
            Browse our collection and add some beautiful flowers to your cart!
          </Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => navigation.navigate("Shop")}
          >
            <Ionicons name="flower-outline" size={18} color="#fff" />
            <Text style={styles.shopButtonText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Selection Summary */}
          {selectedCount > 0 && (
            <View style={styles.selectionSummary}>
              <Text style={styles.selectionText}>
                {selectedCount} item{selectedCount > 1 ? 's' : ''} selected
              </Text>
              <TouchableOpacity onPress={() => setSelectedItems([])}>
                <Text style={styles.clearSelectionText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cart Items */}
          <FlatList
            data={cartItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />

          {/* Checkout Summary */}
          <View style={styles.checkoutSection}>
            <View style={styles.totalSection}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalPrice}>₱{totalSelected.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.checkoutButton,
                selectedCount === 0 && styles.checkoutButtonDisabled
              ]}
              disabled={selectedCount === 0}
              onPress={openCheckout}
            >
              <Ionicons name="cart" size={20} color="#fff" />
              <Text style={styles.checkoutButtonText}>
                Checkout ({selectedCount})
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Checkout Modal (Delivery or Pickup) */}
      <Modal visible={checkoutVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose Order Type</Text>
            <Text style={styles.modalSubtitle}>
              Select how you'd like to receive your order
            </Text>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => placeOrder("pickup")}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="business-outline" size={24} color="#4caf50" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Store Pickup</Text>
                <Text style={styles.optionDescription}>
                  Pick up your order from our store
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                setCheckoutVisible(false);
                setDeliveryFormVisible(true);
              }}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="car-outline" size={24} color="#e91e63" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Home Delivery</Text>
                <Text style={styles.optionDescription}>
                  Get your order delivered to your address
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setCheckoutVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delivery Form Modal */}
      <Modal visible={deliveryFormVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.deliveryModalContent}>
            <Text style={styles.modalTitle}>Delivery Information</Text>
            <Text style={styles.modalSubtitle}>
              Select your delivery address and enter recipient details
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Recipient Name</Text>
              <TextInput
                placeholder="Enter recipient's full name"
                style={styles.input}
                value={recipient}
                onChangeText={setRecipient}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Delivery Address</Text>
              {userAddresses.length === 0 ? (
                <View style={styles.noAddresses}>
                  <Ionicons name="location-outline" size={40} color="#ccc" />
                  <Text style={styles.noAddressesText}>No addresses saved</Text>
                  <Text style={styles.noAddressesSubtext}>
                    Please add an address in your profile first
                  </Text>
                  <TouchableOpacity
                    style={styles.addAddressButton}
                    onPress={() => {
                      setDeliveryFormVisible(false);
                      navigation.navigate("Home"); // Navigate to home where profile is accessible
                    }}
                  >
                    <Text style={styles.addAddressButtonText}>Go to Profile</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={userAddresses}
                  renderItem={renderAddressItem}
                  keyExtractor={(item) => item.id}
                  style={styles.addressesList}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!recipient || !selectedAddress) && styles.submitButtonDisabled
              ]}
              onPress={handleDeliverySubmit}
              disabled={!recipient || !selectedAddress}
            >
              <Ionicons name="location" size={18} color="#fff" />
              <Text style={styles.submitButtonText}>Confirm Delivery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setDeliveryFormVisible(false);
                setSelectedAddress(userAddresses.find(addr => addr.isDefault) || null);
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  shopButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e91e63",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: "#e91e63",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shopButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  // Selection Summary
  selectionSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#e3f2fd",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
  },
  selectionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1976d2",
  },
  clearSelectionText: {
    fontSize: 14,
    color: "#e91e63",
    fontWeight: "600",
  },
  // List Content
  listContent: {
    padding: 20,
    paddingBottom: 20,
  },
  // Item Card
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  selectButton: {
    marginRight: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
    marginBottom: 8,
  },
  // Quantity Controls
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  quantityLabel: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  quantityButton: {
    width: 24,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  quantityButtonDisabled: {
    backgroundColor: "#f5f5f5",
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    paddingHorizontal: 16,
    minWidth: 40,
    textAlign: "center",
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e91e63",
  },
  removeButton: {
    padding: 8,
    paddinLeft:10,
    marginLeft: 15,
  },
  // Checkout Section
  checkoutSection: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: "700",
    color: "#e91e63",
  },
  checkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e91e63",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    shadowColor: "#e91e63",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkoutButtonDisabled: {
    backgroundColor: "#ccc",
    shadowColor: "#ccc",
  },
  checkoutButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    width: "100%",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  deliveryModalContent: {
    backgroundColor: "#fff",
    width: "100%",
    borderRadius: 20,
    padding: 24,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  // Option Buttons
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 18,
  },
  // Address Selection
  addressesList: {
    maxHeight: 200,
  },
  addressItem: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#f8f9fa",
  },
  selectedAddressItem: {
    borderColor: "#e91e63",
    backgroundColor: "#ffe4ec",
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  addressName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  defaultBadge: {
    backgroundColor: "#ffc107",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  addressText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 4,
  },
  addressPhone: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  addressSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectAddressText: {
    fontSize: 14,
    color: "#666",
  },
  // No Addresses State
  noAddresses: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
  },
  noAddressesText: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
    marginBottom: 4,
  },
  noAddressesSubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginBottom: 16,
  },
  addAddressButton: {
    backgroundColor: "#e91e63",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addAddressButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  // Inputs
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1a1a1a",
  },
  // Buttons
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e91e63",
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 12,
    shadowColor: "#e91e63",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "#ccc",
    shadowColor: "#ccc",
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 16,
  },
});