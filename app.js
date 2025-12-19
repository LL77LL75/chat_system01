import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase, ref, get, set, update, push, remove,
  onValue, onDisconnect
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

export let currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");
window.currentUser = currentUser;

/* =======================
   LOGIN / PRESENCE
======================= */
export async function normalLogin(username, password) {
  const snap = await get(ref(db, "users/" + username));
  if (!snap.exists()) return alert("User not found");
  if (snap.val().password !== password) return alert("Wrong password");

  currentUser = { username, ...snap.val() };
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
  window.currentUser = currentUser;

  const presRef = ref(db, `presence/${username}`);
  await set(presRef, { online: true, time: Date.now() });
  onDisconnect(presRef).remove();

  window.location.href = "dashboard.html";
}
window.normalLogin = normalLogin;

export function logout() {
  if (currentUser) remove(ref(db, `presence/${currentUser.username}`));
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
}
window.logout = logout;

/* =======================
   ACCOUNT POPUP (FIXED)
======================= */
export async function openAccountPopup() {
  const popup = document.getElementById("account-popup");
  popup.style.display = "flex";

  const nameInput = document.getElementById("displayname-input");
  nameInput.value = currentUser.displayName || "";

  // 🔧 FIX TITLE DROPDOWN
  const sel = document.getElementById("title-select");
  sel.innerHTML = "";

  const snap = await get(ref(db, `users/${currentUser.username}/titles`));
  if (snap.exists()) {
    snap.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.key;
      opt.textContent = t.key;
      sel.appendChild(opt);
    });
  }
  sel.value = currentUser.activeTitle || "";
}
window.openAccountPopup = openAccountPopup;

export function closeAccountPopup() {
  document.getElementById("account-popup").style.display = "none";
}
window.closeAccountPopup = closeAccountPopup;

/* =======================
   DARK MODE
======================= */
window.toggleDarkMode = function () {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode",
    document.body.classList.contains("dark")
  );
};

/* =======================
   USER LIST (ACTIVE)
======================= */
window.openUserList = function () {
  const panel = document.getElementById("user-list-panel");
  panel.style.display = "flex";

  const list = document.getElementById("user-list");
  onValue(ref(db, "presence"), snap => {
    list.innerHTML = "";
    snap.forEach(u => {
      const li = document.createElement("div");
      li.className = "user-row online";
      li.textContent = u.key;
      list.appendChild(li);
    });
  });
};

window.closeUserList = function () {
  document.getElementById("user-list-panel").style.display = "none";
};
