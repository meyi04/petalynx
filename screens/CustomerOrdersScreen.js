import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export default function CustomerOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, "orders"), where("userId", "==", auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const orderList = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort orders by date (newest first)
      const sortedOrders = orderList.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
      });

      setOrders(sortedOrders);
      setFilteredOrders(sortedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      Alert.alert("Error", "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = (dateFilter) => {
    setFilter(dateFilter);
    const now = new Date();

    switch (dateFilter) {
      case "Today":
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const filteredToday = orders.filter(order => {
          const orderDate = order.createdAt ? new Date(order.createdAt) : new Date(0);
          return orderDate >= today;
        });
        setFilteredOrders(filteredToday);
        break;

      case "This Week":
        const startOfWeek = new Date();
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const filteredWeek = orders.filter(order => {
          const orderDate = order.createdAt ? new Date(order.createdAt) : new Date(0);
          return orderDate >= startOfWeek;
        });
        setFilteredOrders(filteredWeek);
        break;

      case "This Month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const filteredMonth = orders.filter(order => {
          const orderDate = order.createdAt ? new Date(order.createdAt) : new Date(0);
          return orderDate >= startOfMonth;
        });
        setFilteredOrders(filteredMonth);
        break;

      case "Last Month":
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const filteredLastMonth = orders.filter(order => {
          const orderDate = order.createdAt ? new Date(order.createdAt) : new Date(0);
          return orderDate >= startOfLastMonth && orderDate <= endOfLastMonth;
        });
        setFilteredOrders(filteredLastMonth);
        break;

      default:
        setFilteredOrders(orders);
        break;
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      "Pending": "#ff9800",
      "Shipped": "#2196f3",
      "Delivered": "#4caf50",
      "Cancelled": "#f44336",
      "Ready for Pickup": "#9c27b0"
    };
    return statusColors[status] || "#666";
  };

  const getStatusIcon = (status) => {
    const statusIcons = {
      "Pending": "time-outline",
      "Shipped": "car-outline",
      "Delivered": "checkmark-done-outline",
      "Cancelled": "close-circle-outline",
      "Ready for Pickup": "cube-outline"
    };
    return statusIcons[status] || "help-outline";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Today";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleCancelOrder = async (orderId) => {
    Alert.alert(
      "Cancel Order",
      "Are you sure you want to cancel this order?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "orders", orderId), { status: "Cancelled" });
              Alert.alert("Order Cancelled", "Your order has been cancelled.");
              fetchOrders();
            } catch (error) {
              console.error("Cancel error:", error);
              Alert.alert("Error", "Could not cancel order. Try again.");
            }
          },
        },
      ]
    );
  };

  const renderOrderItem = ({ item }) => {
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);

    return (
      <View style={styles.orderCard}>
        {/* Order Header */}
        <View style={styles.cardHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>Order #{item.id.slice(-8)}</Text>
            <Text style={styles.orderDate}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Ionicons name={statusIcon} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* Delivery Info */}
        <View style={styles.deliveryInfo}>
          <Ionicons
            name={item.deliveryType === "pickup" ? "business-outline" : "car-outline"}
            size={16}
            color="#666"
          />
          <Text style={styles.deliveryText}>
            {item.deliveryType === "pickup"
              ? "📍 Store Pickup"
              : `🚚 Home Delivery`}
          </Text>
        </View>

        {/* Order Items */}
        <View style={styles.itemsSection}>
          <Text style={styles.itemsLabel}>Items:</Text>
          {item.items?.map((flower, index) => (
            <View key={flower.flowerId || flower.id || index} style={styles.itemRow}>
              <Image source={{ uri: flower.image }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{flower.name}</Text>
                <Text style={styles.itemPrice}>₱{flower.price}</Text>
                <Text style={styles.itemQuantity}>Qty: {flower.quantity || 1}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Order Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total Amount:</Text>
          <Text style={styles.totalPrice}>₱{item.total?.toFixed(2) || "0.00"}</Text>
        </View>

        {/* Action Buttons */}
        {item.status === "Pending" && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancelOrder(item.id)}
          >
            <Ionicons name="close-circle-outline" size={18} color="#fff" />
            <Text style={styles.cancelButtonText}>Cancel Order</Text>
          </TouchableOpacity>
        )}

        {item.status === "Delivered" && (
          <View style={styles.completedTag}>
            <Ionicons name="checkmark-circle" size={16} color="#4caf50" />
            <Text style={styles.completedText}>Order Completed</Text>
          </View>
        )}

        {item.status === "Cancelled" && (
          <View style={styles.cancelledTag}>
            <Ionicons name="close-circle" size={16} color="#f44336" />
            <Text style={styles.cancelledText}>Order Cancelled</Text>
          </View>
        )}
      </View>
    );
  };

  const getDateFilterCounts = () => {
    const now = new Date();

    // Today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = orders.filter(order => {
      const orderDate = order.createdAt ? new Date(order.createdAt) : new Date(0);
      return orderDate >= today;
    }).length;

    // This Week
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekCount = orders.filter(order => {
      const orderDate = order.createdAt ? new Date(order.createdAt) : new Date(0);
      return orderDate >= startOfWeek;
    }).length;

    // This Month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCount = orders.filter(order => {
      const orderDate = order.createdAt ? new Date(order.createdAt) : new Date(0);
      return orderDate >= startOfMonth;
    }).length;

    // Last Month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const lastMonthCount = orders.filter(order => {
      const orderDate = order.createdAt ? new Date(order.createdAt) : new Date(0);
      return orderDate >= startOfLastMonth && orderDate <= endOfLastMonth;
    }).length;

    return {
      "All": orders.length,
      "Today": todayCount,
      "This Week": weekCount,
      "This Month": monthCount,
      "Last Month": lastMonthCount,
    };
  };

  const dateFilterCounts = getDateFilterCounts();

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
          <Text style={styles.title}>My Orders</Text>
          <Text style={styles.subtitle}>{orders.length} total orders</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Date Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {Object.keys(dateFilterCounts).map((dateFilter) => (
          <TouchableOpacity
            key={dateFilter}
            style={[
              styles.filterChip,
              filter === dateFilter && styles.filterChipActive
            ]}
            onPress={() => applyFilter(dateFilter)}
          >
            <Text style={[
              styles.filterText,
              filter === dateFilter && styles.filterTextActive
            ]}>
              {dateFilter} ({dateFilterCounts[dateFilter]})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="receipt-outline" size={48} color="#ddd" />
          <Text style={styles.loadingText}>Loading your orders...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={80} color="#ddd" />
          <Text style={styles.emptyTitle}>No orders found</Text>
          <Text style={styles.emptyText}>
            {filter === "All"
              ? "You haven't placed any orders yet"
              : `No orders from ${filter.toLowerCase()}`
            }
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
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
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
  headerRight: {
    width: 40,
  },
  // Filter
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
    minHeight: 40,
    justifyContent: "center",
  },
  filterChipActive: {
    backgroundColor: "#e91e63",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    textAlign: "center",
  },
  filterTextActive: {
    color: "#fff",
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
  // List Content
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  // Order Card
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: "#666",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // Delivery Info
  deliveryInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  deliveryText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  // Items Section
  itemsSection: {
    marginBottom: 16,
  },
  itemsLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
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
    fontSize: 14,
    fontWeight: "700",
    color: "#e91e63",
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: "#666",
  },
  // Total Section
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e91e63",
  },
  // Action Buttons
  cancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f44336",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    shadowColor: "#f44336",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  completedTag: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4caf5020",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  completedText: {
    color: "#4caf50",
    fontWeight: "600",
    fontSize: 14,
  },
  cancelledTag: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4433620",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  cancelledText: {
    color: "#f44336",
    fontWeight: "600",
    fontSize: 14,
  },
});