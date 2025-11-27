// app.js — core application logic (CLEAN VERSION)
// Provides: auth, user persistence, rooms list, join/leave (members add/remove), moderation helpers,
// cleanupOldData, titles helpers. Exports db and attaches globals for inline HTML handlers.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase, ref, get, set, push, onValue, update, remove, child
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

// --- INIT FIREBASE ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
window.db = db;

// --- UTILITIES ---
const MS_15_DAYS = 15 * 24 * 60 * 60 * 1000;
const now = () => Date.now();

function loadUser() {
  try {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveUser(u) {
  localStorage.setItem("currentUser", JSON.stringify(u));
}
function clearUser() {
  localStorage.removeItem("currentUser");
  window.currentUser = null;
}

// role powers
const ROLE_POWER = {
  newbie: 0,
  member: 1,
  admin: 2,
  high: 3,
  core: 4,
  pioneer: 5
};
function rolePower(role) { return ROLE_POWER[role] ?? 0; }

// global current user (loaded from localStorage, refreshed from DB on init)
window.currentUser = loadUser();

// Refresh current user from DB if present
(async function refreshCurrentUser() {
  if (!window.currentUser) return;
  try {
    const snap = await get(ref(db, `users/${window.currentUser.username}`));
    if (snap.exists()) {
      window.currentUser = { username: window.currentUser.username, ...snap.val() };
      saveUser(window.currentUser);
    }
  } catch (e) {
    console.warn("refreshCurrentUser failed", e);
  }
})();

// --- CLEANUP: remove old messages, reactions, logs older than 15 days
export async function cleanupOldData() {
  try {
    const cutoff = now() - MS_15_DAYS;

    // 1) Messages -> messages/{room}/{msgId}
    const messagesSnap = await get(ref(db, "messages"));
    if (messagesSnap.exists()) {
      messagesSnap.forEach(roomSnap => {
        const roomKey = roomSnap.key;
        roomSnap.forEach(msgSnap => {
          const m = msgSnap.val() || {};
          const t = m.time || 0;
          if (t < cutoff) {
            remove(ref(db, `messages/${roomKey}/${msgSnap.key}`)).catch(console.warn);
            // remove reactions under separate path too
            remove(ref(db, `reactions/${roomKey}/${msgSnap.key}`)).catch(console.warn);
          }
        });
      });
    }

    // 2) Reactions (redundant safe sweep)
    const reactionsSnap = await get(ref(db, "reactions"));
    if (reactionsSnap.exists()) {
      reactionsSnap.forEach(roomSnap => {
        const roomKey = roomSnap.key;
        roomSnap.forEach(msgSnap => {
          msgSnap.forEach(userSnap => {
            const r = userSnap.val() || {};
            const t = r.time || 0;
            if (t < cutoff) {
              remove(ref(db, `reactions/${roomKey}/${msgSnap.key}/${userSnap.key}`)).catch(console.warn);
            }
          });
        });
      });
    }

    // 3) Logs
    const logsSnap = await get(ref(db, "logs"));
    if (logsSnap.exists()) {
      logsSnap.forEach(l => {
        const data = l.val() || {};
        const t = data.time || 0;
        if (t < cutoff) remove(ref(db, `logs/${l.key}`)).catch(console.warn);
      });
    }
  } catch (err) {
    console.error("cleanupOldData error:", err);
  }
}

// run cleanup opportunistically now
cleanupOldData().catch(console.warn);

// --- AUTHENTICATION / SESSIONS ---
export async function normalLogin(username, password) {
  if (!username || !password) return alert("Missing username or password.");
  const snap = await get(ref(db, `users/${username}`));
  if (!snap.exists()) {
    alert("User not found.");
    return;
  }
  const data = snap.val();
  if (data.password !== password) {
    alert("Wrong password.");
    return;
  }

  window.currentUser = { username, ...data };
  saveUser(window.currentUser);

  // log
  await push(ref(db, "logs"), { type: "login", user: username, time: now() });

  // opportunistic cleanup
  cleanupOldData().catch(console.warn);

  window.location.href = "dashboard.html";
}
window.normalLogin = normalLogin;

export function logout() {
  if (window.currentUser) {
    push(ref(db, "logs"), { type: "logout", user: window.currentUser.username, time: now() }).catch(console.warn);
  }
  clearUser();
  window.location.href = "index.html";
}
window.logout = logout;

// --- ROOM LIST & INFO (dashboard) ---
export function loadRooms() {
  const list = document.getElementById("room-list");
  const panel = document.getElementById("room-info-panel");
  if (!list || !panel) return;

  // watch rooms
  onValue(ref(db, "rooms"), (snap) => {
    list.innerHTML = "";
    snap.forEach(roomNode => {
      const room = roomNode.key;
      const btn = document.createElement("button");
      btn.className = "room-btn";
      btn.textContent = room;
      btn.onclick = () => loadRoomInfo(room);
      list.appendChild(btn);
    });
  }, (err) => console.warn("loadRooms error", err));
}
window.loadRooms = loadRooms;

export async function loadRoomInfo(room) {
  const panel = document.getElementById("room-info-panel");
  if (!panel) return;

  // members
  const membersSnap = await get(ref(db, `rooms/${room}/members`));
  const members = [];
  if (membersSnap.exists()) {
    membersSnap.forEach(m => members.push(m.key));
  }

  // banned & muted in room
  const bannedInRoomSnap = await get(ref(db, `rooms/${room}/banned`));
  const mutedInRoomSnap = await get(ref(db, `rooms/${room}/muted`));

  panel.innerHTML = `
    <h3>Room: ${room}</h3>
    <p>Users inside (${members.length}):</p>
    <ul>${members.map(u => `<li>${u}</li>`).join("")}</ul>
    <button id="join-room-btn">Join Room</button>
    <div id="room-moderation"></div>
  `;

  const joinBtn = document.getElementById("join-room-btn");
  joinBtn.onclick = async () => {
    await joinRoom(room);
  };

  // show banned/muted if user has admin+
  const rp = rolePower(window.currentUser?.rank);
  if (rp >= rolePower("admin")) {
    const el = document.getElementById("room-moderation");
    let html = "<h4>Room bans</h4>";
    if (bannedInRoomSnap.exists()) {
      bannedInRoomSnap.forEach(b => { html += `<div>${b.key} (level ${b.val().level || b.val()})</div>`; });
    } else html += "<div>None</div>";
    html += "<h4>Room mutes</h4>";
    if (mutedInRoomSnap.exists()) {
      mutedInRoomSnap.forEach(m => { html += `<div>${m.key} (level ${m.val().level || m.val()})</div>`; });
    } else html += "<div>None</div>";
    el.innerHTML = html;
  }
}
window.loadRoomInfo = loadRoomInfo;

// --- JOIN / LEAVE (members add/remove) ---
export async function joinRoom(room) {
  if (!window.currentUser) return alert("Not logged in.");
  const u = window.currentUser.username;

  // Check if user is banned globally or in room
  const userBannedSnap = await get(ref(db, `users/${u}/banned`));
  if (userBannedSnap.exists()) {
    alert("You are banned and cannot join rooms.");
    return;
  }

  const roomBannedSnap = await get(ref(db, `rooms/${room}/banned/${u}`));
  if (roomBannedSnap.exists()) {
    alert("You are banned from this room.");
    return;
  }

  // add to members
  await set(ref(db, `rooms/${room}/members/${u}`), now());

  // system join message
  await push(ref(db, `messages/${room}`), {
    sender: "SYSTEM",
    text: `${u} has joined the chat.`,
    time: now(),
    system: true
  });

  // log
  await push(ref(db, "logs"), { type: "join", user: u, room, time: now() });

  // navigate to chat
  window.location.href = `chat.html?room=${encodeURIComponent(room)}`;
}
window.joinRoom = joinRoom;

export async function leaveRoom(room) {
  if (!window.currentUser) return;
  const u = window.currentUser.username;

  // remove from members
  await remove(ref(db, `rooms/${room}/members/${u}`));

  // system leave message
  await push(ref(db, `messages/${room}`), {
    sender: "SYSTEM",
    text: `${u} has left the chat.`,
    time: now(),
    system: true
  });

  // log
  await push(ref(db, "logs"), { type: "leave", user: u, room, time: now() });

  // redirect
  window.location.href = "dashboard.html";
}
window.leaveRoom = leaveRoom;

// Remove member from any room on unload to prevent ghosts
window.addEventListener("beforeunload", async (e) => {
  try {
    // Attempt to remove from all rooms where user appears in rooms/*/members
    if (!window.currentUser) return;
    const username = window.currentUser.username;
    const roomsSnap = await get(ref(db, "rooms"));
    if (!roomsSnap.exists()) return;
    roomsSnap.forEach(roomSnap => {
      const room = roomSnap.key;
      const mSnap = roomSnap.child("members");
      if (mSnap && mSnap.val() && mSnap.child && mSnap.child(username) && mSnap.child(username).val()) {
        // best-effort remove (no await in beforeunload)
        remove(ref(db, `rooms/${room}/members/${username}`)).catch(() => {});
      }
    });
  } catch (err) {
    // ignore
  }
});

// --- ACCOUNT POPUP / PROFILE ---
export function openAccountPopup() {
  const popup = document.getElementById("account-popup");
  if (!popup) return;
  document.getElementById("displayname-input").value = window.currentUser?.displayName || "";
  popup.style.display = "block";
}
window.openAccountPopup = openAccountPopup;

export function closeAccountPopup() {
  const popup = document.getElementById("account-popup");
  if (!popup) return;
  popup.style.display = "none";
}
window.closeAccountPopup = closeAccountPopup;

export async function changeDisplayName() {
  if (!window.currentUser) return alert("Not logged in.");
  const newName = document.getElementById("displayname-input").value.trim();
  if (!newName) return alert("Display name cannot be empty.");
  const u = window.currentUser.username;
  await update(ref(db, `users/${u}`), { displayName: newName });
  window.currentUser.displayName = newName;
  saveUser(window.currentUser);
  alert("Display name updated.");
}
window.changeDisplayName = changeDisplayName;

export async function changePassword() {
  if (!window.currentUser) return alert("Not logged in.");
  const pw = prompt("Enter new password:");
  if (!pw) return;
  const u = window.currentUser.username;
  await update(ref(db, `users/${u}`), { password: pw });
  window.currentUser.password = pw;
  saveUser(window.currentUser);
  alert("Password updated.");
}
window.changePassword = changePassword;

export async function setActiveTitle() {
  if (!window.currentUser) return alert("Not logged in.");
  const title = document.getElementById("title-select").value;
  const u = window.currentUser.username;
  await update(ref(db, `users/${u}`), { activeTitle: title });
  window.currentUser.activeTitle = title;
  saveUser(window.currentUser);
  alert("Title updated.");
}
window.setActiveTitle = setActiveTitle;

// create user (core+)
export async function createNewAccount() {
  if (!window.currentUser) return alert("Not logged in.");
  const rp = rolePower(window.currentUser.rank);
  if (rp < rolePower("core")) return alert("No permission.");
  const username = prompt("New username:");
  if (!username) return;
  const password = prompt("New password:");
  if (!password) return;
  let rank = prompt("Rank (newbie/member/admin/high/core/pioneer):", "newbie");
  if (!rank || !(rank in ROLE_POWER)) rank = "newbie";
  await set(ref(db, `users/${username}`), {
    password,
    displayName: username,
    rank,
    activeTitle: "newbie",
    titles: { newbie: true },
    createdAt: now()
  });
  alert("Account created.");
}
window.createNewAccount = createNewAccount;

// TITLES: give title to user
export async function giveTitleToUser(username, titleName) {
  if (!username || !titleName) return;
  await set(ref(db, `users/${username}/titles/${titleName}`), true);
}
window.giveTitleToUser = giveTitleToUser;

export { db };
