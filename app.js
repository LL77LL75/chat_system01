import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getDatabase, ref, get, set, push, onValue, remove, update
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

/* 🔥 FIREBASE (REGION FIXED) */
const firebaseConfig = {
  apiKey: "AIzaSyCY5_krGDfHcp4ZmUe5RXo7BaKYUQwAM8E",
  authDomain: "chat-app-6767.firebaseapp.com",
  databaseURL: "https://chat-app-6767-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chat-app-6767",
  storageBucket: "chat-app-6767.appspot.com",
  messagingSenderId: "705833150639",
  appId: "1:705833150639:web:618339099f129a4ccacc5a"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

/* 🔐 USER STATE */
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

/* 🌙 DARK MODE (PERSISTENT) */
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark");
}

window.toggleDarkMode = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
};

/* 🔑 LOGIN */
window.normalLogin = async (username, password) => {
  const snap = await get(ref(db, `users/${username}`));
  if (!snap.exists()) return alert("User not found");

  const user = snap.val();
  if (user.password !== password) return alert("Wrong password");

  window.currentUser = { username, ...user };
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
  location.href = "dashboard.html";
};

/* 🚪 LOGOUT */
window.logout = () => {
  localStorage.clear();
  location.href = "index.html";
};

/* 👤 ACCOUNT POPUP */
window.openAccountPopup = () =>
  document.getElementById("account-popup").style.display = "block";

window.closeAccountPopup = () =>
  document.getElementById("account-popup").style.display = "none";

window.changeDisplayName = async () => {
  const name = document.getElementById("displayname-input").value.trim();
  if (!name) return;
  await update(ref(db, `users/${currentUser.username}`), { displayName: name });
  currentUser.displayName = name;
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
};

/* 🏠 ROOMS */
window.loadRooms = () => {
  const list = document.getElementById("room-list");
  if (!list) return;

  onValue(ref(db, "rooms"), snap => {
    list.innerHTML = "";
    snap.forEach(r => {
      const b = document.createElement("button");
      b.textContent = r.key;
      b.onclick = () => window.loadRoomInfo(r.key);
      list.appendChild(b);
    });
  });
};

window.addRoom = async () => {
  const name = prompt("Room name?");
  if (!name) return;
  await set(ref(db, `rooms/${name}`), { created: Date.now() });
};

/* ℹ️ ROOM INFO PANEL */
window.loadRoomInfo = room => {
  const p = document.getElementById("room-info-panel");
  p.innerHTML = `
    <h3>${room}</h3>
    <button onclick="joinRoom('${room}')">Join</button>
    <h4>Inside</h4><ul id="inside"></ul>
    <h4>Banned</h4><ul id="banned"></ul>
    <h4>Muted</h4><ul id="muted"></ul>
  `;

  onValue(ref(db, `roomMembers/${room}`), s => {
    const ul = document.getElementById("inside");
    ul.innerHTML = "";
    s.forEach(u => ul.innerHTML += `<li>${u.key}</li>`);
  });
};

window.joinRoom = room => {
  set(ref(db, `roomMembers/${room}/${currentUser.username}`), true);
  push(ref(db, `messages/${room}`), {
    system: true,
    text: `[SYSTEM] ${currentUser.username} joined`,
    time: Date.now()
  });
  location.href = `chat.html?room=${room}`;
};
