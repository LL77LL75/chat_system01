import { db } from './firebase-config.js';
import { ref, get, set, push, onValue, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// Global user
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ------------------------
// Login
// ------------------------
window.normalLogin = async function () {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);

    if (!snap.exists()) return alert("User does not exist.");
    const data = snap.val();
    if (data.password !== password) return alert("Wrong password.");

    // Set current user
    window.currentUser = { username, displayName: data.displayName || username, ...data };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
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
// Rooms
// ------------------------
window.createRoom = async function (roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (snap.exists()) {
        alert("Room exists. Redirecting...");
        window.location.href = `chat.html?room=${roomCode}`;
        return;
    }
    await set(roomRef, { createdBy: window.currentUser.username });
    alert("Room created.");
    window.location.href = `chat.html?room=${roomCode}`;
};

window.deleteRoom = async function (roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (!snap.exists()) return alert("Room does not exist.");
    await set(roomRef, null);
    alert("Room deleted.");
};

// ------------------------
// Send Message
// ------------------------
window.sendMessage = async function () {
    const input = document.getElementById("message-input");
    const message = input.value.trim();
    if (!message) return;

    // Ensure user is logged in
    if (!window.currentUser || !window.currentUser.username) {
        return alert("Error: User not logged in.");
    }

    // Ensure room exists
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return alert("Error: No room selected.");

    const messagesRef = ref(db, `messages/${roomCode}`);
    await push(messagesRef, {
        sender: window.currentUser.username,
        displayName: window.currentUser.displayName || window.currentUser.username,
        message: message,
        timestamp: Date.now(),
        type: "normal",
        reactions: {}
    });
    input.value = "";
};

// ------------------------
// Load Messages
// ------------------------
window.loadMessages = function () {
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;

    const messagesRef = ref(db, `messages/${roomCode}`);
    const messagesContainer = document.getElementById("messages");

    onValue(messagesRef, (snapshot) => {
        messagesContainer.innerHTML = "";
        snapshot.forEach(child => {
            const msg = child.val();
            const div = document.createElement("div");
            div.classList.add("message");
            div.textContent = `[${msg.displayName}]: ${msg.message}`;
            messagesContainer.appendChild(div);

            // Reactions
            if (msg.reactions) {
                for (const [emoji, users] of Object.entries(msg.reactions)) {
                    const reactionDiv = document.createElement("div");
                    reactionDiv.classList.add("reaction");
                    reactionDiv.textContent = `${emoji} (${users.length})`;
                    messagesContainer.appendChild(reactionDiv);
                }
            }
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
// Initialize Chat Page
// ------------------------
window.addEventListener("load", () => {
    if (window.location.pathname.includes("chat.html")) {
        loadMessages();
    }
});
