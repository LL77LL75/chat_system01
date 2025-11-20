// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCY5_krGDfHcp4ZmUe5RXo7BaKYUQwAM8E",
  authDomain: "chat-app-6767.firebaseapp.com",
  databaseURL: "https://chat-app-6767-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-app-6767",
  storageBucket: "chat-app-6767.firebasestorage.app",
  messagingSenderId: "705833150639",
  appId: "1:705833150639:web:618339099f129a4ccacc5a",
  measurementId: "G-3P9WH9S08E"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
getAnalytics(app);

// Export database for modules
export const db = getDatabase(app);
const analytics = getAnalytics(app); // Comment this out if analytics not required
