import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";

export default function ShopScreen({ navigation }) {
  const [flowers, setFlowers] = useState([]);
  const [filteredFlowers, setFilteredFlowers] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Define categories (same as in SellerDashboard)
  const categories = [
    { id: "all", name: "All Flowers", icon: "apps" },
    { id: "real", name: "Real Flowers", icon: "flower" },
    { id: "artificial", name: "Artificial", icon: "sparkles" },
    { id: "bouquet", name: "Bouquets", icon: "gift" },
    { id: "potted", name: "Potted Plants", icon: "leaf" },
  ];

  useEffect(() => {
    fetchFlowers();
  }, []);

  const fetchFlowers = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const querySnapshot = await getDocs(collection(db, "flowers"));

      const flowerList = await Promise.all(
        querySnapshot.docs.map(async (flowerDoc) => {
          const flower = flowerDoc.data();
          const sellerRef = doc(db, "users", flower.sellerId);
          const sellerSnap = await getDoc(sellerRef);

          if (sellerSnap.exists() && sellerSnap.data().role === "Seller") {
            return { id: flowerDoc.id, ...flower };
          } else {
            return null;
          }
        })
      );

      const validFlowers = flowerList.filter((f) => f !== null);
      setFlowers(validFlowers);
      applyFilters(validFlowers, searchText, selectedCategory);
    } catch (error) {
      console.error("❌ Error fetching flowers:", error);
      Alert.alert("Error", "Failed to load flowers. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  const applyFilters = (flowerList, search, category) => {
    let filtered = flowerList;

    // Apply category filter
    if (category !== "all") {
      filtered = filtered.filter(flower => flower.category === category);
    }

    // Apply search filter
    if (search.trim() !== "") {
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredFlowers(filtered);
  };

  const handleSearch = (text) => {
    setSearchText(text);
    applyFilters(flowers, text, selectedCategory);
  };

  const handleCategoryFilter = (categoryId) => {
    setSelectedCategory(categoryId);
    applyFilters(flowers, searchText, categoryId);
  };

  const handleAddToCart = async (item) => {
    try {
      if (!auth.currentUser) {
        Alert.alert("Please Login", "You must login to add items to your cart.");
        return;
      }

      const flowerRef = doc(db, "flowers", item.id);
      const flowerSnap = await getDoc(flowerRef);

      if (!flowerSnap.exists()) {
        Alert.alert("Error", "Flower not found.");
        return;
      }

      const flowerData = flowerSnap.data();
      let sellerId = flowerData.sellerId || flowerData.userId || null;

      if (!sellerId) {
        Alert.alert(
          "Seller Not Found",
          "This product has no assigned seller. Please contact support."
        );
        return;
      }

      const cartRef = collection(db, "cart");

      const q = query(
        cartRef,
        where("userId", "==", auth.currentUser.uid),
        where("flowerId", "==", item.id)
      );
      const existing = await getDocs(q);

      if (!existing.empty) {
        Alert.alert("Already Added", `${item.name} is already in your cart.`);
        return;
      }

      await addDoc(cartRef, {
        userId: auth.currentUser.uid,
        flowerId: item.id,
        sellerId: sellerId,
        name: flowerData.name,
        price: flowerData.price,
        image: flowerData.image,
        category: flowerData.category, // Add category to cart
        quantity: 1,
        createdAt: new Date().toISOString(),
      });

      Alert.alert("Success", `${item.name} added to cart!`);
    } catch (error) {
      console.log("Add to Cart Error:", error);
      Alert.alert("Error", "Something went wrong while adding to cart.");
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.flowerCard}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.flowerImage} />
        <View style={styles.priceTag}>
          <Text style={styles.priceTagText}>₱{item.price}</Text>
        </View>
        {/* Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}>
          <Ionicons
            name={categories.find(cat => cat.id === item.category)?.icon || "flower"}
            size={12}
            color="#fff"
          />
        </View>
      </View>

      <View style={styles.flowerInfo}>
        <Text style={styles.flowerName} numberOfLines={2}>{item.name}</Text>

        {/* Category Display */}
        <View style={styles.categoryInfo}>
          <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>
            {categories.find(cat => cat.id === item.category)?.name || "Flower"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddToCart(item)}
        >
          <Ionicons name="cart-outline" size={16} color="#fff" />
          <Text style={styles.addButtonText}>Add to Cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const FlowerSkeleton = () => (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonImage} />
      <View style={styles.skeletonText} />
      <View style={styles.skeletonButton} />
    </View>
  );

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
          <Text style={styles.title}>Flower Shop</Text>
          <Text style={styles.subtitle}>{flowers.length} beautiful blooms</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => fetchFlowers(true)}
          disabled={refreshing}
        >
          <Ionicons
            name="refresh"
            size={22}
            color={refreshing ? "#ccc" : "#e91e63"}
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#999" />
        <TextInput
          placeholder="Search flowers..."
          placeholderTextColor="#999"
          style={styles.searchInput}
          value={searchText}
          onChangeText={handleSearch}
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch("")}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter */}
      <View style={styles.categoryFilterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryChip,
                selectedCategory === cat.id && styles.categoryChipActive,
                selectedCategory === cat.id && { backgroundColor: getCategoryColor(cat.id) }
              ]}
              onPress={() => handleCategoryFilter(cat.id)}
            >
              <Ionicons
                name={cat.icon}
                size={14}
                color={selectedCategory === cat.id ? "#fff" : getCategoryColor(cat.id)}
              />
              <Text style={[
                styles.categoryChipText,
                selectedCategory === cat.id && styles.categoryChipTextActive
              ]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results Count */}
      {!loading && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsText}>
            Showing {filteredFlowers.length} of {flowers.length} flowers
            {searchText && ` for "${searchText}"`}
            {selectedCategory !== "all" && ` in ${categories.find(cat => cat.id === selectedCategory)?.name}`}
          </Text>
        </View>
      )}

      {/* Flowers Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e91e63" />
          <Text style={styles.loadingText}>Loading beautiful flowers...</Text>
        </View>
      ) : filteredFlowers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="flower-outline" size={80} color="#ddd" />
          <Text style={styles.emptyTitle}>
            {searchText || selectedCategory !== "all" ? "No flowers found" : "No flowers available"}
          </Text>
          <Text style={styles.emptyText}>
            {searchText
              ? `No results for "${searchText}". Try a different search.`
              : selectedCategory !== "all"
                ? `No ${categories.find(cat => cat.id === selectedCategory)?.name.toLowerCase()} available.`
                : "Check back later for new flower arrivals!"
            }
          </Text>
          {(searchText || selectedCategory !== "all") && (
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => {
                handleSearch("");
                handleCategoryFilter("all");
              }}
            >
              <Text style={styles.clearFilterText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredFlowers}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.flowersGrid}
          refreshing={refreshing}
          onRefresh={() => fetchFlowers(true)}
        />
      )}
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
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1a1a1a",
    marginLeft: 8,
    marginRight: 8,
  },
  // Category Filter
  categoryFilterContainer: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: "#e91e63",
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  // Results
  resultsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  resultsText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
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
  clearFilterButton: {
    backgroundColor: "#e91e63",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  clearFilterText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  // Flowers Grid
  flowersGrid: {
    padding: 16,
    paddingBottom: 20,
  },
  // Flower Card
  flowerCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    margin: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
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
  flowerInfo: {
    padding: 12,
  },
  flowerName: {
    fontWeight: "600",
    fontSize: 14,
    color: "#1a1a1a",
    marginBottom: 4,
    height: 36,
    lineHeight: 18,
  },
  categoryInfo: {
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "500",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e91e63",
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
    shadowColor: "#e91e63",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  // Skeleton Loading (optional)
  skeletonCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    margin: 8,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  skeletonImage: {
    width: "100%",
    height: 140,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    marginBottom: 12,
  },
  skeletonText: {
    height: 16,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonButton: {
    height: 32,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
});