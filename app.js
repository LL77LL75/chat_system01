// app.js — final clean version with full cleanup logic

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  update,
  remove,
  onValue
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

import { firebaseConfig } from "./firebase-config.js";

/* =========================
   INIT FIREBASE
========================= */
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
window.db = db;

/* =========================
   USER LOAD / SAVE
========================= */
function loadUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser"));
  } catch {
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem("currentUser", JSON.stringify(user));
}

window.currentUser = loadUser();

/* =========================
   LOGIN
========================= */
window.normalLogin = async (username, password) => {
  const snap = await get(ref(db, "users/" + username));
  if (!snap.exists()) return alert("User not found.");

  const u = snap.val();
  if (u.password !== password) return alert("Wrong password.");

  if (u.banned?.global) return alert("You are banned.");

  // Update lastSeen (important for message cleanup reset)
  await update(ref(db, "users/" + username), {
    lastSeen: Date.now()
  });

  window.currentUser = { username, ...u, lastSeen: Date.now() };
  saveUser(window.currentUser);

  push(ref(db, "logs"), {
    type: "login",
    user: username,
    time: Date.now()
  });

  window.location.href = "dashboard.html";
};

/* =========================
   LOGOUT
========================= */
window.logout = () => {
  if (window.currentUser) {
    push(ref(db, "logs"), {
      type: "logout",
      user: window.currentUser.username,
      time: Date.now()
    });
  }

  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
};

/* =========================
   ROOMS
========================= */
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

/* =========================
   ACCOUNT POPUP
========================= */
window.openAccountPopup = () => {
  document.getElementById("account-popup").style.display = "block";
};

window.closeAccountPopup = () => {
  document.getElementById("account-popup").style.display = "none";
};

/* =========================
   USER LIST PANEL
========================= */
window.openUserList = async () => {
  const panel = document.getElementById("user-list-panel");
  panel.innerHTML = "<h3>Users</h3>";

  const snap = await get(ref(db, "users"));
  snap.forEach(u => {
    const d = u.val();
    const div = document.createElement("div");
    div.textContent = `${u.key} (${d.rank})`;

    if (d.banned?.global) div.style.color = "red";
    else if (d.muted?.global) div.style.color = "orange";

    panel.appendChild(div);
  });

  panel.style.display = "block";
};

window.closeUserList = () => {
  document.getElementById("user-list-panel").style.display = "none";
};

/* =========================
   CLEANUP ENGINE
========================= */
setInterval(async () => {
  const NOW = Date.now();

  const LOG_LIMIT = 15 * 24 * 60 * 60 * 1000;
  const JOIN_LEAVE_LIMIT = 10 * 24 * 60 * 60 * 1000;
  const USER_MSG_LIMIT = 20 * 24 * 60 * 60 * 1000;

  /* ---- LOGS (15 days) ---- */
  const logsSnap = await get(ref(db, "logs"));
  logsSnap?.forEach(l => {
    if (NOW - l.val().time > LOG_LIMIT) {
      remove(ref(db, `logs/${l.key}`));
    }
  });

  /* ---- ROOMS ---- */
  const roomsSnap = await get(ref(db, "rooms"));
  if (!roomsSnap.exists()) return;

  roomsSnap.forEach(roomSnap => {
    const roomId = roomSnap.key;
    const msgs = roomSnap.child("messages");

    msgs.forEach(msgSnap => {
      const m = msgSnap.val();

      // Never delete persistent system messages
      if (m.persist) return;

      // Join / Leave system messages (10 days)
      if (
        m.system &&
        typeof m.text === "string" &&
        (m.text.includes("has joined") || m.text.includes("has left"))
      ) {
        if (NOW - m.time > JOIN_LEAVE_LIMIT) {
          remove(ref(db, `rooms/${roomId}/messages/${msgSnap.key}`));
        }
        return;
      }

      // User messages (20 days, reset on lastSeen)
      if (!m.system) {
        const baseTime = Math.max(m.time || 0, m.lastSeen || 0);
        if (NOW - baseTime > USER_MSG_LIMIT) {
          remove(ref(db, `rooms/${roomId}/messages/${msgSnap.key}`));
        }
      }
    });
  });
}, 60_000);
