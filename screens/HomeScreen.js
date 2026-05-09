import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  setDoc,
  getDoc
} from "firebase/firestore";

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [newAddress, setNewAddress] = useState({
    name: "",
    street: "",
    city: "",
    province: "",
    zipCode: "",
    phone: "",
    isDefault: false,
  });

  // User state
  const [userInfo, setUserInfo] = useState({
    name: "",
    email: "",
    phone: "",
    joinDate: "",
    uid: ""
  });

  // Get current user and their data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // First, try to get user data from your existing Firestore users collection
        await loadUserFromFirestore(user);

        // Load user addresses from Firestore
        await loadUserAddresses(user.uid);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load user data from your existing Firestore users collection
  const loadUserFromFirestore = async (user) => {
    try {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        // User exists in your Firestore - use that data
        const userData = userDoc.data();
        setUserInfo({
          name: userData.name || "User",
          email: userData.email || user.email,
          phone: userData.phone || "",
          joinDate: new Date(userData.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long'
          }),
          uid: user.uid
        });
      } else {
        // User doesn't exist in Firestore yet (shouldn't happen based on your structure)
        // Fallback to auth data
        setUserInfo({
          name: user.displayName || user.email?.split('@')[0] || "User",
          email: user.email,
          phone: user.phoneNumber || "",
          joinDate: new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long'
          }),
          uid: user.uid
        });
      }
    } catch (error) {
      console.error("Error loading user from Firestore:", error);
    }
  };

  // Load user addresses from Firestore
  const loadUserAddresses = async (userId) => {
    try {
      setLoading(true);
      const addressesQuery = query(
        collection(db, "addresses"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(addressesQuery);
      const userAddresses = [];

      querySnapshot.forEach((doc) => {
        userAddresses.push({ id: doc.id, ...doc.data() });
      });

      setAddresses(userAddresses);
    } catch (error) {
      console.error("Error loading addresses:", error);
      // If addresses collection doesn't exist yet, it's ok - we'll create it when adding first address
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await signOut(auth);
            setTimeout(() => {
              setLoading(false);
              navigation.replace("Login");
              Alert.alert("Logged Out", "You have been successfully logged out.");
            }, 800);
          } catch (error) {
            setLoading(false);
            Alert.alert("Error", "Something went wrong while logging out.");
            console.error("Logout error:", error);
          }
        },
      },
    ]);
  };

  // Add new address to Firestore
  const handleAddAddress = async () => {
    if (!newAddress.name || !newAddress.street || !newAddress.city || !newAddress.province || !newAddress.zipCode) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      const user = auth.currentUser;

      if (!user) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      // If this is the first address, set it as default
      const isFirstAddress = addresses.length === 0;
      const addressData = {
        ...newAddress,
        userId: user.uid,
        isDefault: isFirstAddress,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to Firestore - this will create the addresses collection if it doesn't exist
      const docRef = await addDoc(collection(db, "addresses"), addressData);

      // Update local state
      setAddresses([...addresses, { id: docRef.id, ...addressData }]);

      // Reset form
      setNewAddress({
        name: "",
        street: "",
        city: "",
        province: "",
        zipCode: "",
        phone: "",
        isDefault: false,
      });

      setAddressModalVisible(false);
      Alert.alert("Success", "Address added successfully!");
    } catch (error) {
      console.error("Error adding address:", error);
      Alert.alert("Error", "Failed to add address");
    } finally {
      setLoading(false);
    }
  };

  // Set default address in Firestore
  const setDefaultAddress = async (addressId) => {
    try {
      setLoading(true);

      // Update all addresses to set isDefault to false
      const updatePromises = addresses.map(async (address) => {
        const addressRef = doc(db, "addresses", address.id);
        await updateDoc(addressRef, {
          isDefault: address.id === addressId,
          updatedAt: new Date().toISOString(),
        });
      });

      await Promise.all(updatePromises);

      // Update local state
      const updatedAddresses = addresses.map(address => ({
        ...address,
        isDefault: address.id === addressId
      }));

      setAddresses(updatedAddresses);
      Alert.alert("Success", "Default address updated!");
    } catch (error) {
      console.error("Error setting default address:", error);
      Alert.alert("Error", "Failed to update default address");
    } finally {
      setLoading(false);
    }
  };

  // Delete address from Firestore
  const deleteAddress = async (addressId) => {
    Alert.alert("Delete Address", "Are you sure you want to delete this address?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);

            // Check if deleting default address
            const addressToDelete = addresses.find(addr => addr.id === addressId);
            const isDefault = addressToDelete?.isDefault;

            // Delete from Firestore
            await deleteDoc(doc(db, "addresses", addressId));

            // Update local state
            const updatedAddresses = addresses.filter(address => address.id !== addressId);

            // If we deleted the default address and there are other addresses, set the first one as default
            if (isDefault && updatedAddresses.length > 0) {
              const newDefaultAddressId = updatedAddresses[0].id;
              await setDefaultAddress(newDefaultAddressId);
            } else {
              setAddresses(updatedAddresses);
            }

            Alert.alert("Success", "Address deleted successfully!");
          } catch (error) {
            console.error("Error deleting address:", error);
            Alert.alert("Error", "Failed to delete address");
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const featuredFlowers = [
    {
      id: 1,
      name: "Pink and Roses",
      price: "₱400",
      image: "https://images.pexels.com/photos/122737/pexels-photo-122737.jpeg",
    },
    {
      id: 2,
      name: "Lily",
      price: "₱200",
      image: "https://images.pexels.com/photos/3410136/pexels-photo-3410136.jpeg",
    },
    {
      id: 3,
      name: "Sunflower",
      price: "₱150",
      image: "https://images.pexels.com/photos/1169084/pexels-photo-1169084.jpeg",
    },
 
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* 🔄 Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#e91e63" />
            <Text style={styles.loadingText}>
              {userModalVisible ? "Loading..." : "Processing..."}
            </Text>
          </View>
        </View>
      )}

      {/* 👤 User Info Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={userModalVisible}
        onRequestClose={() => setUserModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>My Profile</Text>
              <TouchableOpacity onPress={() => setUserModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* User Avatar and Basic Info */}
              <View style={styles.userHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {userInfo.name ? userInfo.name.charAt(0).toUpperCase() : "U"}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{userInfo.name}</Text>
                  <Text style={styles.userEmail}>{userInfo.email}</Text>
                  <Text style={styles.userSince}>Member since {userInfo.joinDate}</Text>
                </View>
              </View>

              {/* Contact Information */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionLabel}>Contact Information</Text>
                <View style={styles.infoItem}>
                  <Ionicons name="mail-outline" size={20} color="#666" />
                  <Text style={styles.infoText}>{userInfo.email}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="call-outline" size={20} color="#666" />
                  <Text style={styles.infoText}>
                    {userInfo.phone || "No phone number"}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="person-outline" size={20} color="#666" />
                  <Text style={styles.infoText}>Role: Customer</Text>
                </View>
              </View>

              {/* Address Management */}
              <View style={styles.infoSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>My Addresses</Text>
                  <TouchableOpacity
                    style={styles.addButtonSmall}
                    onPress={() => setAddressModalVisible(true)}
                  >
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.addButtonText}>Add New</Text>
                  </TouchableOpacity>
                </View>

                {addresses.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="location-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyStateText}>No addresses saved</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Add your delivery addresses for faster checkout
                    </Text>
                  </View>
                ) : (
                  addresses.map((address) => (
                    <View key={address.id} style={styles.addressCard}>
                      <View style={styles.addressHeader}>
                        <Text style={styles.addressName}>{address.name}</Text>
                        {address.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.addressText}>
                        {address.street}, {address.city}, {address.province} {address.zipCode}
                      </Text>
                      {address.phone && (
                        <Text style={styles.addressPhone}>📞 {address.phone}</Text>
                      )}
                      <View style={styles.addressActions}>
                        <TouchableOpacity
                          style={styles.addressAction}
                          onPress={() => setDefaultAddress(address.id)}
                        >
                          <Ionicons
                            name={address.isDefault ? "star" : "star-outline"}
                            size={16}
                            color={address.isDefault ? "#ffc107" : "#666"}
                          />
                          <Text style={styles.addressActionText}>
                            {address.isDefault ? "Default" : "Set Default"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.addressAction}
                          onPress={() => deleteAddress(address.id)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#e91e63" />
                          <Text style={[styles.addressActionText, { color: "#e91e63" }]}>
                            Delete
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 📍 Add Address Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addressModalVisible}
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Address</Text>
              <TouchableOpacity onPress={() => setAddressModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Address Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Home, Office"
                  value={newAddress.name}
                  onChangeText={(text) => setNewAddress({ ...newAddress, name: text })}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Street Address *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="House No., Street, Barangay"
                  value={newAddress.street}
                  onChangeText={(text) => setNewAddress({ ...newAddress, street: text })}
                  multiline
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>City *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="City"
                    value={newAddress.city}
                    onChangeText={(text) => setNewAddress({ ...newAddress, city: text })}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Province *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Province"
                    value={newAddress.province}
                    onChangeText={(text) => setNewAddress({ ...newAddress, province: text })}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>ZIP Code *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ZIP Code"
                    value={newAddress.zipCode}
                    onChangeText={(text) => setNewAddress({ ...newAddress, zipCode: text })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="+63 XXX XXX XXXX"
                    value={newAddress.phone}
                    onChangeText={(text) => setNewAddress({ ...newAddress, phone: text })}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, loading && styles.saveButtonDisabled]}
                onPress={handleAddAddress}
                disabled={loading}
              >
                <Text style={styles.saveButtonText}>
                  {loading ? "Saving..." : "Save Address"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rest of your JSX remains exactly the same */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* 🌸 Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.logo}>🌸 Petalynx</Text>
            <Text style={styles.tagline}>Bloom.Link.Deliver</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate("Shop")}
            >
              <Ionicons name="search-outline" size={22} color="#666" />
            </TouchableOpacity>
            {/* SWAPPED POSITIONS: Cart icon now comes before User icon */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate("Cart")}
            >
              <Ionicons name="cart-outline" size={22} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setUserModalVisible(true)}
            >
              <Ionicons name="person-outline" size={22} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={22} color="#e91e63" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 💐 Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1509042239860-f550ce710b93",
            }}
            style={styles.heroImage}
          />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Fresh Blooms for Every Mood 🌷</Text>
            <Text style={styles.heroSubtitle}>
              Discover handcrafted bouquets that express love, joy, and gratitude.
            </Text>
            <View style={styles.heroButtons}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => navigation.navigate("Shop")}
              >
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Shop Now</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate("CustomerOrders")}
              >
                <Ionicons name="receipt-outline" size={16} color="#e91e63" />
                <Text style={styles.secondaryButtonText}>My Orders</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 📊 Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Ionicons name="flower-outline" size={24} color="#e91e63" />
            <Text style={styles.statNumber}>50+</Text>
            <Text style={styles.statLabel}>Flower Varieties</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="star-outline" size={24} color="#e91e63" />
            <Text style={styles.statNumber}>4.9</Text>
            <Text style={styles.statLabel}>Customer Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={24} color="#e91e63" />
            <Text style={styles.statNumber}>24/7</Text>
            <Text style={styles.statLabel}>Delivery</Text>
          </View>
        </View>

        {/* 🌼 Featured Blooms */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Blooms</Text>
            <TouchableOpacity
              style={styles.seeAllButton}
              onPress={() => navigation.navigate("Shop")}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <Ionicons name="chevron-forward" size={16} color="#e91e63" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredScroll}
          >
            {featuredFlowers.map((item) => (
              <View key={item.id} style={styles.flowerCard}>
                <View style={styles.imageContainer}>
                  <Image source={{ uri: item.image }} style={styles.flowerImage} />
                  <View style={styles.priceTag}>
                    <Text style={styles.priceTagText}>{item.price}</Text>
                  </View>
                </View>
                <View style={styles.flowerInfo}>
                  <Text style={styles.flowerName} numberOfLines={2}>{item.name}</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate("Shop")}
                  >
                    <Ionicons name="cart-outline" size={16} color="#fff" />
                    <Text style={styles.addButtonText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* 🎉 Promo Banner */}
        <View style={styles.promoCard}>
          <View style={styles.promoContent}>
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>Limited Time</Text>
            </View>
            <Text style={styles.promoTitle}>Special Offer 💝</Text>
            <Text style={styles.promoText}>
              Get 15% off your first order! Use code:
            </Text>
            <View style={styles.promoCode}>
              <Text style={styles.promoCodeText}>PETAL15</Text>
            </View>
          </View>
          <View style={styles.promoImage}>
            <Ionicons name="gift" size={60} color="#e91e63" />
          </View>
        </View>

        {/* 🚚 Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Why Choose Petalynx?</Text>
          <View style={styles.featuresGrid}>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="leaf" size={24} color="#4caf50" />
              </View>
              <Text style={styles.featureTitle}>Fresh Flowers</Text>
              <Text style={styles.featureText}>Daily delivered from local gardens</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="car" size={24} color="#2196f3" />
              </View>
              <Text style={styles.featureTitle}>Fast Delivery</Text>
              <Text style={styles.featureText}>Same day delivery available</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="heart" size={24} color="#e91e63" />
              </View>
              <Text style={styles.featureTitle}>Expert Care</Text>
              <Text style={styles.featureText}>Hand-arranged by florists</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Your existing styles remain exactly the same

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  scrollView: {
    flex: 1,
  },
  // 🔄 Loading Overlay
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  loadingContent: {
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#e91e63",
    fontWeight: "600",
  },
  // 🌸 Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  headerLeft: {
    flex: 1,
  },
  logo: {
    fontSize: 28,
    fontWeight: "800",
    color: "#e91e63",
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
    fontStyle: "italic",
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#e91e63",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  // 💐 Hero Section
  heroSection: {
    margin: 20,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  heroImage: {
    width: "100%",
    height: 240,
  },
  heroContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  heroButtons: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e91e63",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 6,
    shadowColor: "#e91e63",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  secondaryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  // 📊 Stats
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#f0f0f0",
    marginHorizontal: 10,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  // 🌼 Sections
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: "#e91e63",
    fontWeight: "600",
  },
  // 🌸 Featured Flowers
  featuredScroll: {
    paddingHorizontal: 20,
  },
  flowerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginRight: 16,
    width: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  imageContainer: {
    position: "relative",
  },
  flowerImage: {
    width: "100%",
    height: 140,
  },
  priceTag: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(233, 30, 99, 0.95)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceTagText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  flowerInfo: {
    padding: 12,
  },
  flowerName: {
    fontWeight: "600",
    fontSize: 14,
    color: "#1a1a1a",
    marginBottom: 8,
    height: 36,
    lineHeight: 18,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e91e63",
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  // 🎉 Promo Banner
  promoCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: "#e91e63",
  },
  promoContent: {
    flex: 1,
  },
  promoBadge: {
    backgroundColor: "#ffe4ec",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  promoBadgeText: {
    color: "#e91e63",
    fontSize: 10,
    fontWeight: "700",
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  promoText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  promoCode: {
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  promoCodeText: {
    color: "#e91e63",
    fontWeight: "700",
    fontSize: 14,
  },
  promoImage: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 10,
  },
  // 🚚 Features
  featuresSection: {
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  featuresGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  featureItem: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 4,
  },
  featureText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    lineHeight: 16,
  },
  // 👤 User Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  modalBody: {
    padding: 20,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e91e63",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  userSince: {
    fontSize: 12,
    color: "#999",
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoText: {
    marginLeft: 12,
    fontSize: 14,
    color: "#666",
  },
  addButtonSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e91e63",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
  addressCard: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
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
  addressActions: {
    flexDirection: "row",
    gap: 16,
  },
  addressAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addressActionText: {
    fontSize: 12,
    color: "#666",
  },
  // 📍 Address Form Styles
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: "row",
    marginHorizontal: -8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#1a1a1a",
  },
  saveButton: {
    backgroundColor: "#e91e63",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  avatarText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  saveButtonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
});