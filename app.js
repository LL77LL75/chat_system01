import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase, ref, get, push, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
window.db = db;

/* ================= USER LOAD ================= */
function loadUser() {
  try { return JSON.parse(localStorage.getItem("currentUser")); }
  catch { return null; }
}
function saveUser(u) {
  localStorage.setItem("currentUser", JSON.stringify(u));
}
window.currentUser = loadUser();

/* ================= LOGIN ================= */
window.normalLogin = async (username, password) => {
  const snap = await get(ref(db, "users/" + username));
  if (!snap.exists()) return alert("User not found.");

  const u = snap.val();
  if (u.password !== password) return alert("Wrong password.");
  if (u.banned?.global) return alert("You are banned.");

  await update(ref(db, "users/" + username), { lastSeen: Date.now() });

  window.currentUser = { username, ...u };
  saveUser(window.currentUser);

  push(ref(db, "logs"), { type: "login", user: username, time: Date.now() });
  location.href = "dashboard.html";
};

/* ================= LOGOUT ================= */
window.logout = () => {
  if (window.currentUser) {
    push(ref(db, "logs"), {
      type: "logout",
      user: window.currentUser.username,
      time: Date.now()
    });
  }
  localStorage.removeItem("currentUser");
  location.href = "index.html";
};

/* ================= ROOMS ================= */
window.loadRooms = () => {
  const list = document.getElementById("room-list");
  if (!list) return;

  onValue(ref(db, "rooms"), snap => {
    list.innerHTML = "";
    snap.forEach(r => {
      const btn = document.createElement("button");
      btn.className = "room-btn";
      btn.textContent = r.key;
      btn.onclick = () => loadRoomInfo(r.key);
      list.appendChild(btn);
    });
  });
};

window.loadRoomInfo = room => {
  const panel = document.getElementById("room-info-panel");
  if (!panel) return;

  panel.innerHTML = `
    <h3>Room: ${room}</h3>
    <button onclick="joinRoom('${room}')">Join Room</button>
  `;
};

window.joinRoom = room => {
  if (window.currentUser?.banned?.global) {
    alert("You are banned.");
    return;
  }
  window.location.href = `chat.html?room=${room}`;
};

/* ================= ACCOUNT ================= */
window.openAccountPopup = () => {
  const popup = document.getElementById("account-popup");
  if (popup) popup.style.display = "block";
};

window.closeAccountPopup = () => {
  const popup = document.getElementById("account-popup");
  if (popup) popup.style.display = "none";
};

/* ================= USER LIST ================= */
window.openUserList = async () => {
  const panel = document.getElementById("user-list-panel");
  if (!panel) return;

  panel.innerHTML = "<h3>Users</h3>";

  const snap = await get(ref(db, "users"));
  snap.forEach(u => {
    const d = u.val();
    const div = document.createElement("div");
    div.textContent = `${u.key} (${d.rank})`;

    if (d.banned?.global) div.style.color = "red";
    else if (d.muted?.global) div.style.color = "gold";

    panel.appendChild(div);
  });

  panel.style.display = "block";
};

window.closeUserList = () => {
  const panel = document.getElementById("user-list-panel");
  if (panel) panel.style.display = "none";
};
