// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBncLpnXmd5KIvE8Sq4iKi1ug4bl4hxhqk",
  authDomain: "kmt-tracker-62159.firebaseapp.com",
  databaseURL: "https://kmt-tracker-62159-default-rtdb.firebaseio.com",
  projectId: "kmt-tracker-62159",
  storageBucket: "kmt-tracker-62159.firebasestorage.app",
  messagingSenderId: "1093592499284",
  appId: "1:1093592499284:web:f105d5d3a425aeef9859c1",
  measurementId: "G-4ELB2NRC27"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Realtime Database
export const rtdb = getDatabase(app);

// Initialize Auth
export const auth = getAuth(app);

export default app;