import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Modal,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";

export default function SellerDashboard({ navigation }) {
  const [flowerName, setFlowerName] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [category, setCategory] = useState("real");
  const [flowers, setFlowers] = useState([]);
  const [activeTab, setActiveTab] = useState("flowers");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [ordersToday, setOrdersToday] = useState(0);
  const [earningsToday, setEarningsToday] = useState(0);
  const [dateFilter, setDateFilter] = useState("today");
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [loadingStats, setLoadingStats] = useState(true);
  const [addingFlower, setAddingFlower] = useState(false); // New loading state

  // Define categories
  const categories = [
    { id: "all", name: "All Flowers", icon: "apps" },
    { id: "real", name: "Real Flowers", icon: "flower" },
    { id: "artificial", name: "Artificial", icon: "sparkles" },
    { id: "bouquet", name: "Bouquets", icon: "gift" },
    { id: "potted", name: "Potted Plants", icon: "leaf" },
  ];

  const dateFilters = [
    { id: "today", name: "Today" },
    { id: "week", name: "This Week" },
    { id: "month", name: "This Month" },
    { id: "custom", name: "Custom Date" },
  ];

  useEffect(() => {
    fetchFlowers();
    fetchSellerStats();
  }, [dateFilter]);

  const fetchFlowers = async () => {
    try {
      const q = query(
        collection(db, "flowers"),
        where("sellerId", "==", auth.currentUser.uid)
      );
      const querySnapshot = await getDocs(q);
      const flowerList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFlowers(flowerList);
    } catch (error) {
      console.error("Error fetching flowers:", error);
    }
  };

  const fetchSellerStats = async () => {
    try {
      setLoadingStats(true);
      const sellerId = auth.currentUser.uid;

      // Get all orders that include this seller's products
      const ordersQuery = query(collection(db, "orders"));
      const ordersSnapshot = await getDocs(ordersQuery);

      let totalOrders = 0;
      let totalEarnings = 0;
      const today = new Date();

      ordersSnapshot.docs.forEach((doc) => {
        const order = doc.data();

        // Check if this order contains seller's products
        const sellerItems = order.items?.filter(item => item.sellerId === sellerId);
        if (sellerItems && sellerItems.length > 0) {
          const orderDate = new Date(order.createdAt);
          let shouldInclude = false;

          // Apply date filter
          switch (dateFilter) {
            case "today":
              shouldInclude = isSameDay(orderDate, today);
              break;
            case "week":
              shouldInclude = isSameWeek(orderDate, today);
              break;
            case "month":
              shouldInclude = isSameMonth(orderDate, today);
              break;
            case "custom":
              if (customDate) {
                const selectedDate = new Date(customDate);
                shouldInclude = isSameDay(orderDate, selectedDate);
              }
              break;
          }

          if (shouldInclude) {
            totalOrders++;

            // Calculate seller's earnings from this order ONLY if status is "Delivered"
            if (order.status === "Delivered") {
              const sellerOrderTotal = sellerItems.reduce((sum, item) => {
                const quantity = item.quantity || 1;
                return sum + (parseFloat(item.price) * quantity);
              }, 0);

              totalEarnings += sellerOrderTotal;
            }
          }
        }
      });

      setOrdersToday(totalOrders);
      setEarningsToday(totalEarnings);
    } catch (error) {
      console.error("Error fetching seller stats:", error);
      Alert.alert("Error", "Failed to load sales data");
    } finally {
      setLoadingStats(false);
    }
  };

  // Date helper functions
  const isSameDay = (date1, date2) => {
    return date1.getDate() === date2.getDate() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear();
  };

  const isSameWeek = (date1, date2) => {
    const startOfWeek = new Date(date2);
    startOfWeek.setDate(date2.getDate() - date2.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return date1 >= startOfWeek && date1 <= endOfWeek;
  };

  const isSameMonth = (date1, date2) => {
    return date1.getMonth() === date2.getMonth() &&
      date1.getFullYear() === date2.getFullYear();
  };

  const handleDateFilterChange = (filter) => {
    setDateFilter(filter);
    if (filter === "custom") {
      setDateModalVisible(true);
    }
  };

  const handleCustomDateSelect = () => {
    if (!customDate) {
      Alert.alert("Error", "Please select a date");
      return;
    }
    setDateModalVisible(false);
    fetchSellerStats();
  };

  const getDateFilterLabel = () => {
    const filter = dateFilters.find(f => f.id === dateFilter);
    if (dateFilter === "custom" && customDate) {
      return new Date(customDate).toLocaleDateString();
    }
    return filter?.name || "Today";
  };

  const handleAddFlower = async () => {
    if (!flowerName || !price || !imageUrl) {
      Alert.alert("Missing Info", "Please fill in all fields.");
      return;
    }

    try {
      setAddingFlower(true); // Start loading

      await addDoc(collection(db, "flowers"), {
        sellerId: auth.currentUser.uid,
        name: flowerName,
        price: parseFloat(price),
        image: imageUrl,
        category: category,
        createdAt: new Date().toISOString(),
      });

      Alert.alert("Success", "Flower added successfully!");
      setFlowerName("");
      setPrice("");
      setImageUrl("");
      setCategory("real");
      fetchFlowers();
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setAddingFlower(false); // Stop loading regardless of success/error
    }
  };

  const handleDeleteFlower = async (id) => {
    Alert.alert(
      "Delete Flower",
      "Are you sure you want to delete this flower?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "flowers", id));
              Alert.alert("Deleted", "Flower removed successfully.");
              fetchFlowers();
            } catch (error) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
              navigation.replace("Login");
            } catch (error) {
              Alert.alert("Error", "Failed to log out.");
            }
          },
        },
      ]
    );
  };

  const getCategoryColor = (categoryId) => {
    const colors = {
      real: "#4caf50",
      artificial: "#2196f3",
      bouquet: "#e91e63",
      potted: "#8bc34a",
      dried: "#ff9800",
      all: "#666"
    };
    return colors[categoryId] || "#666";
  };

  const filteredFlowers = selectedCategory === "all"
    ? flowers
    : flowers.filter(flower => flower.category === selectedCategory);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
        <View style={styles.priceTag}>
          <Text style={styles.priceTagText}>₱{item.price}</Text>
        </View>
        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}>
          <Ionicons
            name={categories.find(cat => cat.id === item.category)?.icon || "flower"}
            size={12}
            color="#fff"
          />
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
        <View style={styles.categoryInfo}>
          <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>
            {categories.find(cat => cat.id === item.category)?.name || "Flower"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDeleteFlower(item.id)}
        >
          <Ionicons name="trash-outline" size={16} color="#fff" />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back! 👋</Text>
          <Text style={styles.title}>Seller Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Date Filter */}
      <View style={styles.dateFilterContainer}>
        <Text style={styles.dateFilterLabel}>Showing data for:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateFilterScroll}>
          {dateFilters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.dateFilterChip,
                dateFilter === filter.id && styles.dateFilterChipActive
              ]}
              onPress={() => handleDateFilterChange(filter.id)}
            >
              <Text style={[
                styles.dateFilterText,
                dateFilter === filter.id && styles.dateFilterTextActive
              ]}>
                {filter.id === "custom" && customDate ?
                  new Date(customDate).toLocaleDateString() : filter.name
                }
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Ionicons name="flower-outline" size={20} color="#e91e63" />
            <Text style={styles.statNumber}>{flowers.length}</Text>
            <Text style={styles.statLabel}>Total Flowers</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trending-up-outline" size={20} color="#4caf50" />
            <Text style={styles.statNumber}>
              {loadingStats ? "..." : ordersToday}
            </Text>
            <Text style={styles.statLabel}>Orders ({getDateFilterLabel()})</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="wallet-outline" size={20} color="#ff9800" />
            <Text style={styles.statNumber}>
              {loadingStats ? "..." : `₱${earningsToday.toFixed(2)}`}
            </Text>
            <Text style={styles.statLabel}>Earnings ({getDateFilterLabel()})</Text>
            <Text style={styles.earningsSubtext}>From delivered orders only</Text>
          </View>
        </View>
      </View>

      {/* Navigation Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "flowers" && styles.activeTab]}
          onPress={() => setActiveTab("flowers")}
        >
          <Ionicons
            name="flower"
            size={20}
            color={activeTab === "flowers" ? "#e91e63" : "#666"}
          />
          <Text style={[styles.tabText, activeTab === "flowers" && styles.activeTabText]}>
            My Flowers
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "orders" && styles.activeTab]}
          onPress={() => navigation.navigate("SellerOrders")}
        >
          <Ionicons
            name="receipt"
            size={20}
            color={activeTab === "orders" ? "#e91e63" : "#666"}
          />
          <Text style={[styles.tabText, activeTab === "orders" && styles.activeTabText]}>
            Orders
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Add Flower Form */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Add New Flower</Text>
            <Ionicons name="add-circle" size={24} color="#e91e63" />
          </View>
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="flower-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                placeholder="Flower Name"
                placeholderTextColor="#999"
                style={styles.input}
                value={flowerName}
                onChangeText={setFlowerName}
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="pricetag-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                placeholder="Price"
                placeholderTextColor="#999"
                style={styles.input}
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="image-outline" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                placeholder="Image URL"
                placeholderTextColor="#999"
                style={styles.input}
                value={imageUrl}
                onChangeText={setImageUrl}
              />
            </View>

            {/* Category Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {categories.filter(cat => cat.id !== "all").map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryOption,
                      category === cat.id && styles.categoryOptionSelected,
                      { borderColor: getCategoryColor(cat.id) }
                    ]}
                    onPress={() => setCategory(cat.id)}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={16}
                      color={category === cat.id ? "#fff" : getCategoryColor(cat.id)}
                    />
                    <Text style={[
                      styles.categoryOptionText,
                      category === cat.id && styles.categoryOptionTextSelected
                    ]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <TouchableOpacity
              style={[styles.addBtn, addingFlower && styles.addBtnDisabled]}
              onPress={handleAddFlower}
              disabled={addingFlower}
            >
              {addingFlower ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={22} color="#fff" />
                  <Text style={styles.addText}>Add Flower</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Loading indicator text */}
            {addingFlower && (
              <View style={styles.uploadingContainer}>
                <Text style={styles.uploadingText}>Uploading flower...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Your Flowers with Category Filter */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Flowers</Text>
            <Text style={styles.flowerCount}>({filteredFlowers.length})</Text>
          </View>

          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  selectedCategory === cat.id && styles.filterChipActive,
                  selectedCategory === cat.id && { backgroundColor: getCategoryColor(cat.id) }
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={selectedCategory === cat.id ? "#fff" : getCategoryColor(cat.id)}
                />
                <Text style={[
                  styles.filterText,
                  selectedCategory === cat.id && styles.filterTextActive
                ]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filteredFlowers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="flower-outline" size={64} color="#ddd" />
              <Text style={styles.emptyText}>
                {selectedCategory === "all" ? "No flowers added yet" : `No ${categories.find(cat => cat.id === selectedCategory)?.name} found`}
              </Text>
              <Text style={styles.emptySubtext}>
                {selectedCategory === "all"
                  ? "Start by adding your first flower!"
                  : `Add some ${categories.find(cat => cat.id === selectedCategory)?.name.toLowerCase()} to your collection`
                }
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredFlowers}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.flowersGrid}
            />
          )}
        </View>
      </ScrollView>

      {/* Custom Date Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={dateModalVisible}
        onRequestClose={() => setDateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setDateModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                value={customDate}
                onChangeText={setCustomDate}
              />
              <Text style={styles.dateHint}>Format: YYYY-MM-DD (e.g., 2024-01-15)</Text>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleCustomDateSelect}
              >
                <Text style={styles.confirmButtonText}>Apply Date</Text>
              </TouchableOpacity>
            </View>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  greeting: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a"
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  // Date Filter
  dateFilterContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dateFilterLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  dateFilterScroll: {
    flexDirection: "row",
  },
  dateFilterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
  },
  dateFilterChipActive: {
    backgroundColor: "#e91e63",
  },
  dateFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  dateFilterTextActive: {
    color: "#fff",
  },
  // Stats
  statsContainer: {
    paddingHorizontal: 5,
    paddingVertical: 12,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    marginLeft: 0,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 80,
  },
  statCardPrimary: {
    borderLeftWidth: 3,
    borderLeftColor: "#e91e63",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginTop: 6,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
  },
  earningsSubtext: {
    fontSize: 9,
    color: "#999",
    textAlign: "center",
    marginTop: 2,
    fontStyle: 'italic',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 300,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  modalBody: {
    alignItems: "center",
  },
  dateInput: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#1a1a1a",
    width: "100%",
    marginBottom: 8,
    textAlign: "center",
  },
  dateHint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  confirmButton: {
    backgroundColor: "#e91e63",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  // Rest of your existing styles remain the same
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 12,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  activeTab: {
    backgroundColor: "#fff",
    shadowColor: "#e91e63",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  activeTabText: {
    color: "#e91e63",
  },
  content: {
    flex: 1,
    paddingTop: 8,
  },
  section: {
    marginTop: 16,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  flowerCount: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  inputIcon: {
    padding: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 16,
    fontSize: 16,
    color: "#1a1a1a",
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  categoryScroll: {
    flexDirection: "row",
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  categoryOptionSelected: {
    backgroundColor: "#e91e63",
  },
  categoryOptionText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  categoryOptionTextSelected: {
    color: "#fff",
  },
  addBtn: {
    flexDirection: "row",
    backgroundColor: "#e91e63",
    borderRadius: 12,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#e91e63",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnDisabled: {
    opacity: 0.7,
  },
  addText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8
  },
  // New styles for loading indicator
  uploadingContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  uploadingText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: "#e91e63",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  filterTextActive: {
    color: "#fff",
  },
  flowersGrid: {
    paddingBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    margin: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 140,
  },
  priceTag: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(233, 30, 99, 0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceTagText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12
  },
  categoryBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  cardContent: {
    padding: 12,
  },
  name: {
    fontWeight: "600",
    fontSize: 14,
    color: "#1a1a1a",
    marginBottom: 4,
    height: 36,
  },
  categoryInfo: {
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "500",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff4757",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  deleteText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12
  },
  emptyState: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#666",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
});