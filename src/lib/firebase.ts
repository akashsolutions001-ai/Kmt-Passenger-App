import { initializeApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: "AIzaSyBncLpnXmd5KIvE8Sq4iKi1ug4bl4hxhqk",
  authDomain: "kmt-tracker-62159.firebaseapp.com",
  databaseURL: "https://kmt-tracker-62159-default-rtdb.firebaseio.com",
  projectId: "kmt-tracker-62159",
  storageBucket: "kmt-tracker-62159.firebasestorage.app",
  messagingSenderId: "1093592499284",
  appId: "1:1093592499284:web:f105d5d3a425aeef9859c1",
  measurementId: "G-4ELB2NRC27",
};

const app = initializeApp(firebaseConfig);

let analytics: Analytics | null = null;
if (!Capacitor.isNativePlatform() && typeof window !== "undefined") {
  try {
    analytics = getAnalytics(app);
  } catch {
    // Analytics unavailable (e.g. unsupported browser)
  }
}

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export { analytics };

export default app;
