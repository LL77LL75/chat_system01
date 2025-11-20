import { db } from './firebase-config.js';
import { ref, get, set, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

// -------------------- Normal Login --------------------
window.normalLogin = async function () {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);
    if (!snap.exists()) return alert("User does not exist.");
    const data = snap.val();
    if (data.password !== password) return alert("Wrong password");
    window.currentUser = { username, ...data };
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
    window.location.href = "dashboard.html";
};

// -------------------- Account Functions --------------------
window._LOGOUT = function() {
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};

window._CHANGE_DISPLAY = async function() {
    const newName = prompt("Enter new display name:", window.currentUser.displayName);
    if (!newName) return;
    const userRef = ref(db, "users/" + window.currentUser.username + "/displayName");
    await set(userRef, newName);
    window.currentUser.displayName = newName;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};

window._CHANGE_PASSWORD = async function() {
    const newPass = prompt("Enter new password:");
    if (!newPass) return;
    const passRef = ref(db, "users/" + window.currentUser.username + "/password");
    await set(passRef, newPass);
    window.currentUser.password = newPass;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};

window._CHANGE_TITLE = async function() {
    const newTitle = prompt("Enter new equipped title:");
    if (!newTitle) return;
    const titleRef = ref(db, "users/" + window.currentUser.username + "/equippedTitle");
    await set(titleRef, newTitle);
    window.currentUser.equippedTitle = newTitle;
    localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};

// -------------------- Create Accounts (Core/Pioneer) --------------------
window._CREATE_USER = async function() {
    const username = prompt("Enter username:");
    const password = prompt("Enter password:");
    if(!username || !password) return;
    const displayName = username;
    const rank = "newbie"; // default
    const userRef = ref(db, "users/" + username);
    const snap = await get(userRef);
    if(snap.exists()) return alert("Username already exists.");
    await set(userRef, {password, displayName, rank, equippedTitle:"none", credits:0});
    alert("Account created successfully.");
};

// -------------------- Room Functions --------------------
window.createRoom = async function(code) {
    if(!code) return;
    const roomRef = ref(db, "rooms/" + code);
    const snap = await get(roomRef);
    if(snap.exists()){ alert("Room exists."); return; }
    await set(roomRef, { createdBy: window.currentUser.username, members:{}, bans:{}, mutes:{} });
    alert("Room created.");
};

window.deleteRoom = async function(code) {
    if(!code) return;
    const roomRef = ref(db, "rooms/" + code);
    await set(roomRef, null);
    alert("Room deleted.");
};

// -------------------- Message Functions --------------------
window.sendMessage = async function() {
    const input = document.getElementById("message-input");
    const msg = input.value.trim();
    if(!msg) return;

    const roomCode = new URLSearchParams(window.location.search).get("room");
    const messagesRef = ref(db, `messages/${roomCode}`);
    await push(messagesRef, {sender: window.currentUser.username, message: msg, timestamp:Date.now()});
    input.value="";
};

// -------------------- Auction --------------------
window.startAuction = async function(title, startBid, timeMinutes){
    if(!title || !startBid || !timeMinutes) return;
    const roomCode = new URLSearchParams(window.location.search).get("room");
    const auctionRef = ref(db, `auctions/${roomCode}`);
    const endTime = Date.now() + parseInt(timeMinutes)*60*1000;
    await set(auctionRef, {title, startBid:parseInt(startBid), highestBid:parseInt(startBid), highestBidder:"", endTime});
    alert("Auction started.");
};

// -------------------- Shop --------------------
window.openShop = async function() {
    alert("Shop open placeholder (buy/sell titles functionality).");
};

// -------------------- Credits System --------------------
const rankCredits = {
    newbie: {gain:1, timeout:15*60*1000, rankUp:30},
    member: {gain:1, timeout:30*60*1000, rankUp:0}, // placeholder
    admin: {gain:1, timeout:2*60*60*1000, rankUp:0},
    high: {gain:1, timeout:5*60*60*1000, rankUp:0},
    core: {gain:1, timeout:0, rankUp:0},
    pioneer: {gain:0, timeout:0, rankUp:0}
};

window.checkCredits = async function() {
    const user = window.currentUser;
    if(!user.rank) return;
    const info = rankCredits[user.rank];
    if(!info) return;
    user.credits = (user.credits||0)+info.gain;
    localStorage.setItem("currentUser", JSON.stringify(user));
    const userRef = ref(db, "users/" + user.username + "/credits");
    await set(userRef, user.credits);
};
setInterval(window.checkCredits, 60000); // every 1 min

