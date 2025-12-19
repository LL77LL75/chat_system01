// app.js — SAFE GLOBAL CONTROLLER (NULL-SAFE, NO DUPLICATE EXPORTS)

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  onValue,
  update,
  remove,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

import { firebaseConfig } from "./firebase-config.js";

/* ============================================================
   INIT
============================================================ */
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
export { db };

/* ============================================================
   SAFE DOM HELPER
============================================================ */
function $(id) {
  return document.getElementById(id);
}

/* ============================================================
   USER LOAD / SAVE
============================================================ */
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

let currentUser = loadUser();
window.currentUser = currentUser;

/* ============================================================
   LOGIN
============================================================ */
window.normalLogin = async function (username, password) {
  const snap = await get(ref(db, "users/" + username));
  if (!snap.exists()) return alert("User not found");

  const data = snap.val();
  if (data.password !== password) return alert("Wrong password");

  currentUser = { username, ...data };
  window.currentUser = currentUser;
  saveUser(currentUser);

  // Presence (online)
  const pRef = ref(db, "presence/" + username);
  await set(pRef, { online: true, time: Date.now() });
  onDisconnect(pRef).remove();

  push(ref(db, "logs"), {
    type: "login",
    user: username,
    time: Date.now()
  });

  window.location.href = "dashboard.html";
};

/* ============================================================
   LOGOUT
============================================================ */
window.logout = async function () {
  if (currentUser) {
    await remove(ref(db, "presence/" + currentUser.username));
    push(ref(db, "logs"), {
      type: "logout",
      user: currentUser.username,
      time: Date.now()
    });
  }
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
};

/* ============================================================
   ROOMS LIST (DASHBOARD ONLY)
============================================================ */
window.loadRooms = function () {
  const list = $("room-list");
  if (!list) return;

  onValue(ref(db, "rooms"), snap => {
    if (!list) return;
    list.innerHTML = "";

    snap.forEach(r => {
      const btn = document.createElement("button");
      btn.textContent = r.key;
      btn.onclick = () => loadRoomInfo(r.key);
      list.appendChild(btn);
    });
  });
};

window.loadRoomInfo = function (room) {
  const panel = $("room-info-panel");
  if (!panel) return;

  onValue(ref(db, "members/" + room), snap => {
    if (!panel) return;

    const users = [];
    snap.forEach(u => users.push(u.key));

    panel.innerHTML = `
      <h3>Room: ${room}</h3>
      <b>Users inside:</b>
      <ul>${users.map(u => `<li>${u}</li>`).join("")}</ul>
      <button onclick="joinRoom('${room}')">Join</button>
    `;
  });
};

window.joinRoom = async function (room) {
  if (!currentUser) return;

  const mRef = ref(db, `members/${room}/${currentUser.username}`);
  await set(mRef, true);
  onDisconnect(mRef).remove();

  push(ref(db, `messages/${room}`), {
    system: true,
    text: `${currentUser.username} has joined the chat.`,
    time: Date.now()
  });

  window.location.href = `chat.html?room=${room}`;
};

/* ============================================================
   ACCOUNT POPUP (SAFE)
============================================================ */
window.openAccountPopup = function () {
  const popup = $("account-popup");
  const input = $("displayname-input");
  if (!popup || !input) return;

  input.value = currentUser?.displayName || "";
  popup.style.display = "block";
};

window.closeAccountPopup = function () {
  const popup = $("account-popup");
  if (!popup) return;
  popup.style.display = "none";
};

window.changeDisplayName = async function () {
  const input = $("displayname-input");
  if (!input) return;

  const name = input.value.trim();
  if (!name) return alert("Empty name");

  await update(ref(db, "users/" + currentUser.username), {
    displayName: name
  });

  currentUser.displayName = name;
  saveUser(currentUser);
  alert("Updated");
};

window.changePassword = async function () {
  const pw = prompt("New password:");
  if (!pw) return;

  await update(ref(db, "users/" + currentUser.username), {
    password: pw
  });

  currentUser.password = pw;
  saveUser(currentUser);
  alert("Password changed");
};

/* ============================================================
   ACTIVE USERS LIST (NULL SAFE)
============================================================ */
onValue(ref(db, "presence"), snap => {
  const list = $("user-list");
  if (!list) return;

  list.innerHTML = "";
  snap.forEach(u => {
    const div = document.createElement("div");
    div.textContent = u.key;
    list.appendChild(div);
  });
});
