import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "./screens/HomeScreen";
import ShopScreen from "./screens/ShopScreen";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import AdminDashboard from "./screens/AdminDashboard";
import SellerDashboard from "./screens/SellerDashboard";
import CartScreen from "./screens/CartScreen"; // ✅ make sure this is imported
import CustomerOrdersScreen from "./screens/CustomerOrdersScreen";
import SellerOrdersScreen from "./screens/SellerOrdersScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ headerShown: false }}
      >
        {/* ✅ Only Stack.Screens here — no other JSX elements */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Shop" component={ShopScreen} />
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
        <Stack.Screen name="SellerDashboard" component={SellerDashboard} />
        <Stack.Screen name="CustomerOrders" component={CustomerOrdersScreen} />
        <Stack.Screen name="SellerOrders" component={SellerOrdersScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
