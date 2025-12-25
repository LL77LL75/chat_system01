import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase, ref, get, set, onValue, update, push
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
window.currentUser = JSON.parse(localStorage.getItem("currentUser") || "null");

// Restore dark mode
if (localStorage.getItem("darkMode") === "1") {
  document.body.classList.add("dark");
}

// LOGIN
window.normalLogin = async (u, p) => {
  const snap = await get(ref(db, `users/${u}`));
  if (!snap.exists() || snap.val().password !== p) {
    alert("Invalid login");
    return;
  }
  window.currentUser = { username: u, ...snap.val() };
  localStorage.setItem("currentUser", JSON.stringify(window.currentUser));
  location.href = "dashboard.html";
};

// LOGOUT
window.logout = () => {
  localStorage.removeItem("currentUser");
  location.href = "index.html";
};

// DARK MODE
window.toggleDarkMode = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "darkMode",
    document.body.classList.contains("dark") ? "1" : "0"
  );
};

// ACCOUNT POPUP
window.openAccountPopup = () => {
  document.getElementById("account-popup").style.display = "block";
};
window.closeAccountPopup = () => {
  document.getElementById("account-popup").style.display = "none";
};

// CHANGE DISPLAYNAME / PASSWORD
window.changeDisplayName = async () => {
  const val = document.getElementById("displayname-input").value.trim();
  if (!val) return;
  await update(ref(db, `users/${currentUser.username}`), { displayName: val });
  currentUser.displayName = val;
  localStorage.setItem("currentUser", JSON.stringify(currentUser));
};

window.changePassword = async () => {
  const pw = prompt("New password:");
  if (!pw) return;
  await update(ref(db, `users/${currentUser.username}`), { password: pw });
};

// ROOMS
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
  document.getElementById("room-title").textContent = `Room: ${room}`;
  document.getElementById("join-room-btn").disabled = false;

  const usersUL  = document.getElementById("room-users");
  const bannedUL = document.getElementById("room-banned");
  const mutedUL  = document.getElementById("room-muted");

  onValue(ref(db, `roomMembers/${room}`), snap => {
    usersUL.innerHTML = "";
    snap.forEach(s => {
      const li = document.createElement("li");
      li.textContent = s.key;
      usersUL.appendChild(li);
    });
  });

  onValue(ref(db, `roomBans/${room}`), snap => {
    bannedUL.innerHTML = "";
    snap.forEach(s => {
      const li = document.createElement("li");
      li.textContent = s.key;
      li.style.color = "red";
      bannedUL.appendChild(li);
    });
  });

  onValue(ref(db, `roomMutes/${room}`), snap => {
    mutedUL.innerHTML = "";
    snap.forEach(s => {
      const li = document.createElement("li");
      li.textContent = s.key;
      li.style.color = "orange";
      mutedUL.appendChild(li);
    });
  });
};

// JOIN ROOM
document.getElementById("join-room-btn")?.addEventListener("click", async () => {
  if (!currentUser || !selectedRoom) return;
  const u = currentUser.username;

  await set(ref(db, `roomMembers/${selectedRoom}/${u}`), true);
  await push(ref(db, `messages/${selectedRoom}`), {
    system: true,
    text: `[SYSTEM] ${u} joined the room.`,
    time: Date.now()
  });

  location.href = `chat.html?room=${selectedRoom}`;
});
