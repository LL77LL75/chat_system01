import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// Persistent dark mode
if(localStorage.getItem("darkMode") === "true") document.body.classList.add("dark");

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
window.logout = () => { localStorage.removeItem("currentUser"); location.href="index.html"; };

// Toggle dark mode
window.toggleDarkMode = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
};

// Load rooms and create buttons
window.loadRooms = () => {
  const list = document.getElementById("room-list");
  if (!list) return;
  onValue(ref(db, "rooms"), snap => {
    list.innerHTML = "";
    snap.forEach(r => {
      const btn = document.createElement("button");
      btn.textContent = r.key;
      btn.onclick = () => loadRoomInfo(r.key);
      list.appendChild(btn);
    });
  });
};

// Room info panel
window.loadRoomInfo = async (room) => {
  const panel = document.getElementById("room-info-panel");
  if(!panel) return;
  panel.innerHTML = `<h3>Room: ${room}</h3>
    <ul id="users-inside"></ul>
    <ul id="users-banned"></ul>
    <ul id="users-muted"></ul>
    <button id="join-room-btn">Join Room</button>`;

  // Users inside
  onValue(ref(db, `roomMembers/${room}`), snap => {
    const ul = document.getElementById("users-inside");
    ul.innerHTML = "<b>Inside:</b>";
    snap.forEach(userSnap => {
      const li = document.createElement("li");
      li.textContent = userSnap.key;
      ul.appendChild(li);
    });
  });

  // Banned users
  onValue(ref(db, `roomBans/${room}`), snap => {
    const ul = document.getElementById("users-banned");
    ul.innerHTML = "<b>Banned:</b>";
    snap.forEach(userSnap => {
      const li = document.createElement("li");
      li.textContent = userSnap.key;
      if(userSnap.val().global) li.style.color="grey";
      ul.appendChild(li);
    });
  });

  // Muted users
  onValue(ref(db, `roomMutes/${room}`), snap => {
    const ul = document.getElementById("users-muted");
    ul.innerHTML = "<b>Muted:</b>";
    snap.forEach(userSnap => {
      const li = document.createElement("li");
      li.textContent = userSnap.key;
      if(userSnap.val().global) li.style.color="grey";
      ul.appendChild(li);
    });
  });

  // Join room
  const joinBtn = document.getElementById("join-room-btn");
  joinBtn.onclick = () => {
    if(!window.currentUser) return alert("Not logged in");
    set(ref(db, `roomMembers/${room}/${window.currentUser.username}`), true);
    push(ref(db, `messages/${room}`), {
      sender: "[SYSTEM]",
      text: `${window.currentUser.username} has joined.`,
      time: Date.now(),
      system: true
    });
    location.href = "chat.html?room=" + room;
  };
};

// Dashboard initialization
window.initDashboard = () => {
  if(!window.currentUser) location.href = "index.html";
  loadRooms();
};
// ... existing code ...

// Add Room button (admin+ only)
window.addRoom = async () => {
  if (!window.currentUser) return alert("Not logged in");
  if (!["admin", "high", "core", "pioneer"].includes(window.currentUser.rank)) return alert("No permission");

  const roomName = prompt("Enter new room name:");
  if (!roomName) return;

  const roomRef = ref(db, `rooms/${roomName}`);
  const snap = await get(roomRef);
  if (snap.exists()) return alert("Room already exists");

  await set(roomRef, { createdBy: window.currentUser.username, createdAt: Date.now() });
  alert(`Room "${roomName}" created!`);
};
