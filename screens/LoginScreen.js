import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator, // 👈 Add this
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false); // 👈 Spinner state

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setLoading(true); // 👈 Start spinner

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const role = docSnap.data().role;

        // Simulate a short delay for better UX
        setTimeout(() => {
          setLoading(false); // 👈 Stop spinner
          if (role === "Admin") navigation.replace("AdminDashboard");
          else if (role === "Seller") navigation.replace("SellerDashboard");
          else navigation.replace("Home");
        }, 500);
      } else {
        setLoading(false);
        Alert.alert("Error", "User data not found!");
      }
    } catch (error) {
      setLoading(false);
      Alert.alert("Login Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      {/* 🌸 Logo */}
      <Image
        source={require("../assets/logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>Login</Text>

      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <View style={styles.passwordContainer}>
        <TextInput
          placeholder="Password"
          style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
          value={password}
          secureTextEntry={!showPassword}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeIcon}
        >
          <Ionicons
            name={showPassword ? "eye-off-outline" : "eye-outline"}
            size={22}
            color="#999"
          />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.btn, loading && { backgroundColor: "#d06a8d" }]}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" /> // 👈 Spinner here
        ) : (
          <Text style={styles.btnText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("Register")}>
        <Text style={styles.link}>Don’t have an account? Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#e91e63",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 25,
    padding: 12,
    marginBottom: 10,
    paddingHorizontal: 20,
    fontSize: 16,
    width: "100%",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 25,
    paddingHorizontal: 10,
    marginBottom: 10,
    width: "100%",
  },
  eyeIcon: {
    padding: 8,
  },
  btn: {
    backgroundColor: "#e91e63",
    padding: 14,
    borderRadius: 25,
    alignItems: "center",
    marginTop: 10,
    width: "100%",
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { textAlign: "center", color: "#e91e63", marginTop: 15 },
});
