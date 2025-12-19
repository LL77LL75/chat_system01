import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getDatabase, ref, get, set, push, onValue, remove, update
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

import { firebaseConfig } from "./firebase-config.js";

/* ================= INIT ================= */
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

/* ================= LOGIN ================= */
window.normalLogin = async (username, password) => {
  const snap = await get(ref(db, "users/" + username));
  if (!snap.exists()) return alert("User not found");

  const u = snap.val();
  if (u.password !== password) return alert("Wrong password");

  window.currentUser = { username, ...u };
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
  location.href = "dashboard.html";
};

/* ================= LOGOUT ================= */
window.logout = () => {
  localStorage.removeItem("currentUser");
  location.href = "index.html";
};

/* ================= ROOMS ================= */
window.loadRooms = () => {
  const list = document.getElementById("room-list");
  const panel = document.getElementById("room-info-panel");
  if (!list || !panel) return;

  onValue(ref(db, "rooms"), snap => {
    list.innerHTML = "";
    panel.innerHTML = "";

    snap.forEach(r => {
      const btn = document.createElement("button");
      btn.textContent = r.key;
      btn.onclick = () => {
        panel.innerHTML = `
          <h4>Room: ${r.key}</h4>
          <button onclick="location.href='chat.html?room=${r.key}'">
            Join Room
          </button>
        `;
      };
      list.appendChild(btn);
    });
  });
};

/* ================= ACCOUNT ================= */
window.openAccountPopup = () => {
  const p = document.getElementById("account-popup");
  if (!p) return;

  const input = document.getElementById("displayname-input");
  if (input && window.currentUser)
    input.value = window.currentUser.displayName || "";

  p.style.display = "block";
};

window.closeAccountPopup = () => {
  const p = document.getElementById("account-popup");
  if (p) p.style.display = "none";
};

window.changeDisplayName = async () => {
  const input = document.getElementById("displayname-input");
  if (!input || !window.currentUser) return;

  const name = input.value.trim();
  if (!name) return alert("Empty");

  await update(ref(db, "users/" + window.currentUser.username), {
    displayName: name
  });

  window.currentUser.displayName = name;
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};

window.setActiveTitle = async () => {
  const sel = document.getElementById("title-select");
  if (!sel || !window.currentUser) return;

  const title = sel.value;
  await update(ref(db, "users/" + window.currentUser.username), {
    activeTitle: title
  });

  window.currentUser.activeTitle = title;
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};

/* ================= USER LIST ================= */
window.openUserList = () => {
  const p = document.getElementById("userlist-popup");
  if (p) p.style.display = "block";
};

window.closeUserList = () => {
  const p = document.getElementById("userlist-popup");
  if (p) p.style.display = "none";
};

/* ================= DARK MODE ================= */
window.toggleDarkMode = () => {
  document.body.classList.toggle("dark");
};
