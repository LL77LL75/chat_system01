import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase, ref, get, push, update, remove, onValue
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
window.db = db;

/* USER */
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

/* LOGIN */
window.normalLogin = async (u, p) => {
  const s = await get(ref(db, "users/" + u));
  if (!s.exists()) return alert("User not found");
  if (s.val().password !== p) return alert("Wrong password");
  if (s.val().banned?.global) return alert("Banned");

  window.currentUser = { username: u, ...s.val() };
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
  location.href = "dashboard.html";
};

/* LOGOUT */
window.logout = () => {
  localStorage.removeItem("currentUser");
  location.href = "index.html";
};

/* ROOMS */
window.loadRooms = () => {
  const list = document.getElementById("room-list");
  if (!list) return;

  onValue(ref(db, "rooms"), snap => {
    list.innerHTML = "";
    snap.forEach(r => {
      const b = document.createElement("button");
      b.textContent = r.key;
      b.onclick = () => loadRoomInfo(r.key);
      list.appendChild(b);
    });
  });
};

window.loadRoomInfo = r => {
  document.getElementById("room-info-panel").innerHTML =
    `<h3>${r}</h3><button onclick="joinRoom('${r}')">Join</button>`;
};

window.joinRoom = r => location.href = `chat.html?room=${r}`;

/* ACCOUNT */
window.openAccountPopup = () =>
  document.getElementById("account-popup").style.display = "block";

window.closeAccountPopup = () =>
  document.getElementById("account-popup").style.display = "none";

/* USER LIST */
window.openUserList = async () => {
  const p = document.getElementById("user-list-panel");
  p.innerHTML = "<h3>Users</h3>";
  const s = await get(ref(db, "users"));
  s.forEach(u => {
    const d = u.val();
    const div = document.createElement("div");
    div.textContent = `${u.key} (${d.rank})`;
    if (d.banned?.global) div.style.color = "red";
    else if (d.muted?.global) div.style.color = "gold";
    p.appendChild(div);
  });
  p.style.display = "block";
};

window.closeUserList = () =>
  document.getElementById("user-list-panel").style.display = "none";
