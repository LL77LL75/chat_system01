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
// Room Functions
// ------------------------
window.createRoom = async function (roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (snap.exists()) {
        alert("Room already exists. Redirecting...");
        return;
    }
    await set(roomRef, { createdBy: window.currentUser.username, members: {} });
    alert("Room created.");
};

window.deleteRoom = async function (roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    await set(roomRef, null);
    alert("Room deleted.");
};

// ------------------------
// Chat Messages
// ------------------------
window.sendMessage = async function () {
    const input = document.getElementById("message-input");
    const message = input.value.trim();
    if (!message) return;

    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;

    const messagesRef = ref(db, `messages/${roomCode}`);
    await push(messagesRef, {
        sender: window.currentUser.username,
        message: message,
        timestamp: Date.now(),
        reactions: {},
    });
    input.value = "";
};

window.loadMessages = function () {
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;

    const messagesRef = ref(db, `messages/${roomCode}`);
    const messagesContainer = document.getElementById("messages");
    onValue(messagesRef, (snapshot) => {
        messagesContainer.innerHTML = "";
        snapshot.forEach((child) => {
            const msg = child.val();
            const msgDiv = document.createElement("div");
            msgDiv.classList.add("message");
            msgDiv.innerHTML = `<b>${msg.sender}</b>: ${msg.message}`;
            
            // reactions
            const reactionsDiv = document.createElement("div");
            reactionsDiv.classList.add("reactions");
            for (let user in msg.reactions || {}) {
                const r = document.createElement("span");
                r.textContent = `${user}: ${msg.reactions[user]}`;
                reactionsDiv.appendChild(r);
            }
            msgDiv.appendChild(reactionsDiv);
            messagesContainer.appendChild(msgDiv);
        });
    });
};

// ------------------------
// Reactions
// ------------------------
window.addReaction = async function(messageId, reaction) {
    const roomCode = new URLSearchParams(window.location.search).get("room");
    const reactionRef = ref(db, `messages/${roomCode}/${messageId}/reactions/${window.currentUser.username}`);
    await set(reactionRef, reaction);
};

// ------------------------
// Account and Logout
// ------------------------
window.openAccountPopup = function() {
    const popup = document.getElementById("account-popup");
    if (!popup) return;
    popup.style.display = "block";
};

window.closeAccountPopup = function() {
    const popup = document.getElementById("account-popup");
    if (!popup) return;
    popup.style.display = "none";
};

window.logout = function () {
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};

// ------------------------
// Auctions
// ------------------------
window.startAuction = async function(title, startBid, time) {
    const auctionRef = ref(db, `auctions/${title}`);
    await set(auctionRef, { title, startBid, currentBid: startBid, highestBidder: null, endTime: Date.now() + time*60000 });
};

// ------------------------
// Credits System
// ------------------------
window.checkCredits = async function() {
    const usersRef = ref(db, "users");
    const snap = await get(usersRef);
    if (!snap.exists()) return;
    const users = snap.val();

    const now = Date.now();
    for (let uname in users) {
        const user = users[uname];
        if (!user.lastCredit) user.lastCredit = 0;
        const elapsed = now - user.lastCredit;
        let addCredit = 0;
        if (user.rank === "newbie" && elapsed >= 60000) addCredit = 1;
        else if (user.rank === "member" && elapsed >= 300000) addCredit = 1;
        else if (user.rank === "admin" && elapsed >= 900000) addCredit = 1;
        else if (user.rank === "high" && elapsed >= 1200000) addCredit = 1;
        else if (user.rank === "core" && elapsed >= 2700000) addCredit = 1;

        if (addCredit) {
            user.credits = (user.credits || 0) + addCredit;
            user.lastCredit = now;

            // auto-rank promotion
            if (user.rank === "newbie" && user.credits >= 30) user.rank = "member";
            await set(ref(db, "users/" + uname), user);
        }
    }
};

// check credits every minute
setInterval(window.checkCredits, 60000);
