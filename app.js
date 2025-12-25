import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// Persistent Dark Mode
if (localStorage.getItem("darkMode") === "true") document.body.classList.add("dark");

window.toggleDarkMode = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
};

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

// Rooms
window.loadRooms = () => {
  const list = document.getElementById("room-list");
  if (!list) return;
  onValue(ref(db, "rooms"), snap => {
    list.innerHTML = "";
    snap.forEach(r => {
      const btn = document.createElement("button");
      btn.textContent = r.key;
      btn.onclick = () => window.loadRoomInfo(r.key);
      list.appendChild(btn);
    });
  });
};

window.addRoom = async () => {
  const room = prompt("New Room Name:");
  if (!room) return;
  await set(ref(db, `rooms/${room}`), true);
  alert(`Room "${room}" added`);
};

window.loadRoomInfo = async (room) => {
  const panel = document.getElementById("room-info-panel");
  panel.innerHTML = "";
  // Members
  const membersSnap = await get(ref(db, `roomMembers/${room}`));
  let membersList = "";
  membersSnap.forEach(u => membersList += `<li>${u.key}</li>`);

  const bansSnap = await get(ref(db, `roomBans/${room}`));
  let bannedList = "";
  bansSnap.forEach(u => bannedList += `<li>${u.key}</li>`);

  const mutesSnap = await get(ref(db, `roomMutes/${room}`));
  let mutedList = "";
  mutesSnap.forEach(u => mutedList += `<li>${u.key}</li>`);

  panel.innerHTML = `
    <h3>Room: ${room}</h3>
    <p>Users inside:</p><ul>${membersList}</ul>
    <p>Banned users:</p><ul>${bannedList}</ul>
    <p>Muted users:</p><ul>${mutedList}</ul>
    <button onclick="joinRoom('${room}')">Join Room</button>
  `;

  // Admin+ delete button
  const deleteBtn = document.getElementById("delete-room-btn");
  if (["admin","high","core","pioneer"].includes(window.currentUser.rank)) {
    deleteBtn.style.display = "inline-block";
    deleteBtn.dataset.room = room;
  } else {
    deleteBtn.style.display = "none";
  }
};

window.deleteRoom = async () => {
  const btn = document.getElementById("delete-room-btn");
  const room = btn.dataset.room;
  if (!room) return;
  if (!confirm(`Delete room "${room}"? All messages and members will be removed.`)) return;

  await remove(ref(db, `rooms/${room}`));
  await remove(ref(db, `roomMembers/${room}`));
  await remove(ref(db, `messages/${room}`));
  await remove(ref(db, `roomBans/${room}`));
  await remove(ref(db, `roomMutes/${room}`));
  alert(`Room "${room}" deleted`);
  document.getElementById("room-info-panel").innerHTML = "";
};

// Account popup
window.openAccountPopup = () => {
  const p = document.getElementById("account-popup");
  if (!p || !window.currentUser) return;
  document.getElementById("displayname-input").value = window.currentUser.displayName || "";
  const sel = document.getElementById("title-select");
  sel.innerHTML = "";
  const titles = window.currentUser.titles || {};
  Object.keys(titles).forEach(t => {
    const opt=document.createElement("option");
    opt.value=t; opt.textContent=t;
    sel.appendChild(opt);
  });
  if (window.currentUser.activeTitle) sel.value = window.currentUser.activeTitle;
  p.style.display="block";
};
window.closeAccountPopup = () => { const p=document.getElementById("account-popup"); if(p)p.style.display="none"; };
