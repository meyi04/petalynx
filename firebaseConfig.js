import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

// 🔐 Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBCi2VctvWDMg8XHzmIQvC9i4FaaUx3f_Y",
  authDomain: "petalynx-82e4b.firebaseapp.com",
  projectId: "petalynx-82e4b",
  storageBucket: "petalynx-82e4b.firebasestorage.app",
  messagingSenderId: "191824370765",
  appId: "1:191824370765:web:603637e6ff1beea89b1004",
  measurementId: "G-HLV55LRV0R"
};

// ✅ Reuse existing app instead of creating a duplicate
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ✅ Auth persistence for React Native (only initialize once)
let auth;
try {
  auth = getAuth(app);
} catch (e) {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  });
}

export { app, auth };
export const db = getFirestore(app);
