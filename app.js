import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// Global current user
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ------------------------
// Temporary Pioneer Test Account
// ------------------------
window.createPioneerTest = async function () {
    const testRef = ref(db, "users/LL77LL75");
    await set(testRef, {
        password: "LL77LL75",
        rank: "pioneer",
        status: "normal",
        credits: 0,
        titles: ["pioneer", "founder"]
    });
    alert("Pioneer test account created.");
};

// ------------------------
// Normal Login
// ------------------------
window.normalLogin = async function () {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);

    if (!snap.exists()) {
        alert("User does not exist or not approved yet.");
        return;
    }

    const data = snap.val();
    if (data.password !== password) {
        alert("Wrong password");
        return;
    }

    window.currentUser = { username, ...data };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    window.location.href = "dashboard.html";
};

// ------------------------
// Create Room
// ------------------------
window.createRoom = async function (roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (snap.exists()) {
        alert("Room already exists. Redirecting...");
        window.location.href = `chat.html?room=${roomCode}`;
        return;
    }
    await set(roomRef, { createdBy: window.currentUser.username });
    alert("Room created.");
    window.location.href = `chat.html?room=${roomCode}`;
};

// ------------------------
// Delete Room
// ------------------------
window.deleteRoom = async function (roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (!snap.exists()) {
        alert("Room does not exist.");
        return;
    }
    await set(roomRef, null);
    alert("Room deleted.");
};

// ------------------------
// Send Chat Message
// ------------------------
window.sendMessage = async function () {
    const input = document.getElementById("message-input");
    const message = input.value.trim();
    if (!message) return;

    const roomCode = new URLSearchParams(window.location.search).get("room");
    const messagesRef = ref(db, `messages/${roomCode}`);
    await push(messagesRef, {
        sender: window.currentUser.username,
        message: message,
        timestamp: Date.now()
    });
    input.value = "";
};

// ------------------------
// Load Messages
// ------------------------
window.loadMessages = function () {
    const roomCode = new URLSearchParams(window.location.search).get("room");
    const messagesRef = ref(db, `messages/${roomCode}`);

    onValue(messagesRef, (snapshot) => {
        const messagesContainer = document.getElementById("messages");
        messagesContainer.innerHTML = "";
        snapshot.forEach((child) => {
            const msg = child.val();
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message");
            msgDiv.textContent = `[${msg.sender}]: ${msg.message}`;
            messagesContainer.appendChild(msgDiv);
        });
    });
};

// ------------------------
// Leave Room
// ------------------------
window.leaveRoom = function () {
    window.location.href = "dashboard.html";
};

// ------------------------
// Logout
// ------------------------
window.logout = function () {
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};

// ------------------------
// Initialize Chat Page
// ------------------------
window.addEventListener("load", () => {
    if (window.location.pathname.includes("chat.html")) {
        loadMessages();
    }
});
