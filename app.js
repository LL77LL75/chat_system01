import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// Global current user
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// ------------------------
// Normal Login
// ------------------------
window.normalLogin = async function () {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();

    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);

    if (!snap.exists()) { alert("User does not exist."); return; }

    const data = snap.val();
    if (data.password !== password) { alert("Wrong password"); return; }

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
    if (snap.exists()) { alert("Room already exists. Redirecting..."); return; }
    await set(roomRef, { createdBy: window.currentUser.username, members: [] });
    alert("Room created.");
};

// ------------------------
// Delete Room
// ------------------------
window.deleteRoom = async function (roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (!snap.exists()) { alert("Room does not exist."); return; }
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
        displayName: window.currentUser.displayName || window.currentUser.username,
        message,
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
            msgDiv.innerHTML = `<b>${msg.displayName}:</b> ${msg.message} <small>[${new Date(msg.timestamp).toLocaleTimeString()}]</small>`;
            messagesContainer.appendChild(msgDiv);
        });
    });
};

// ------------------------
// Account Popup Functions
// ------------------------
window.openAccountPopup = function() {
    document.getElementById("account-popup").style.display = "block";
    const select = document.getElementById("title-select");
    select.innerHTML = "";
    const titles = window.currentUser.titles || [];
    titles.forEach(t => {
        const option = document.createElement("option");
        option.value = t;
        option.textContent = t;
        if (t === window.currentUser.equippedTitle) option.selected = true;
        select.appendChild(option);
    });
    document.getElementById("display-name-input").value = window.currentUser.displayName || "";
};

window.closeAccountPopup = function() {
    document.getElementById("account-popup").style.display = "none";
};

window.changeDisplayName = async function() {
    const newName = document.getElementById("display-name-input").value.trim();
    if (!newName) return alert("Display name cannot be empty.");
    window.currentUser.displayName = newName;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    const userRef = ref(db, "users/" + window.currentUser.username);
    await update(userRef, { displayName: newName });
    alert("Display name updated.");
};

window.changePassword = async function() {
    const newPass = document.getElementById("password-input").value.trim();
    if (!newPass) return alert("Password cannot be empty.");
    window.currentUser.password = newPass;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    const userRef = ref(db, "users/" + window.currentUser.username);
    await update(userRef, { password: newPass });
    alert("Password updated.");
};

window.changeTitle = async function() {
    const newTitle = document.getElementById("title-select").value;
    window.currentUser.equippedTitle = newTitle;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    const userRef = ref(db, "users/" + window.currentUser.username);
    await update(userRef, { equippedTitle: newTitle });
    alert("Title updated.");
};

window.logout = function () {
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};
