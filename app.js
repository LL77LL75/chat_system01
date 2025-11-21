import { db } from './firebase-config.js';
import { ref, set, get, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

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
// Rooms
// ------------------------
window.createRoom = async function(roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    const snap = await get(roomRef);
    if (snap.exists()) { alert("Room exists"); return; }
    await set(roomRef, { createdBy: window.currentUser.username, members: [] });
};

window.deleteRoom = async function(roomCode) {
    if (!roomCode) return;
    const roomRef = ref(db, "rooms/" + roomCode);
    await remove(roomRef);
};

// ------------------------
// Chat
// ------------------------
window.sendMessage = async function () {
    const input = document.getElementById("message-input");
    const message = input.value.trim();
    if (!message) return;

    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;

    const messagesRef = ref(db, `messages/${roomCode}`);
    await push(messagesRef, { sender: window.currentUser.username, message, timestamp: Date.now() });
    input.value = "";
};

window.loadMessages = function() {
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (!roomCode) return;
    const messagesRef = ref(db, `messages/${roomCode}`);
    onValue(messagesRef, snapshot => {
        const container = document.getElementById("messages");
        container.innerHTML = "";
        snapshot.forEach(child => {
            const msg = child.val();
            const div = document.createElement("div");
            div.textContent = `[${msg.sender}] ${msg.message}`;
            container.appendChild(div);
        });
    });
};

window.leaveRoom = function() { window.location.href = "dashboard.html"; };

// ------------------------
// Auction
// ------------------------
window.startAuction = async function(title, startingBid, durationMinutes) {
    const maxDurations = { newbie: 5, member: 15, admin: 15, high: 15, core: 15, pioneer: 15 };
    const maxDuration = maxDurations[window.currentUser.rank] || 15;
    if (durationMinutes > maxDuration) { alert(`Max auction time: ${maxDuration} min`); return; }

    const auctionRef = push(ref(db, "auctions"));
    await set(auctionRef, {
        title,
        startingBid: Number(startingBid),
        duration: durationMinutes,
        createdBy: window.currentUser.username,
        highestBid: Number(startingBid),
        highestBidder: null,
        timestamp: Date.now()
    });
    alert("Auction started!");
};

window.placeBid = async function(auctionId, bidAmount) {
    const auctionRef = ref(db, "auctions/" + auctionId);
    const snap = await get(auctionRef);
    const auction = snap.val();
    if (bidAmount <= auction.highestBid) { alert("Bid too low"); return; }
    await update(auctionRef, { highestBid: Number(bidAmount), highestBidder: window.currentUser.username });
};

// ------------------------
// Account Management
// ------------------------
window.createUserAccount = async function() {
    if (!["core","pioneer"].includes(window.currentUser.rank)) { alert("No permission"); return; }
    const username = prompt("New username:");
    const password = prompt("Password:");
    if (!username || !password) return;
    await set(ref(db, "users/" + username), { password, rank: "newbie", displayName: username });
    alert("User created!");
};
