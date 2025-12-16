// app.js — patched

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase, ref, get, set, push, update, remove, onValue
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

/* ================= ACCOUNT POPUP (FIXED) ================= */
window.openAccountPopup = () => {
  const popup = document.getElementById("account-popup");
  if (!popup) return; // ✅ prevents crash
  popup.style.display = "block";
};

window.closeAccountPopup = () => {
  const popup = document.getElementById("account-popup");
  if (!popup) return;
  popup.style.display = "none";
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

/* ================= CLEANUP ENGINE ================= */
setInterval(async () => {
  const NOW = Date.now();
  const LOG_LIMIT = 15 * 86400000;
  const JOIN_LEAVE_LIMIT = 10 * 86400000;
  const USER_MSG_LIMIT = 20 * 86400000;

  const logs = await get(ref(db, "logs"));
  logs?.forEach(l => {
    if (NOW - l.val().time > LOG_LIMIT) {
      remove(ref(db, "logs/" + l.key));
    }
  });

  const rooms = await get(ref(db, "rooms"));
  if (!rooms.exists()) return;

  rooms.forEach(room => {
    const roomId = room.key;
    room.child("messages").forEach(msg => {
      const m = msg.val();
      if (m.persist) return;

      if (
        m.system &&
        (m.text?.includes("has joined") || m.text?.includes("has left")) &&
        NOW - m.time > JOIN_LEAVE_LIMIT
      ) {
        remove(ref(db, `rooms/${roomId}/messages/${msg.key}`));
      }

      if (!m.system) {
        const base = Math.max(m.time || 0, m.lastSeen || 0);
        if (NOW - base > USER_MSG_LIMIT) {
          remove(ref(db, `rooms/${roomId}/messages/${msg.key}`));
        }
      }
    });
  });
}, 60000);
