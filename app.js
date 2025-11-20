// Firebase Modular Import URLs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Your Firebase Configuration
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
export const app = initializeApp(firebaseConfig);
export const db  = getDatabase(app);
export const auth = getAuth(app);
