import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// Global current user
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ------------------------
// Normal Login Function
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
// Account Popup
// ------------------------
window.openAccountPopup = function() {
    const displayName = prompt("Change Display Name (current: " + (window.currentUser.displayName || "") + ")");
    if(displayName) {
        window.currentUser.displayName = displayName;
        localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
        alert("Display name updated!");
    }
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
        return;
    }
    await set(roomRef, { createdBy: window.currentUser.username });
    alert("Room created.");
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
// Load Rooms List
// ------------------------
window.loadRooms = async function() {
    const roomsRef = ref(db, "rooms");
    const snap = await get(roomsRef);
    const container = document.getElementById("room-list");
    container.innerHTML = ""; // clear previous

    if (!snap.exists()) return;

    snap.forEach(roomSnap => {
        const roomCode = roomSnap.key;
        const btn = document.createElement("button");
        btn.textContent = roomCode;
        btn.style.marginRight = "5px";
        btn.onclick = () => {
            alert("Room: " + roomCode);
            // TODO: Show members panel
        };
        container.appendChild(btn);
    });
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
        if (!messagesContainer) return; // Safety check
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
// Initialize pages
// ------------------------
window.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("dashboard.html")) {
        loadRooms();
    }
    if (window.location.pathname.includes("chat.html")) {
        loadMessages();
    }
});
