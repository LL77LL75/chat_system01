// app.js
import { db } from './firebase-config.js';
import { ref, get, set, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js';

// -----------------------
// Current User
// -----------------------
window.currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

// -----------------------
// Login
// -----------------------
window.normalLogin = async function() {
  const u = document.getElementById('login-username').value.trim();
  const p = document.getElementById('login-password').value.trim();
  if (!u || !p) return alert("Enter username and password.");

  const userSnap = await get(ref(db, 'users/' + u));
  if (!userSnap.exists()) return alert("User not found.");
  const data = userSnap.val();
  if (data.password !== p) return alert("Wrong password.");

  window.currentUser = { username: u, ...data };
  localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
  window.location.href = "dashboard.html";
};

// -----------------------
// Logout
// -----------------------
window._LOGOUT = function() {
  localStorage.removeItem('currentUser');
  window.location.href = "index.html";
};

// -----------------------
// Change display name
// -----------------------
window._CHANGE_DISPLAY = async function(newDisplay) {
  if (!newDisplay) return;
  const username = window.currentUser.username;
  await update(ref(db, 'users/' + username), { displayName: newDisplay });
  window.currentUser.displayName = newDisplay;
  localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
  alert("Display name updated!");
};

// -----------------------
// Change password
// -----------------------
window._CHANGE_PASSWORD = async function(newPass) {
  if (!newPass) return;
  const username = window.currentUser.username;
  await update(ref(db, 'users/' + username), { password: newPass });
  window.currentUser.password = newPass;
  localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
  alert("Password updated!");
};

// -----------------------
// Change equipped title
// -----------------------
window._CHANGE_TITLE = async function(title) {
  if (!title) return;
  const username = window.currentUser.username;
  await update(ref(db, 'users/' + username), { equippedTitle: title });
  window.currentUser.equippedTitle = title;
  localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
  alert("Title changed!");
};

// -----------------------
// Create Room
// -----------------------
window.createRoom = async function(code) {
  if (!code) return;
  const roomRef = ref(db, 'rooms/' + code);
  const snap = await get(roomRef);
  if (snap.exists()) {
    alert("Room exists, redirecting to chat.");
    window.location.href = `chat.html?room=${code}`;
    return;
  }
  await set(roomRef, { createdBy: window.currentUser.username, members: {}, bans: {}, mutes: {} });
  alert("Room created!");
  window.location.href = `chat.html?room=${code}`;
};

// -----------------------
// Delete Room
// -----------------------
window.deleteRoom = async function(code) {
  if (!code) return;
  const roomRef = ref(db, 'rooms/' + code);
  const snap = await get(roomRef);
  if (!snap.exists()) return alert("Room does not exist.");
  await remove(roomRef);
  alert("Room deleted!");
};

// -----------------------
// Start Auction
// -----------------------
window.startAuction = async function(title, bid, mins) {
  const roomCode = new URLSearchParams(window.location.search).get("room") || "global";
  const auctionRef = ref(db, `auctions/${roomCode}`);
  await push(auctionRef, {
    title, startingBid: parseFloat(bid), durationMinutes: parseInt(mins), startedBy: window.currentUser.username,
    timestamp: Date.now()
  });
  alert("Auction started!");
};

// -----------------------
// Open Shop placeholder
// -----------------------
window.openShop = function() {
  alert("Shop opens! (This should be implemented in chat.js/app.js fully.)");
};
