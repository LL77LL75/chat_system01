// firebase-config.js — clean version with Auth + role-based custom claims

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

export const firebaseConfig = {
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
export const db = getDatabase(app);
export const auth = getAuth(app);

// Optional: Make auth globally accessible
window.auth = auth;

// Track current user + custom claims (role)
window.currentUser = null;
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const tokenResult = await user.getIdTokenResult();
        window.currentUser = {
            uid: user.uid,
            email: user.email,
            rank: tokenResult.claims.rank || "newbie", // read custom claim "rank"
        };
    } else {
        window.currentUser = null;
    }
});
