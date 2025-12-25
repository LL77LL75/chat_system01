import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get, set, onValue, update, push } 
from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

/* ---------- LOGIN ---------- */
window.normalLogin = async (u,p) => {
  const s = await get(ref(db, `users/${u}`));
  if (!s.exists() || s.val().password !== p) return alert("Invalid login");
  window.currentUser = { username:u, ...s.val() };
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
  location.href = "dashboard.html";
};

window.logout = () => {
  localStorage.removeItem("currentUser");
  location.href = "index.html";
};

window.toggleDarkMode = () => document.body.classList.toggle("dark");

/* ---------- PERMISSIONS ---------- */
window.canMute = () =>
  ["admin","high","core","pioneer"].includes(window.currentUser?.rank);

window.canBan = () =>
  ["high","core","pioneer"].includes(window.currentUser?.rank);

/* ---------- ROOMS ---------- */
let selectedRoom = null;

onValue(ref(db, "rooms"), snap => {
  const list = document.getElementById("room-list");
  if (!list) return;
  list.innerHTML = "";
  snap.forEach(r => {
    const b = document.createElement("button");
    b.textContent = r.key;
    b.onclick = () => loadRoomInfo(r.key);
    list.appendChild(b);
  });
});

window.loadRoomInfo = room => {
  selectedRoom = room;
  document.getElementById("room-title").textContent = room;
  document.getElementById("join-room-btn").disabled = false;

  const renderList = (path, el, color) =>
    onValue(ref(db, path), snap => {
      el.innerHTML = "";
      snap.forEach(s => {
        const li = document.createElement("li");
        li.textContent = s.key;
        li.style.color = color;
        el.appendChild(li);
      });
    });

  renderList(`roomMembers/${room}`, room-users);
  renderList(`roomBans/${room}`, room-banned, "red");
  renderList(`roomMutes/${room}`, room-muted, "orange");
};

document.getElementById("join-room-btn")?.addEventListener("click", async () => {
  const u = window.currentUser.username;
  await set(ref(db, `roomMembers/${selectedRoom}/${u}`), true);
  await push(ref(db, `messages/${selectedRoom}`), {
    system:true,
    text:`[SYSTEM] ${u} joined the room`,
    time:Date.now()
  });
  location.href = `chat.html?room=${selectedRoom}`;
});
