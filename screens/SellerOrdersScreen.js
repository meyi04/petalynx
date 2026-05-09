import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "../firebaseConfig";
import { collection, onSnapshot, updateDoc, doc } from "firebase/firestore";

export default function SellerOrdersScreen({ navigation }) {
  const [orders, setOrders] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    const q = collection(db, "orders");

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allOrders = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Filter only orders that include this seller's products
      const sellerOrders = allOrders.filter((order) =>
        order.items?.some((item) => item.sellerId === auth.currentUser?.uid)
      );

      // Sort orders by date (newest first)
      const sortedOrders = sellerOrders.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.orderDate || 0);
        const dateB = new Date(b.createdAt || b.orderDate || 0);
        return dateB - dateA; // Newest first
      });

      setOrders(sortedOrders);
    });

    return () => unsubscribe();
  }, []);

  const updateOrderStatus = async (orderId, newStatus) => {
    Alert.alert(
      "Update Order",
      `Are you sure you want to mark this order as ${newStatus}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          style: "default",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "orders", orderId), { status: newStatus });
              Alert.alert("Success", `Order marked as ${newStatus}.`);
            } catch (error) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    const statusColors = {
      "Pending": "#ff9800",
      "Ready for Pickup": "#2196f3",
      "Shipped": "#9c27b0",
      "Delivered": "#4caf50",
      "Cancelled": "#f44336"
    };
    return statusColors[status] || "#666";
  };

  const getStatusIcon = (status) => {
    const statusIcons = {
      "Pending": "time-outline",
      "Ready for Pickup": "cube-outline",
      "Shipped": "car-outline",
      "Delivered": "checkmark-done-outline",
      "Cancelled": "close-circle-outline"
    };
    return statusIcons[status] || "help-outline";
  };

  // Safe address getter function
  const getDeliveryAddress = (order) => {
    if (!order.deliveryInfo) return null;
    
    // Handle different address formats
    if (typeof order.deliveryInfo.address === 'string') {
      return order.deliveryInfo.address;
    }
    
    if (order.deliveryInfo.address && typeof order.deliveryInfo.address === 'object') {
      // If address is an object, format it
      const addr = order.deliveryInfo.address;
      return `${addr.street || ''}${addr.city ? ', ' + addr.city : ''}${addr.state ? ', ' + addr.state : ''}${addr.zipCode ? ' ' + addr.zipCode : ''}`.trim();
    }
    
    return null;
  };

  const filteredOrders = orders.filter(order => {
    if (activeFilter === "all") return true;
    return order.status === activeFilter;
  });

  const statusCounts = {
    "all": orders.length,
    "Pending": orders.filter(o => o.status === "Pending").length,
    "Ready for Pickup": orders.filter(o => o.status === "Ready for Pickup").length,
    "Shipped": orders.filter(o => o.status === "Shipped").length,
    "Delivered": orders.filter(o => o.status === "Delivered").length,
    "Cancelled": orders.filter(o => o.status === "Cancelled").length,
  };

  // Shortened status names for better display
  const getShortStatusName = (status) => {
    const shortNames = {
      "all": "All",
      "Pending": "Pending",
      "Ready for Pickup": "Ready",
      "Shipped": "Shipped",
      "Delivered": "Delivered",
      "Cancelled": "Cancelled"
    };
    return shortNames[status] || status;
  };

  // Format date for display
  const formatOrderDate = (dateString) => {
    if (!dateString) return "N/A";
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return "Today";
    } else if (diffDays <= 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  const renderItem = ({ item }) => {
    const buyerId = item.userId || "Unknown User";
    const total = item.total || 0;
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);
    const deliveryAddress = getDeliveryAddress(item);
    const recipientName = item.deliveryInfo?.recipient || "Customer";

    return (
      <View style={styles.card}>
        {/* Order Header */}
        <View style={styles.cardHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>Order #{item.id.slice(-8)}</Text>
            <Text style={styles.orderDate}>
              {formatOrderDate(item.createdAt)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Ionicons name={statusIcon} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.customerSection}>
          <Ionicons name="person-outline" size={16} color="#666" />
          <Text style={styles.customerText}>Buyer ID: {buyerId}</Text>
        </View>

        {/* Items */}
        <View style={styles.itemsSection}>
          <Ionicons name="flower-outline" size={16} color="#666" />
          <Text style={styles.itemsText} numberOfLines={2}>
            {item.items?.map(i => i.name).join(", ") || "No items"}
          </Text>
        </View>

        {/* Delivery Info */}
        <View style={styles.deliverySection}>
          <Ionicons 
            name={item.deliveryType === "pickup" ? "business-outline" : "car-outline"} 
            size={16} 
            color="#666" 
          />
          <Text style={styles.deliveryText}>
            {item.deliveryType === "pickup" 
              ? "📍 Customer Pickup" 
              : `🚚 Delivery to: ${recipientName}`}
          </Text>
        </View>

        {/* Safe Address Display */}
        {item.deliveryType === "delivery" && deliveryAddress && (
          <Text style={styles.addressText}>
            {deliveryAddress}
          </Text>
        )}

        {/* Total Price */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total Amount:</Text>
          <Text style={styles.totalPrice}>₱{total.toFixed(2)}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {item.status === "Pending" && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.primaryBtn]}
              onPress={() =>
                updateOrderStatus(
                  item.id, 
                  item.deliveryType === "pickup" ? "Ready for Pickup" : "Shipped"
                )
              }
            >
              <Ionicons 
                name={item.deliveryType === "pickup" ? "cube-outline" : "car-outline"} 
                size={18} 
                color="#fff" 
              />
              <Text style={styles.actionBtnText}>
                {item.deliveryType === "pickup" ? "Ready for Pickup" : "Mark Shipped"}
              </Text>
            </TouchableOpacity>
          )}

          {item.status === "Shipped" && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.successBtn]}
              onPress={() => updateOrderStatus(item.id, "Delivered")}
            >
              <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Mark Delivered</Text>
            </TouchableOpacity>
          )}

          {item.status === "Ready for Pickup" && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.successBtn]}
              onPress={() => updateOrderStatus(item.id, "Delivered")}
            >
              <Ionicons name="checkmark-done-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Mark Picked Up</Text>
            </TouchableOpacity>
          )}

          {(item.status === "Delivered" || item.status === "Cancelled") && (
            <View style={[styles.statusTag, 
              { backgroundColor: item.status === "Delivered" ? "#4caf5020" : "#f4433620" }
            ]}>
              <Ionicons 
                name={item.status === "Delivered" ? "checkmark-circle" : "close-circle"} 
                size={16} 
                color={item.status === "Delivered" ? "#4caf50" : "#f44336"} 
              />
              <Text style={[
                styles.statusTagText,
                { color: item.status === "Delivered" ? "#4caf50" : "#f44336" }
              ]}>
                {item.status === "Delivered" ? "Order Completed" : "Order Cancelled"}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

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
          <Text style={styles.title}>Your Orders</Text>
          <Text style={styles.subtitle}>{orders.length} total orders</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      {/* Status Filter */}
      <View style={styles.filterWrapper}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterContainer}
        >
          {Object.keys(statusCounts).map(status => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                activeFilter === status && styles.filterChipActive
              ]}
              onPress={() => setActiveFilter(status)}
            >
              <Text style={[
                styles.filterText,
                activeFilter === status && styles.filterTextActive
              ]}>
                {getShortStatusName(status)} ({statusCounts[status]})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={80} color="#ddd" />
          <Text style={styles.emptyTitle}>No orders found</Text>
          <Text style={styles.emptyText}>
            {activeFilter === "all" 
              ? "You don't have any orders yet" 
              : `No ${activeFilter.toLowerCase()} orders`
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
  filterWrapper: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
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
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
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
  customerSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  customerText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  itemsSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 8,
  },
  itemsText: {
    flex: 1,
    fontSize: 14,
    color: "#1a1a1a",
    lineHeight: 20,
  },
  deliverySection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  deliveryText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  addressText: {
    fontSize: 12,
    color: "#888",
    marginLeft: 24,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  totalSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#e91e63",
  },
  actionButtons: {
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryBtn: {
    backgroundColor: "#e91e63",
  },
  successBtn: {
    backgroundColor: "#4caf50",
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  statusTagText: {
    fontWeight: "600",
    fontSize: 14,
  },
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
  },
});