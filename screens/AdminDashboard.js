import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "../firebaseConfig";
import { collection, getDocs, deleteDoc, doc, query, where } from "firebase/firestore";
import { signOut } from "firebase/auth";

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;
const isSmallScreen = width < 375;

export default function AdminDashboard({ navigation }) {
  const [users, setUsers] = useState([]);
  const [flowers, setFlowers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [usersSnapshot, flowersSnapshot, ordersSnapshot] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "flowers")),
        getDocs(collection(db, "orders"))
      ]);

      setUsers(usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setFlowers(flowersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setOrders(ordersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      Alert.alert("Error", "Failed to load dashboard data.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this user?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "users", id));
            setUsers(users.filter((u) => u.id !== id));
          } catch (error) {
            Alert.alert("Error", error.message);
          }
        },
      },
    ]);
  };

  const handleDeleteFlower = async (id) => {
    Alert.alert("Confirm Delete", "Are you sure you want to delete this product?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "flowers", id));
            setFlowers(flowers.filter((f) => f.id !== id));
          } catch (error) {
            Alert.alert("Error", error.message);
          }
        },
      },
    ]);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(auth);
            navigation.replace("Login");
          } catch (error) {
            Alert.alert("Logout Error", error.message);
          }
        },
      },
    ]);
  };

  // Dashboard Stats
  const totalUsers = users.length;
  const totalSellers = users.filter((u) => u.role === "Seller").length;
  const totalCustomers = users.filter((u) => u.role === "Customer").length;
  const totalProducts = flowers.length;
  const totalOrders = orders.length;

  const deliveredOrders = orders.filter(order => order.status === "Delivered");
  const totalRevenue = deliveredOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const platformEarnings = totalRevenue * 0.10;

  // Interest Data (Seller Earnings)
  const sellerEarnings = {};
  deliveredOrders.forEach(order => {
    order.items?.forEach(item => {
      if (item.sellerId) {
        const sellerTotal = item.price * (item.quantity || 1);
        if (!sellerEarnings[item.sellerId]) {
          sellerEarnings[item.sellerId] = {
            sellerId: item.sellerId,
            sellerName: item.sellerName || "Unknown Seller",
            totalSales: 0,
            platformShare: 0,
            sellerIncome: 0
          };
        }
        sellerEarnings[item.sellerId].totalSales += sellerTotal;
        sellerEarnings[item.sellerId].platformShare += sellerTotal * 0.10;
        sellerEarnings[item.sellerId].sellerIncome += sellerTotal * 0.90;
      }
    });
  });

  const interestData = Object.values(sellerEarnings);

  // Order statistics by status
  const pendingOrders = orders.filter(order => order.status === "Pending").length;
  const shippedOrders = orders.filter(order => order.status === "Shipped").length;
  const deliveredOrdersCount = deliveredOrders.length;
  const cancelledOrders = orders.filter(order => order.status === "Cancelled").length;

  const renderDashboard = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Stats Overview */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#e3f2fd" }]}>
            <Ionicons name="people" size={isTablet ? 28 : 24} color="#1976d2" />
          </View>
          <Text style={styles.statNumber}>{totalUsers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#f3e5f5" }]}>
            <Ionicons name="storefront" size={isTablet ? 28 : 24} color="#7b1fa2" />
          </View>
          <Text style={styles.statNumber}>{totalSellers}</Text>
          <Text style={styles.statLabel}>Sellers</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#e8f5e8" }]}>
            <Ionicons name="person" size={isTablet ? 28 : 24} color="#388e3c" />
          </View>
          <Text style={styles.statNumber}>{totalCustomers}</Text>
          <Text style={styles.statLabel}>Customers</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#fff3e0" }]}>
            <Ionicons name="flower" size={isTablet ? 28 : 24} color="#f57c00" />
          </View>
          <Text style={styles.statNumber}>{totalProducts}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#e0f2f1" }]}>
            <Ionicons name="receipt" size={isTablet ? 28 : 24} color="#00796b" />
          </View>
          <Text style={styles.statNumber}>{totalOrders}</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: "#fce4ec" }]}>
            <Ionicons name="trending-up" size={isTablet ? 28 : 24} color="#e91e63" />
          </View>
          <Text style={styles.statNumber}>₱{platformEarnings.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Platform Earnings</Text>
        </View>
      </View>

      {/* Order Status Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Status Breakdown</Text>
        <View style={styles.orderStatsGrid}>
          <View style={[styles.orderStatCard, { borderLeftColor: "#ff9800" }]}>
            <Text style={styles.orderStatNumber}>{pendingOrders}</Text>
            <Text style={styles.orderStatLabel}>Pending</Text>
          </View>
          <View style={[styles.orderStatCard, { borderLeftColor: "#2196f3" }]}>
            <Text style={styles.orderStatNumber}>{shippedOrders}</Text>
            <Text style={styles.orderStatLabel}>Shipped</Text>
          </View>
          <View style={[styles.orderStatCard, { borderLeftColor: "#4caf50" }]}>
            <Text style={styles.orderStatNumber}>{deliveredOrdersCount}</Text>
            <Text style={styles.orderStatLabel}>Delivered</Text>
          </View>
          <View style={[styles.orderStatCard, { borderLeftColor: "#f44336" }]}>
            <Text style={styles.orderStatNumber}>{cancelledOrders}</Text>
            <Text style={styles.orderStatLabel}>Cancelled</Text>
          </View>
        </View>
      </View>

      {/* Revenue Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Revenue Summary</Text>
        <View style={styles.revenueCard}>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>Total Sales (Delivered Orders):</Text>
            <Text style={styles.revenueValue}>₱{totalRevenue.toFixed(2)}</Text>
          </View>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>Platform Earnings (10%):</Text>
            <Text style={styles.platformRevenue}>₱{platformEarnings.toFixed(2)}</Text>
          </View>
          <View style={styles.revenueItem}>
            <Text style={styles.revenueLabel}>Seller Payouts (90%):</Text>
            <Text style={styles.sellerRevenue}>₱{(totalRevenue - platformEarnings).toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setActiveTab("orders")}
          >
            <Ionicons name="list" size={isTablet ? 36 : 32} color="#e91e63" />
            <Text style={styles.actionText}>View Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setActiveTab("interest")}
          >
            <Ionicons name="analytics" size={isTablet ? 36 : 32} color="#e91e63" />
            <Text style={styles.actionText}>Revenue Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setActiveTab("users")}
          >
            <Ionicons name="people" size={isTablet ? 36 : 32} color="#e91e63" />
            <Text style={styles.actionText}>Manage Users</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => setActiveTab("products")}
          >
            <Ionicons name="flower" size={isTablet ? 36 : 32} color="#e91e63" />
            <Text style={styles.actionText}>Manage Products</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderUsers = () => (
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>User Management ({totalUsers})</Text>
      {users.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={isTablet ? 80 : 60} color="#ddd" />
          <Text style={styles.emptyText}>No users found</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userEmail}>{item.email}</Text>
                <Text style={styles.userRole}>{item.role}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteUser(item.id)}
              >
                <Ionicons name="trash-outline" size={isTablet ? 24 : 20} color="#ff4757" />
              </TouchableOpacity>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderProducts = () => (
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>Product Management ({totalProducts})</Text>
      {flowers.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="flower-outline" size={isTablet ? 80 : 60} color="#ddd" />
          <Text style={styles.emptyText}>No products found</Text>
        </View>
      ) : (
        <FlatList
          data={flowers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listCard}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>₱{item.price}</Text>
                <Text style={styles.productSeller}>Seller: {item.sellerName || 'Unknown'}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteFlower(item.id)}
              >
                <Ionicons name="trash-outline" size={isTablet ? 24 : 20} color="#ff4757" />
              </TouchableOpacity>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderOrders = () => (
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>All Orders ({orders.length})</Text>
      {orders.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={isTablet ? 80 : 60} color="#ddd" />
          <Text style={styles.emptyText}>No orders found</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>Order #{item.id.slice(-8)}</Text>
                <View style={[styles.statusBadge,
                {
                  backgroundColor:
                    item.status === 'Delivered' ? '#e8f5e8' :
                      item.status === 'Cancelled' ? '#ffebee' :
                        item.status === 'Shipped' ? '#e3f2fd' : '#fff3e0'
                }
                ]}>
                  <Text style={[
                    styles.statusText,
                    {
                      color:
                        item.status === 'Delivered' ? '#4caf50' :
                          item.status === 'Cancelled' ? '#f44336' :
                            item.status === 'Shipped' ? '#2196f3' : '#ff9800'
                    }
                  ]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.orderTotal}>Total: ₱{item.total?.toFixed(2)}</Text>
              <Text style={styles.orderItems}>
                Items: {item.items?.map(i => i.name).join(', ')}
              </Text>
              <Text style={styles.orderDate}>
                {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderInterest = () => (
    <View style={styles.content}>
      <Text style={styles.sectionTitle}>Revenue Report (10% Platform Fee)</Text>

      {/* Revenue Summary Card */}
      <View style={styles.revenueSummaryCard}>
        <Text style={styles.revenueSummaryTitle}>Platform Earnings Summary</Text>
        <View style={styles.revenueSummaryItem}>
          <Text style={styles.revenueSummaryLabel}>Total Delivered Orders:</Text>
          <Text style={styles.revenueSummaryValue}>{deliveredOrdersCount}</Text>
        </View>
        <View style={styles.revenueSummaryItem}>
          <Text style={styles.revenueSummaryLabel}>Total Sales Revenue:</Text>
          <Text style={styles.revenueSummaryValue}>₱{totalRevenue.toFixed(2)}</Text>
        </View>
        <View style={styles.revenueSummaryItem}>
          <Text style={styles.revenueSummaryLabel}>Platform Earnings (10%):</Text>
          <Text style={styles.platformSummaryValue}>₱{platformEarnings.toFixed(2)}</Text>
        </View>
        <View style={styles.revenueSummaryItem}>
          <Text style={styles.revenueSummaryLabel}>Total Seller Payouts:</Text>
          <Text style={styles.sellerSummaryValue}>₱{(totalRevenue - platformEarnings).toFixed(2)}</Text>
        </View>
      </View>

      <Text style={styles.subSectionTitle}>Seller Earnings Breakdown</Text>
      {interestData.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={isTablet ? 80 : 60} color="#ddd" />
          <Text style={styles.emptyText}>No sales data from delivered orders</Text>
          <Text style={styles.emptySubtext}>Earnings are calculated only from delivered orders</Text>
        </View>
      ) : (
        <FlatList
          data={interestData}
          keyExtractor={(item) => item.sellerId}
          renderItem={({ item }) => (
            <View style={styles.interestCard}>
              <Text style={styles.sellerName}>{item.sellerName}</Text>
              <View style={styles.earningRow}>
                <Text style={styles.earningLabel}>Total Sales:</Text>
                <Text style={styles.earningValue}>₱{item.totalSales.toFixed(2)}</Text>
              </View>
              <View style={styles.earningRow}>
                <Text style={styles.earningLabel}>Platform Share (10%):</Text>
                <Text style={styles.platformEarning}>₱{item.platformShare.toFixed(2)}</Text>
              </View>
              <View style={styles.earningRow}>
                <Text style={styles.earningLabel}>Seller Income (90%):</Text>
                <Text style={styles.sellerEarning}>₱{item.sellerIncome.toFixed(2)}</Text>
              </View>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e91e63" />
        <Text style={styles.loadingText}>Loading Admin Dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Admin Dashboard</Text>
          <Text style={styles.subtitle}>Manage your platform</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={isTablet ? 26 : 22} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Navigation Tabs */}
      {/* Navigation Tabs - Compact Version */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "dashboard" && styles.activeTab]}
            onPress={() => setActiveTab("dashboard")}
          >
            <Ionicons
              name="grid"
              size={18}
              color={activeTab === "dashboard" ? "#e91e63" : "#666"}
            />
            <Text style={[styles.tabText, activeTab === "dashboard" && styles.activeTabText]}>
              Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "orders" && styles.activeTab]}
            onPress={() => setActiveTab("orders")}
          >
            <Ionicons
              name="receipt"
              size={18}
              color={activeTab === "orders" ? "#e91e63" : "#666"}
            />
            <Text style={[styles.tabText, activeTab === "orders" && styles.activeTabText]}>
              Orders ({totalOrders})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "interest" && styles.activeTab]}
            onPress={() => setActiveTab("interest")}
          >
            <Ionicons
              name="trending-up"
              size={18}
              color={activeTab === "interest" ? "#e91e63" : "#666"}
            />
            <Text style={[styles.tabText, activeTab === "interest" && styles.activeTabText]}>
              Revenue
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "users" && styles.activeTab]}
            onPress={() => setActiveTab("users")}
          >
            <Ionicons
              name="people"
              size={18}
              color={activeTab === "users" ? "#e91e63" : "#666"}
            />
            <Text style={[styles.tabText, activeTab === "users" && styles.activeTabText]}>
              Users ({totalUsers})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === "products" && styles.activeTab]}
            onPress={() => setActiveTab("products")}
          >
            <Ionicons
              name="flower"
              size={18}
              color={activeTab === "products" ? "#e91e63" : "#666"}
            />
            <Text style={[styles.tabText, activeTab === "products" && styles.activeTabText]}>
              Products ({totalProducts})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      {/* Main Content */}
      {activeTab === "dashboard" && renderDashboard()}
      {activeTab === "users" && renderUsers()}
      {activeTab === "products" && renderProducts()}
      {activeTab === "orders" && renderOrders()}
      {activeTab === "interest" && renderInterest()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa"
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 16,
    fontSize: isTablet ? 18 : 16,
    color: "#666",
    fontWeight: "500",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: isTablet ? 30 : 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: isTablet ? 28 : 24,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: isTablet ? 16 : 14,
    color: "#666",
    marginTop: 2,
  },
  logoutButton: {
    width: isTablet ? 50 : 44,
    height: isTablet ? 50 : 44,
    borderRadius: isTablet ? 25 : 22,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  // Tabs
  tabContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: isTablet ? 30 : 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: isTablet ? 20 : 16,
    paddingVertical: isTablet ? 12 : 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: "#f5f5f5",
    gap: 6,
  },
  activeTab: {
    backgroundColor: "#e91e63",
  },
  tabText: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "600",
    color: "#666",
  },
  activeTabText: {
    color: "#fff",
  },
  // Content
  content: {
    flex: 1,
    padding: isTablet ? 30 : 20,
  },
  // Dashboard Stats
  statsGrid: {
    flexDirection: isTablet ? "row" : "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    width: isTablet ? "31%" : "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: isTablet ? 20 : 16,
    marginBottom: isTablet ? 16 : 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  statIcon: {
    width: isTablet ? 56 : 48,
    height: isTablet ? 56 : 48,
    borderRadius: isTablet ? 28 : 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statNumber: {
    fontSize: isTablet ? 24 : 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: isTablet ? 14 : 12,
    color: "#666",
    textAlign: "center",
  },
  // Order Status Breakdown
  orderStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderStatCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  orderStatNumber: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  orderStatLabel: {
    fontSize: isTablet ? 14 : 12,
    color: "#666",
    textAlign: "center",
  },
  // Revenue Card
  revenueCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: isTablet ? 24 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  revenueItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  revenueLabel: {
    fontSize: isTablet ? 16 : 14,
    color: "#666",
  },
  revenueValue: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  platformRevenue: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: "600",
    color: "#e91e63",
  },
  sellerRevenue: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: "600",
    color: "#4caf50",
  },
  // Revenue Summary Card
  revenueSummaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: isTablet ? 24 : 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  revenueSummaryTitle: {
    fontSize: isTablet ? 20 : 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 16,
    textAlign: "center",
  },
  revenueSummaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  revenueSummaryLabel: {
    fontSize: isTablet ? 16 : 14,
    color: "#666",
  },
  revenueSummaryValue: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  platformSummaryValue: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "600",
    color: "#e91e63",
  },
  sellerSummaryValue: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "600",
    color: "#4caf50",
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: isTablet ? 22 : 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 16,
  },
  subSectionTitle: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
    marginTop: 20,
  },
  // Actions Grid
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  actionCard: {
    width: isTablet ? "48%" : "48%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: isTablet ? 24 : 20,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  actionText: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginTop: 8,
    textAlign: "center",
  },
  // List Cards
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  userRole: {
    fontSize: isTablet ? 16 : 14,
    color: "#666",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  productPrice: {
    fontSize: isTablet ? 16 : 14,
    color: "#e91e63",
    fontWeight: "600",
  },
  productSeller: {
    fontSize: isTablet ? 14 : 12,
    color: "#666",
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  // Orders
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orderId: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  statusBadge: {
    paddingHorizontal: isTablet ? 12 : 8,
    paddingVertical: isTablet ? 6 : 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: isTablet ? 14 : 12,
    fontWeight: "600",
  },
  orderTotal: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "600",
    color: "#e91e63",
    marginBottom: 4,
  },
  orderItems: {
    fontSize: isTablet ? 16 : 14,
    color: "#666",
    marginBottom: 4,
  },
  orderDate: {
    fontSize: isTablet ? 14 : 12,
    color: "#999",
  },
  // Interest/Revenue
  interestCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: isTablet ? 20 : 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  sellerName: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  earningRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  earningLabel: {
    fontSize: isTablet ? 16 : 14,
    color: "#666",
  },
  earningValue: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  platformEarning: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "600",
    color: "#e91e63",
  },
  sellerEarning: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: "600",
    color: "#4caf50",
  },
  // Empty States
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: isTablet ? 18 : 16,
    color: "#999",
    marginTop: 12,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: isTablet ? 16 : 14,
    color: "#999",
    marginTop: 8,
    textAlign: "center",
    fontStyle: 'italic',
  },
});