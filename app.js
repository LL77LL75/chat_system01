import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCY5_krGDfHcp4ZmUe5RXo7BaKYUQwAM8E",
  authDomain: "chat-app-6767.firebaseapp.com",
  databaseURL: "https://chat-app-6767-default-rtdb.firebaseio.com",
  projectId: "chat-app-6767",
  storageBucket: "chat-app-6767.appspot.com",
  messagingSenderId: "705833150639",
  appId: "1:705833150639:web:618339099f129a4ccacc5a"
};
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Persistent dark mode
if (localStorage.getItem("darkMode") === "true") document.body.classList.add("dark");

window.toggleDarkMode = function() {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
};

// Login/logout
window.normalLogin = async (username, password) => {
  const snap = await get(ref(db, `users/${username}`));
  if (!snap.exists()) return alert("User not found");
  const u = snap.val();
  if (u.password !== password) return alert("Wrong password");
  window.currentUser = { username, ...u };
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
  location.href = "dashboard.html";
};

window.logout = () => {
  localStorage.removeItem("currentUser");
  location.href = "index.html";
};

// Account popup
window.openAccountPopup = function() {
  const p = document.getElementById("account-popup");
  if (!p || !window.currentUser) return;
  document.getElementById("displayname-input").value = window.currentUser.displayName || "";
  const sel = document.getElementById("title-select");
  sel.innerHTML = "";
  const titles = window.currentUser.titles || {};
  Object.keys(titles).forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
  if (window.currentUser.activeTitle) sel.value = window.currentUser.activeTitle;
  p.style.display = "block";
};

window.closeAccountPopup = function() {
  const p = document.getElementById("account-popup");
  if (p) p.style.display = "none";
};

window.changeDisplayName = async function() {
  const name = document.getElementById("displayname-input").value.trim();
  if (!name || !window.currentUser) return;
  await update(ref(db, `users/${window.currentUser.username}`), { displayName: name });
  window.currentUser.displayName = name;
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};

window.changePassword = async function() {
  const pw = prompt("Enter new password:");
  if (!pw || !window.currentUser) return;
  await update(ref(db, `users/${window.currentUser.username}`), { password: pw });
  window.currentUser.password = pw;
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};

// Rooms
window.loadRooms = function() {
  const list = document.getElementById("room-list");
  if (!list) return;
  onValue(ref(db, "rooms"), snap => {
    list.innerHTML = "";
    snap.forEach(r => {
      const btn = document.createElement("button");
      btn.textContent = r.key;
      btn.onclick = () => window.loadRoomInfo(r.key);
      list.appendChild(btn);
    });
  });
};

// Add Room
window.addRoom = async function() {
  const roomName = prompt("Enter new room name:");
  if (!roomName) return;
  await set(ref(db, `rooms/${roomName}`), { createdAt: Date.now() });
  alert("Room added!");
};

// Load Room Info
window.loadRoomInfo = function(room) {
  const panel = document.getElementById("room-info-panel");
  if (!panel) return;
  panel.innerHTML = `<h3>Room: ${room}</h3><button id="join-room-btn">Join Room</button><ul id="users-inside"></ul><ul id="users-banned"></ul><ul id="users-muted"></ul>`;
  
  // Members
  onValue(ref(db, `roomMembers/${room}`), snap => {
    const ul = document.getElementById("users-inside");
    ul.innerHTML = "";
    snap.forEach(u => { const li = document.createElement("li"); li.textContent = u.key; ul.appendChild(li); });
  });
  
  // Banned
  onValue(ref(db, `roomBans/${room}`), snap => {
    const ul = document.getElementById("users-banned");
    ul.innerHTML = "";
    snap.forEach(u => {
      const li = document.createElement("li");
      li.textContent = u.key;
      if (u.val().global) li.style.color="grey";
      ul.appendChild(li);
    });
  });
  
  // Muted
  onValue(ref(db, `roomMutes/${room}`), snap => {
    const ul = document.getElementById("users-muted");
    ul.innerHTML = "";
    snap.forEach(u => {
      const li = document.createElement("li");
      li.textContent = u.key;
      if (u.val().global) li.style.color="grey";
      ul.appendChild(li);
    });
  });

  document.getElementById("join-room-btn").onclick = function() {
    if (!window.currentUser) return alert("Not logged in");
    const user = window.currentUser.username;
    set(ref(db, `roomMembers/${room}/${user}`), true);
    push(ref(db, `messages/${room}`), { system: true, text:`[SYSTEM] ${user} joined the room.`, time: Date.now() });
    location.href = "chat.html?room=" + room;
  };
};
