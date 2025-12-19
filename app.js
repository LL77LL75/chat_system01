import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, get, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

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

// Room info panel
window.loadRoomInfo = (room) => {
  document.getElementById("current-room-title").textContent = "Room: " + room;

  // Users inside
  onValue(ref(db, `roomMembers/${room}`), snap => {
    const ul = document.getElementById("users-inside");
    ul.innerHTML = "";
    snap.forEach(userSnap => { const li = document.createElement("li"); li.textContent = userSnap.key; ul.appendChild(li); });
  });

  // Banned users
  onValue(ref(db, `roomBans/${room}`), snap => {
    const ul = document.getElementById("users-banned");
    ul.innerHTML = "";
    snap.forEach(userSnap => {
      const li = document.createElement("li");
      li.textContent = userSnap.key;
      if (userSnap.val().global) li.style.color="grey";
      ul.appendChild(li);
    });
  });

  // Muted users
  onValue(ref(db, `roomMutes/${room}`), snap => {
    const ul = document.getElementById("users-muted");
    ul.innerHTML = "";
    snap.forEach(userSnap => {
      const li = document.createElement("li");
      li.textContent = userSnap.key;
      if (userSnap.val().global) li.style.color="grey";
      ul.appendChild(li);
    });
  });

  // Join room
  const joinBtn = document.getElementById("join-room-btn");
  joinBtn.onclick = () => {
    if (!window.currentUser) return alert("Not logged in");
    set(ref(db, `roomMembers/${room}/${window.currentUser.username}`), true);
    push(ref(db, `messages/${room}`), { sender: window.currentUser.username, text:`[SYSTEM] ${window.currentUser.username} has joined.`, time:Date.now(), system:true });
    location.href = "chat.html?room=" + room;
  };
};

// Account popup
window.openAccountPopup = () => {
  const p = document.getElementById("account-popup");
  if (!p || !window.currentUser) return;
  document.getElementById("displayname-input").value = window.currentUser.displayName || "";
  const sel = document.getElementById("title-select");
  sel.innerHTML = "";
  const titles = window.currentUser.titles || {};
  Object.keys(titles).forEach(t => { const opt=document.createElement("option"); opt.value=t; opt.textContent=t; sel.appendChild(opt); });
  if (window.currentUser.activeTitle) sel.value = window.currentUser.activeTitle;
  p.style.display = "block";
};
window.closeAccountPopup = () => { const p=document.getElementById("account-popup"); if(p)p.style.display="none"; };

// Display name and password
window.changeDisplayName = async () => {
  const name=document.getElementById("displayname-input").value.trim();
  if(!name || !window.currentUser) return;
  await update(ref(db, `users/${window.currentUser.username}`), { displayName:name });
  window.currentUser.displayName=name;
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};
window.changePassword = async () => {
  const pw = prompt("Enter new password:");
  if(!pw || !window.currentUser) return;
  await update(ref(db, `users/${window.currentUser.username}`), { password:pw });
  window.currentUser.password=pw;
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};

// Active title
window.setActiveTitle = async () => {
  const sel=document.getElementById("title-select");
  if(!sel || !window.currentUser) return;
  const title=sel.value;
  await update(ref(db, `users/${window.currentUser.username}`), { activeTitle:title });
  window.currentUser.activeTitle=title;
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
};

// Userlist popup
window.openUserList = () => { const p=document.getElementById("userlist-popup"); if(p)p.style.display="block"; };
window.closeUserList = () => { const p=document.getElementById("userlist-popup"); if(p)p.style.display="none"; };

// Dark mode
window.toggleDarkMode = () => document.body.classList.toggle("dark");

// Create new account (core/pioneer)
window.createNewAccount = async () => {
  if(!window.currentUser) return alert("Not logged in");
  if(!["core","pioneer"].includes(window.currentUser.rank)) return alert("No permission");
  const username=prompt("New username"); if(!username) return;
  const password=prompt("New password"); if(!password) return;
  const rank=prompt("Rank? (newbie/member/admin/high/core/pioneer)"); if(!rank) return;
  await set(ref(db, `users/${username}`), { password, displayName:username, rank, credits:0, activeTitle:"", titles:{} });
  alert("Account created!");
};
window.joinRoom = function(room) {
    if (!window.currentUser) return alert("Not logged in.");

    const user = window.currentUser.username;
    set(ref(db, `roomMembers/${room}/${user}`), true);

    push(ref(db, `messages/${room}`), {
        sender: user,
        text: `[SYSTEM] ${user} has joined.`,
        time: Date.now(),
        system: true
    });

    window.location.href = "chat.html?room=" + room;
};
